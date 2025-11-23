import { Server, Socket } from "socket.io";
import {
  StartSessionSchema,
  AudioChunkSchema,
  PauseSessionSchema,
  ResumeSessionSchema,
  StopSessionSchema,
  safeValidateSocketPayload,
} from "../schemas/socket.schema";
import { sessionLogger, socketLogger, chunkLogger } from "../utils/logger";
import { getBackpressureManager, removeBackpressureManager } from "../utils/backpressure";
import {
  checkSessionRateLimit,
  registerActiveSession,
  unregisterActiveSession,
  verifySessionOwnership,
  chunkRateLimiter,
  RateLimitError,
} from "../utils/rateLimiter";
import { sessionManager } from "../managers/SessionManager";
import { chunkManager } from "../managers/ChunkManager";
import { socketManager } from "../managers/SocketManager";
import { finalizeSession } from "../processors/finalize";
import { queueTranscription } from "../workers/transcription.worker";

/**
 * Setup Socket.io event handlers for recording sessions
 * @param io - Socket.io server instance
 * @param socket - Client socket connection
 */
export function setupRecordingSockets(io: Server, socket: Socket) {
  socketLogger.connected(socket.id, {
    handshake: socket.handshake.address,
  });

  const backpressureManager = getBackpressureManager(socket.id);
  let authenticatedUserId: string | null = null;

  // Authenticate socket on connection (uses cookies)
  socketManager.authenticate(socket).then((userId) => {
    authenticatedUserId = userId;
    if (!userId) {
      socket.emit("auth-error", { error: "Authentication required" });
      socket.disconnect(true);
    }
  });

  // Join session room
  socket.on("join", (room: string) => {
    socket.join(room);
    console.log(`[Socket] ${socket.id} joined room: ${room}`);
  });

  // Leave session room
  socket.on("leave", (room: string) => {
    socket.leave(room);
    console.log(`[Socket] ${socket.id} left room: ${room}`);
  });

  // Start session
  socket.on("start-session", async (rawData: unknown) => {
    if (!authenticatedUserId) {
      socket.emit("session-error", { error: "Unauthorized" });
      return;
    }

    const validation = safeValidateSocketPayload(StartSessionSchema, rawData);

    if (!validation.success) {
      const errorMsg = validation.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");

      sessionLogger.error({
        sessionId:
          typeof rawData === "object" && rawData !== null && "sessionId" in rawData
            ? String((rawData as any).sessionId)
            : "unknown",
        error: `Validation failed: ${errorMsg}`,
        operation: "start-session",
      });

      socket.emit("session-error", {
        error: "Invalid session data",
        details: errorMsg,
      });
      return;
    }

    const data = validation.data;

    if (data.userId !== authenticatedUserId) {
      socket.emit("session-error", { error: "User ID mismatch" });
      return;
    }

    try {
      // Check rate limits
      await checkSessionRateLimit(data.userId);

      // Create session using manager
      const session = await sessionManager.createSession({
        sessionId: data.sessionId,
        userId: data.userId,
        title: data.title || `Recording - ${new Date().toLocaleString()}`,
        source: data.source || "mic",
      });

      registerActiveSession(data.userId, data.sessionId);

      // Join socket room for this session
      socket.join(`session:${data.sessionId}`);

      socket.emit("session-started", {
        sessionId: session.id,
        status: "recording",
        startedAt: session.startedAt,
      });
    } catch (error) {
      if (error instanceof RateLimitError) {
        socket.emit("session-error", {
          error: error.message,
          code: error.code,
        });
        return;
      }
      sessionLogger.error({
        sessionId: data.sessionId,
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "start-session",
      });

      socket.emit("session-error", {
        sessionId: data.sessionId,
        error: "Failed to create session",
      });
    }
  });

  // Audio chunk handler
  socket.on("audio-chunk", async (rawData: unknown) => {
    const chunkStartTime = Date.now();

    if (!authenticatedUserId) {
      socket.emit("chunk-error", { error: "Unauthorized" });
      return;
    }

    if (!backpressureManager.canAccept()) {
      socket.emit("backpressure", { canAccept: false });
      console.warn(`[Backpressure] Rejecting chunk from ${socket.id}`);
      return;
    }

    // TEMPORARILY DISABLED BACKPRESSURE FOR TESTING
    // if (!backpressureManager.canAccept()) {
    //   socket.emit("backpressure", { canAccept: false });
    //   console.warn(`[Backpressure] Rejecting chunk from ${socket.id}`);
    //   return;
    // }

    backpressureManager.incrementQueue();

    const validation = safeValidateSocketPayload(AudioChunkSchema, rawData);

    if (!validation.success) {
      backpressureManager.decrementQueue();
      const errorMsg = validation.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");

      chunkLogger.validationError({
        sessionId:
          typeof rawData === "object" && rawData !== null && "sessionId" in rawData
            ? String((rawData as any).sessionId)
            : undefined,
        sequence:
          typeof rawData === "object" && rawData !== null && "sequence" in rawData
            ? Number((rawData as any).sequence)
            : undefined,
        validationErrors: errorMsg,
        rawData,
      });

      socket.emit("chunk-error", {
        error: "Invalid chunk data",
        details: errorMsg,
      });
      return;
    }

    const data = validation.data;

    try {
      // Verify ownership
      const ownsSession = await verifySessionOwnership(data.sessionId, authenticatedUserId);
      if (!ownsSession) {
        backpressureManager.decrementQueue();
        socket.emit("chunk-error", { error: "Unauthorized: session not owned by user" });
        return;
      }

      // Rate limiting
      if (!chunkRateLimiter.canAcceptChunk(data.sessionId)) {
        backpressureManager.decrementQueue();
        socket.emit("chunk-error", { error: "Chunk rate limit exceeded" });
        return;
      }

      // Process chunk using manager
      // Socket.io may send audio as ArrayBuffer, Buffer, or Uint8Array
      let audioBuffer: Buffer;
      if (Buffer.isBuffer(data.audio)) {
        audioBuffer = data.audio;
      } else if (data.audio instanceof ArrayBuffer) {
        audioBuffer = Buffer.from(data.audio);
      } else if (data.audio.buffer && data.audio.buffer instanceof ArrayBuffer) {
        // Uint8Array or similar
        audioBuffer = Buffer.from(data.audio.buffer);
      } else if (typeof data.audio === "object" && data.audio.data) {
        // Socket.io may wrap it
        audioBuffer = Buffer.from(data.audio.data);
      } else {
        throw new Error("Invalid audio data format");
      }

      if (audioBuffer.length === 0) {
        console.warn(`[AudioRecorder] Empty chunk received for session ${data.sessionId}`);
        backpressureManager.decrementQueue();
        return;
      }

      const metadata = await chunkManager.processChunk(
        {
          sessionId: data.sessionId,
          sequence: data.sequence,
          timestamp: data.timestamp,
          audioData: audioBuffer,
          mimeType: data.mimeType,
        },
        socket
      );

      // Queue transcription worker
      const { queueTranscription } = await import("../workers/transcription.worker");

      console.log(`[Recording] Queueing transcription for chunk ${data.sequence}`);
      await queueTranscription(data.sessionId, data.sequence);

      backpressureManager.decrementQueue();

      // Emit acknowledgment (already done in chunkManager, but include backpressure)
      socket.emit("chunk-ack", {
        sessionId: data.sessionId,
        ...metadata,
        canAccept: backpressureManager.canAccept(),
      });
    } catch (error) {
      backpressureManager.decrementQueue();

      chunkLogger.error({
        sessionId: data.sessionId,
        sequence: data.sequence,
        error: error instanceof Error ? error : new Error(String(error)),
        userId: authenticatedUserId,
      });

      socket.emit("chunk-error", {
        sessionId: data.sessionId,
        sequence: data.sequence,
        error: "Failed to save chunk",
      });
    }
  });

  // Pause session
  socket.on("pause-session", async (rawData: unknown) => {
    if (!authenticatedUserId) {
      socket.emit("session-error", { error: "Unauthorized" });
      return;
    }

    const validation = safeValidateSocketPayload(PauseSessionSchema, rawData);

    if (!validation.success) {
      socket.emit("session-error", { error: "Invalid pause data" });
      return;
    }

    const data = validation.data;

    try {
      const ownsSession = await verifySessionOwnership(data.sessionId, authenticatedUserId);
      if (!ownsSession) {
        socket.emit("session-error", { error: "Unauthorized" });
        return;
      }

      await sessionManager.pauseSession(data.sessionId);

      socket.emit("session-paused", {
        sessionId: data.sessionId,
        pausedAt: new Date().toISOString(),
      });
    } catch (error) {
      sessionLogger.error({
        sessionId: data.sessionId,
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "pause-session",
      });

      socket.emit("session-error", {
        error: "Failed to pause session",
      });
    }
  });

  // Resume session
  socket.on("resume-session", async (rawData: unknown) => {
    if (!authenticatedUserId) {
      socket.emit("session-error", { error: "Unauthorized" });
      return;
    }

    const validation = safeValidateSocketPayload(ResumeSessionSchema, rawData);

    if (!validation.success) {
      socket.emit("session-error", { error: "Invalid resume data" });
      return;
    }

    const data = validation.data;

    try {
      const ownsSession = await verifySessionOwnership(data.sessionId, authenticatedUserId);
      if (!ownsSession) {
        socket.emit("session-error", { error: "Unauthorized" });
        return;
      }

      await sessionManager.resumeSession(data.sessionId);

      socket.emit("session-resumed", {
        sessionId: data.sessionId,
        resumedAt: new Date().toISOString(),
      });
    } catch (error) {
      sessionLogger.error({
        sessionId: data.sessionId,
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "resume-session",
      });

      socket.emit("session-error", {
        error: "Failed to resume session",
      });
    }
  });

  // Stop session
  socket.on("stop-session", async (rawData: unknown) => {
    if (!authenticatedUserId) {
      socket.emit("session-error", { error: "Unauthorized" });
      return;
    }

    const validation = safeValidateSocketPayload(StopSessionSchema, rawData);

    if (!validation.success) {
      socket.emit("session-error", { error: "Invalid stop data" });
      return;
    }

    const data = validation.data;

    try {
      const ownsSession = await verifySessionOwnership(data.sessionId, authenticatedUserId);
      if (!ownsSession) {
        socket.emit("session-error", { error: "Unauthorized" });
        return;
      }

      // Emit stopped event immediately for UI
      socket.emit("session-stopped", {
        sessionId: data.sessionId,
        stoppedAt: new Date().toISOString(),
      });

      // Wait 3 seconds before completing to allow final chunks to arrive
      console.log(`[Stop] Waiting 3s for final chunks: ${data.sessionId}`);
      const userId = authenticatedUserId; // Capture in closure
      setTimeout(async () => {
        try {
          if (!userId) return;
          await sessionManager.completeSession(data.sessionId, userId);
          unregisterActiveSession(userId, data.sessionId);
          console.log(`[Stop] Session completed after grace period: ${data.sessionId}`);

          // Trigger finalization (summary generation, etc.)
          finalizeSession(data.sessionId).catch((error) => {
            console.error(`[Stop] Finalization failed for ${data.sessionId}:`, error);
          });
        } catch (error) {
          console.error(`[Stop] Failed to complete session ${data.sessionId}:`, error);
        }
      }, 3000);
    } catch (error) {
      sessionLogger.error({
        sessionId: data.sessionId,
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "stop-session",
      });

      socket.emit("session-error", {
        error: "Failed to stop session",
      });
    }
  });

  // Disconnect handler
  socket.on("disconnect", (reason) => {
    socketLogger.disconnected(socket.id, reason);
    socketManager.handleDisconnect(socket.id);
    removeBackpressureManager(socket.id);

    // Cleanup handled by socketManager
  });
}
