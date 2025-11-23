import { Server, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import {
  StartSessionSchema,
  AudioChunkSchema,
  PauseSessionSchema,
  ResumeSessionSchema,
  StopSessionSchema,
  safeValidateSocketPayload,
} from "../schemas/socket.schema";
import { chunkLogger, sessionLogger, socketLogger } from "../utils/logger";
import { getBackpressureManager, removeBackpressureManager } from "../utils/backpressure";

const prisma = new PrismaClient();

const STORAGE_DIR = path.join(process.cwd(), "storage", "audio-chunks");

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

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


  socket.on("start-session", async (rawData: unknown) => {
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

    sessionLogger.started({
      sessionId: data.sessionId,
      userId: data.userId,
      source: data.source,
      title: data.title,
    });

    try {
      const sessionDir = path.join(STORAGE_DIR, data.sessionId);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      const session = await prisma.recordingSession.create({
        data: {
          id: data.sessionId,
          userId: data.userId,
          title: data.title || `Recording - ${new Date().toLocaleString()}`,
          status: "recording",
          startedAt: new Date(),
        },
      });

      socket.emit("session-started", {
        sessionId: session.id,
        status: "recording",
        startedAt: session.startedAt,
      });
    } catch (error) {
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

  socket.on("audio-chunk", async (rawData: unknown) => {
    const chunkStartTime = Date.now();
    if (!backpressureManager.canAccept()) {
      socket.emit("backpressure", { canAccept: false });
      console.warn(`[Backpressure] Rejecting chunk from ${socket.id}`);
      return;
    }

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
      const existingChunk = await prisma.transcriptChunk.findUnique({
        where: {
          sessionId_seq: {
            sessionId: data.sessionId,
            seq: data.sequence,
          },
        },
      });

      if (existingChunk) {
        console.log(`[Idempotency] Duplicate chunk: ${data.sessionId}/${data.sequence}`);

        backpressureManager.decrementQueue();

        socket.emit("chunk-ack", {
          sessionId: data.sessionId,
          sequence: data.sequence,
          timestamp: data.timestamp,
          chunkId: existingChunk.id,
          duplicate: true,
          canAccept: backpressureManager.canAccept(),
        });
        return;
      }

      const session = await prisma.recordingSession.findUnique({
        where: { id: data.sessionId },
        select: { userId: true },
      });

      chunkLogger.received({
        sessionId: data.sessionId,
        sequence: data.sequence,
        userId: session?.userId || "unknown",
        size: data.size,
        durationMs: 30000,
        mimeType: data.mimeType,
      });

      const audioBuffer = Buffer.from(data.audio);

      const filename = `${data.sessionId}_${data.sequence.toString().padStart(4, "0")}.webm`;
      const sessionDir = path.join(STORAGE_DIR, data.sessionId);
      const filePath = path.join(sessionDir, filename);

      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      await fs.promises.writeFile(filePath, audioBuffer);

      const chunk = await prisma.transcriptChunk.create({
        data: {
          sessionId: data.sessionId,
          seq: data.sequence,
          audioPath: filePath,
          durationMs: 30000,
          status: "uploaded",
        },
      });

      const processingTime = Date.now() - chunkStartTime;

      chunkLogger.processed(data.sessionId, data.sequence, data.size, {
        sessionId: data.sessionId,
        sequence: data.sequence,
        chunkId: chunk.id,
        processingTimeMs: processingTime,
        audioPath: filePath,
      });

      backpressureManager.decrementQueue();

      socket.emit("chunk-ack", {
        sessionId: data.sessionId,
        sequence: data.sequence,
        timestamp: data.timestamp,
        receivedAt: chunkStartTime,
        processingTime,
        bytesReceived: data.size,
        chunkId: chunk.id,
        duplicate: false,
        canAccept: backpressureManager.canAccept(),
      });
    } catch (error) {
      backpressureManager.decrementQueue();

      if ((error as any).code === "P2002") {
        console.warn(`[Idempotency] Race condition for chunk ${data.sequence}`);
        socket.emit("chunk-ack", {
          sessionId: data.sessionId,
          sequence: data.sequence,
          timestamp: data.timestamp,
          duplicate: true,
          canAccept: backpressureManager.canAccept(),
        });
        return;
      }

      chunkLogger.error({
        sessionId: data.sessionId,
        sequence: data.sequence,
        error: error instanceof Error ? error : new Error(String(error)),
        userId: undefined,
      });

      socket.emit("chunk-error", {
        sessionId: data.sessionId,
        sequence: data.sequence,
        error: "Failed to save chunk",
      });
    }
  });

  socket.on("pause-session", async (rawData: unknown) => {
    const validation = safeValidateSocketPayload(PauseSessionSchema, rawData);

    if (!validation.success) {
      return;
    }

    const data = validation.data;

    sessionLogger.paused({
      sessionId: data.sessionId,
      pausedAt: data.pausedAt,
    });

    try {
      socket.emit("session-paused", {
        sessionId: data.sessionId,
        pausedAt: data.pausedAt,
      });
    } catch (error) {
      sessionLogger.error({
        sessionId: data.sessionId,
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "pause-session",
      });
    }
  });

  socket.on("resume-session", async (rawData: unknown) => {
    const validation = safeValidateSocketPayload(ResumeSessionSchema, rawData);

    if (!validation.success) {
      return;
    }

    const data = validation.data;

    sessionLogger.resumed({
      sessionId: data.sessionId,
      resumedAt: data.resumedAt,
    });

    try {
      socket.emit("session-resumed", {
        sessionId: data.sessionId,
        resumedAt: data.resumedAt,
      });
    } catch (error) {
      sessionLogger.error({
        sessionId: data.sessionId,
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "resume-session",
      });
    }
  });

  socket.on("stop-session", async (rawData: unknown) => {
    const validation = safeValidateSocketPayload(StopSessionSchema, rawData);

    if (!validation.success) {
      return;
    }

    const data = validation.data;

    try {
      await prisma.recordingSession.update({
        where: { id: data.sessionId },
        data: {
          status: "stopped",
          endedAt: new Date(),
        },
      });

      sessionLogger.completed({
        sessionId: data.sessionId,
        userId: data.userId || "unknown",
        totalChunks: 0,
      });

      socket.emit("session-stopped", {
        sessionId: data.sessionId,
        status: "stopped",
        endedAt: new Date(),
      });

      const { finalizeSession } = await import("../processors/finalize");
      finalizeSession(data.sessionId).catch((error) => {
        console.error(`[Stop] Finalization failed for ${data.sessionId}:`, error);
      });
    } catch (error) {
      sessionLogger.error({
        sessionId: data.sessionId,
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "stop-session",
      });

      socket.emit("session-error", {
        sessionId: data.sessionId,
        error: "Failed to stop session",
      });
    }
  });

  socket.on("disconnect", (reason) => {
    socketLogger.disconnected(socket.id, reason);
    removeBackpressureManager(socket.id);
  });
}
