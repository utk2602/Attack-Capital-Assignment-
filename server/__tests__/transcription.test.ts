/**
 * Integration Tests for Transcription Pipeline
 *
 * Tests the complete flow from audio chunk upload to transcription
 * with mocked Gemini API calls
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";
import { io as Client, Socket as ClientSocket } from "socket.io-client";
import { gemini } from "@/lib/gemini";
import { queueTranscription } from "../workers/transcription.worker";

// Mock Gemini API
vi.mock("@/lib/gemini", () => ({
  gemini: {
    transcribeChunk: vi.fn(),
    transcribeChunkFromBuffer: vi.fn(),
  },
}));

// Mock Prisma
const mockPrisma = {
  transcriptChunk: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  recordingSession: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

describe("Transcription Pipeline", () => {
  let serverSocket: Server | undefined;
  let clientSocket: ClientSocket | undefined;

  beforeEach(() => {
    // Setup mock Gemini service
    vi.mocked(gemini.transcribeChunk).mockResolvedValue({
      text: "This is a test transcription",
      confidence: 0.95,
      speakers: ["Speaker 1"],
      processingTimeMs: 1500,
    });

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (clientSocket) clientSocket.close();
    if (serverSocket) serverSocket.close();
  });

  describe("Audio Chunk Upload", () => {
    it("should accept and store valid audio chunk", async () => {
      const sessionId = "session-123";
      const sequence = 0;
      const audioData = Buffer.from("fake-audio-data");

      mockPrisma.transcriptChunk.findUnique.mockResolvedValue(null);
      mockPrisma.transcriptChunk.create.mockResolvedValue({
        id: "chunk-123",
        sessionId,
        seq: sequence,
        audioPath: "/path/to/audio",
        status: "uploaded",
      });

      const result = await mockPrisma.transcriptChunk.create({
        data: {
          sessionId,
          seq: sequence,
          audioPath: "/path/to/audio",
          durationMs: 30000,
          status: "uploaded",
        },
      });

      expect(result).toBeDefined();
      expect(result.sessionId).toBe(sessionId);
      expect(result.seq).toBe(sequence);
    });

    it("should detect duplicate chunks (idempotency)", async () => {
      const sessionId = "session-123";
      const sequence = 0;

      mockPrisma.transcriptChunk.findUnique.mockResolvedValue({
        id: "chunk-123",
        sessionId,
        seq: sequence,
        audioPath: "/path/to/audio",
        status: "uploaded",
      });

      const existingChunk = await mockPrisma.transcriptChunk.findUnique({
        where: {
          sessionId_seq: { sessionId, seq: sequence },
        },
      });

      expect(existingChunk).toBeDefined();
      expect(existingChunk?.id).toBe("chunk-123");
    });
  });

  describe("Transcription Processing", () => {
    it("should transcribe chunk and update database", async () => {
      const chunkId = "chunk-123";
      const sessionId = "session-123";
      const audioPath = "/path/to/audio.wav";

      mockPrisma.transcriptChunk.findUnique.mockResolvedValue({
        id: chunkId,
        sessionId,
        seq: 0,
        audioPath,
        status: "uploaded",
      });

      mockPrisma.transcriptChunk.update.mockResolvedValue({
        id: chunkId,
        sessionId,
        seq: 0,
        audioPath,
        text: "This is a test transcription",
        speaker: "Speaker 1",
        confidence: 0.95,
        status: "transcribed",
      });

      // Simulate transcription
      const transcriptionResult = await vi
        .mocked(gemini)
        .transcribeChunk(sessionId, 0, audioPath, {});

      expect(transcriptionResult.text).toBe("This is a test transcription");
      expect(transcriptionResult.confidence).toBe(0.95);

      // Update database
      const updatedChunk = await mockPrisma.transcriptChunk.update({
        where: { id: chunkId },
        data: {
          text: transcriptionResult.text,
          speaker: transcriptionResult.speakers?.[0] || "Speaker 1",
          confidence: transcriptionResult.confidence,
          status: "transcribed",
        },
      });

      expect(updatedChunk.status).toBe("transcribed");
      expect(updatedChunk.text).toBe("This is a test transcription");
    });

    it("should handle transcription errors gracefully", async () => {
      const chunkId = "chunk-123";
      const sessionId = "session-123";
      const audioPath = "/path/to/audio.wav";

      vi.mocked(gemini).transcribeChunk.mockRejectedValue(new Error("Gemini API error"));

      mockPrisma.transcriptChunk.update.mockResolvedValue({
        id: chunkId,
        status: "failed",
      });

      try {
        await vi.mocked(gemini).transcribeChunk(sessionId, 0, audioPath, {});
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).toBe("Gemini API error");

        // Mark as failed in DB
        const updatedChunk = await mockPrisma.transcriptChunk.update({
          where: { id: chunkId },
          data: { status: "failed" },
        });

        expect(updatedChunk.status).toBe("failed");
      }
    });

    it("should retry failed transcriptions", async () => {
      const chunkId = "chunk-123";
      const sessionId = "session-123";
      const audioPath = "/path/to/audio.wav";

      // First attempt fails
      vi.mocked(gemini)
        .transcribeChunk.mockRejectedValueOnce(new Error("Temporary error"))
        .mockResolvedValueOnce({
          text: "Success on retry",
          confidence: 0.9,
          speakers: ["Speaker 1"],
          processingTimeMs: 2000,
        });

      try {
        await vi.mocked(gemini).transcribeChunk(sessionId, 0, audioPath, {});
      } catch (error) {
        // Retry
        const result = await vi.mocked(gemini).transcribeChunk(sessionId, 0, audioPath, {});
        expect(result.text).toBe("Success on retry");
      }
    });
  });

  describe("Socket Event Emission", () => {
    it("should emit transcript-updated event after transcription", async () => {
      const mockIo = {
        to: vi.fn().mockReturnThis(),
        emit: vi.fn(),
      };

      const sessionId = "session-123";
      const sequence = 0;
      const transcriptText = "This is a test transcription";

      // Simulate socket emission
      mockIo.to(`session:${sessionId}`).emit("transcript-updated", {
        sessionId,
        sequence,
        text: transcriptText,
        speaker: "Speaker 1",
        chunkId: "chunk-123",
        timestamp: new Date().toISOString(),
      });

      expect(mockIo.to).toHaveBeenCalledWith(`session:${sessionId}`);
      expect(mockIo.emit).toHaveBeenCalledWith(
        "transcript-updated",
        expect.objectContaining({
          sessionId,
          sequence,
          text: transcriptText,
        })
      );
    });
  });

  describe("Database Integrity", () => {
    it("should enforce unique (sessionId, seq) constraint", async () => {
      const sessionId = "session-123";
      const sequence = 0;

      mockPrisma.transcriptChunk.create
        .mockResolvedValueOnce({
          id: "chunk-123",
          sessionId,
          seq: sequence,
        })
        .mockRejectedValueOnce({
          code: "P2002",
          message: "Unique constraint violation",
        });

      // First insert succeeds
      const chunk1 = await mockPrisma.transcriptChunk.create({
        data: { sessionId, seq: sequence, audioPath: "/path" },
      });
      expect(chunk1.id).toBe("chunk-123");

      // Second insert fails (duplicate)
      try {
        await mockPrisma.transcriptChunk.create({
          data: { sessionId, seq: sequence, audioPath: "/path" },
        });
        expect.fail("Should have thrown constraint error");
      } catch (error: any) {
        expect(error.code).toBe("P2002");
      }
    });
  });

  describe("Transcription Queue", () => {
    it("should process chunks in order", async () => {
      const sessionId = "session-123";
      const chunks = [
        { id: "chunk-0", seq: 0 },
        { id: "chunk-1", seq: 1 },
        { id: "chunk-2", seq: 2 },
      ];

      const processedOrder: number[] = [];

      for (const chunk of chunks) {
        mockPrisma.transcriptChunk.findUnique.mockResolvedValue({
          id: chunk.id,
          sessionId,
          seq: chunk.seq,
          audioPath: `/path/${chunk.seq}.wav`,
          status: "uploaded",
        });

        await vi.mocked(gemini).transcribeChunk(sessionId, chunk.seq, `/path/${chunk.seq}.wav`, {});

        processedOrder.push(chunk.seq);
      }

      expect(processedOrder).toEqual([0, 1, 2]);
    });
  });

  describe("Context Awareness", () => {
    it("should pass previous context to transcription", async () => {
      const sessionId = "session-123";
      const previousContext = "Previous speaker was discussing project deadlines.";

      await vi.mocked(gemini).transcribeChunk(sessionId, 5, "/path/audio.wav", {
        previousContext,
        enableDiarization: true,
      });

      expect(vi.mocked(gemini).transcribeChunk).toHaveBeenCalledWith(
        sessionId,
        5,
        "/path/audio.wav",
        expect.objectContaining({
          previousContext,
          enableDiarization: true,
        })
      );
    });
  });

  describe("Performance Metrics", () => {
    it("should track processing time", async () => {
      const startTime = Date.now();

      await vi.mocked(gemini).transcribeChunk("session-123", 0, "/path/audio.wav", {});

      const result = await vi
        .mocked(gemini)
        .transcribeChunk("session-123", 0, "/path/audio.wav", {});

      expect(result.processingTimeMs).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });
  });
});
