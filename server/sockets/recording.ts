import { Server, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

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
  /**
   * Handle start recording session
   * Creates a new RecordingSession in the database
   */
  socket.on(
    "start-session",
    async (data: { sessionId: string; userId: string; source: "mic" | "tab" }) => {
      console.log(`🎙️ Starting session: ${data.sessionId}, source: ${data.source}`);

      try {
        const sessionDir = path.join(STORAGE_DIR, data.sessionId);
        if (!fs.existsSync(sessionDir)) {
          fs.mkdirSync(sessionDir, { recursive: true });
        }

        const session = await prisma.recordingSession.create({
          data: {
            id: data.sessionId,
            userId: data.userId,
            title: `Recording - ${new Date().toLocaleString()}`,
            status: "recording",
            startedAt: new Date(),
          },
        });

        console.log(`Session created in DB: ${session.id}`);//db creation check kr rha hoon yaha pr 

        socket.emit("session-started", {
          sessionId: session.id,
          status: "recording",
          startedAt: session.startedAt,
        });
      } catch (error) {
        console.error("Failed to create session:", error);
        socket.emit("session-error", {
          sessionId: data.sessionId,
          error: "Failed to create session",
        });
      }
    }
  );

  /**
   * Handle audio chunk streaming
   * Saves chunk to disk and creates TranscriptChunk entry in database
   */
  socket.on(
    "audio-chunk",
    async (data: {
      sessionId: string;
      sequence: number;
      timestamp: number;
      size: number;
      mimeType: string;
      audio: ArrayBuffer;
    }) => {
      const chunkStartTime = Date.now();

      try {
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

        console.log(
          `Chunk ${data.sequence} saved: ${(data.size / 1024).toFixed(2)} KB (${processingTime}ms)`
        );

        socket.emit("chunk-ack", {
          sessionId: data.sessionId,
          sequence: data.sequence,
          timestamp: data.timestamp,
          receivedAt: chunkStartTime,
          processingTime,
          bytesReceived: data.size,
          chunkId: chunk.id,
        });

      } catch (error) {
        console.error(`failed chunk save ${data.sequence}:`, error);
        socket.emit("chunk-error", {
          sessionId: data.sessionId,
          sequence: data.sequence,
          error: "failed chunk save",
        });
      }
    }
  );

  
  socket.on("pause-session", async (data: { sessionId: string; pausedAt: number }) => {
    console.log(`Session paused: ${data.sessionId} at ${new Date(data.pausedAt).toISOString()}`);

    try {

      socket.emit("session-paused", {
        sessionId: data.sessionId,
        pausedAt: data.pausedAt,
      });
    } catch (error) {
      console.error("session paude error", error);
    }
  });
  socket.on("resume-session", async (data: { sessionId: string; resumedAt: number }) => {
    console.log(
      `▶️ Session resumed: ${data.sessionId} at ${new Date(data.resumedAt).toISOString()}`
    );

    try {
      socket.emit("session-resumed", {
        sessionId: data.sessionId,
        resumedAt: data.resumedAt,
      });
    } catch (error) {
      console.error("failed to resume session", error);
    }
  });


  socket.on("stop-session", async (data: { sessionId: string }) => {
    console.log(`Stopping session: ${data.sessionId}`);

    try {
      const session = await prisma.recordingSession.update({
        where: { id: data.sessionId },
        data: {
          status: "completed",
          endedAt: new Date(),
        },
      });

      console.log(`Session sorted: ${session.id}`);

      socket.emit("session-stopped", {
        sessionId: session.id,
        status: "completed",
        endedAt: session.endedAt,
      });
    } catch (error) {
      console.error("Failed to stop session:", error);
      socket.emit("session-error", {
        sessionId: data.sessionId,
        error: "Failed to stop session",
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("disconnected:", socket.id);
  });
}
