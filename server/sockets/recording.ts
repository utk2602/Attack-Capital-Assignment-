import { Server, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Setup Socket.io event handlers for recording sessions
 * @param io - Socket.io server instance
 * @param socket - Client socket connection
 */
export function setupRecordingSockets(io: Server, socket: Socket) {
  /**
   * Handle start recording event
   */
  socket.on("start-recording", (data: { sessionId: string; source: "mic" | "tab" }) => {
    console.log(`🎙️ Recording started for session: ${data?.sessionId}, source: ${data?.source}`);
    // TODO: Initialize Gemini stream
    socket.emit("status", { status: "recording", sessionId: data?.sessionId });
  });

  /**
   * Handle audio chunk streaming
   */
  socket.on("audio-chunk", (chunk: { sessionId: string; data: ArrayBuffer; timestamp: number }) => {
    // console.log("📦 Received audio chunk");
    // TODO: Stream to Gemini API for transcription
    // For now, just acknowledge receipt
    socket.emit("chunk-received", { timestamp: chunk.timestamp });
  });

  /**
   * Handle pause recording event
   */
  socket.on("pause-recording", (data: { sessionId: string }) => {
    console.log(`⏸️ Recording paused for session: ${data?.sessionId}`);
    socket.emit("status", { status: "paused", sessionId: data?.sessionId });
  });

  /**
   * Handle resume recording event
   */
  socket.on("resume-recording", (data: { sessionId: string }) => {
    console.log(`▶️ Recording resumed for session: ${data?.sessionId}`);
    socket.emit("status", { status: "recording", sessionId: data?.sessionId });
  });

  /**
   * Handle chunk stored locally
   */
  socket.on(
    "chunk-stored",
    async (data: { sessionId: string; seq: number; path: string; durationMs: number }) => {
      try {
        console.log(`💾 Chunk stored: session=${data.sessionId}, seq=${data.seq}`);

        // Create TranscriptChunk in database
        await prisma.transcriptChunk.create({
          data: {
            sessionId: data.sessionId,
            seq: data.seq,
            audioPath: data.path,
            durationMs: data.durationMs,
            status: "uploaded",
          },
        });

        // TODO: Trigger transcription processing (Gemini API)
        socket.emit("chunk-processed", { sessionId: data.sessionId, seq: data.seq });
      } catch (error) {
        console.error("Error storing chunk metadata:", error);
        socket.emit("error", { message: "Failed to store chunk metadata" });
      }
    }
  );

  /**
   * Handle stop recording event
   */
  socket.on("stop-recording", async (data: { sessionId: string }) => {
    try {
      console.log(`⏹️ Recording stopped for session: ${data?.sessionId}`);
      socket.emit("status", { status: "processing", sessionId: data?.sessionId });

      // TODO: Update session status in database
      // TODO: Aggregate all chunks, transcribe with Gemini, generate summary
      // Simulate processing delay
      setTimeout(() => {
        socket.emit("status", { status: "completed", sessionId: data?.sessionId });
        socket.emit("transcript-ready", {
          sessionId: data?.sessionId,
          summary:
            "Meeting summary placeholder: This is where the AI-generated summary will appear with key points, action items, and decisions.",
          transcript:
            "Full transcript placeholder: This will contain the complete transcription of the audio session.",
          duration: 0,
          createdAt: new Date().toISOString(),
        });
      }, 2000);
    } catch (error) {
      console.error("Error stopping recording:", error);
      socket.emit("error", { message: "Failed to stop recording" });
    }
  });
}
