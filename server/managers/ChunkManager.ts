import { Socket } from "socket.io";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { chunkLogger } from "../utils/logger";
import { sessionManager } from "./SessionManager";
const prisma = new PrismaClient();
export interface ChunkData {
  sessionId: string;
  sequence: number;
  timestamp: number;
  audioData: Buffer;
  mimeType: string;
}
export interface ChunkMetadata {
  sequence: number;
  timestamp: number;
  receivedAt: number;
  processingTime: number;
  bytesReceived: number;
}

export class ChunkManager {
  private static instance: ChunkManager;

  private constructor() {}

  static getInstance(): ChunkManager {
    if (!ChunkManager.instance) {
      ChunkManager.instance = new ChunkManager();
    }
    return ChunkManager.instance;
  }

  async processChunk(data: ChunkData, socket: Socket): Promise<ChunkMetadata> {
    const startTime = Date.now();

    try {
      chunkLogger.received({
        sessionId: data.sessionId,
        sequence: data.sequence,
        userId: "system",
        size: data.audioData.length,
        durationMs: 30000,
        mimeType: data.mimeType,
      });
      const session = await sessionManager.getSession(data.sessionId);
      if (!session) {
        throw new Error(`Session ${data.sessionId} not found`);
      }
      if (session.status !== "recording" && session.status !== "completed") {
        throw new Error(
          `Session ${data.sessionId} is in ${session.status} state, cannot accept chunks`
        );
      }

      if (session.status === "completed") {
        console.log(
          `[ChunkManager] Accepting late chunk for completed session: ${data.sessionId}/${data.sequence}`
        );
      }
      const existingChunk = await prisma.transcriptChunk.findFirst({
        where: {
          sessionId: data.sessionId,
          seq: data.sequence,
        },
      });

      if (existingChunk) {
        console.log(`[Idempotency] Duplicate chunk: ${data.sessionId}/${data.sequence}`);

        const metadata: ChunkMetadata = {
          sequence: data.sequence,
          timestamp: data.timestamp,
          receivedAt: startTime,
          processingTime: Date.now() - startTime,
          bytesReceived: data.audioData.length,
        };

        socket.emit("chunk-ack", {
          sessionId: data.sessionId,
          ...metadata,
          duplicate: true,
        });

        return metadata;
      }

      const sessionDir = sessionManager.getSessionDirectory(data.sessionId);
      const filename = `${data.sessionId}_${data.sequence.toString().padStart(4, "0")}.webm`;
      const audioPath = path.join(sessionDir, filename);

      await fs.promises.writeFile(audioPath, data.audioData);
      await prisma.transcriptChunk.create({
        data: {
          sessionId: data.sessionId,
          seq: data.sequence,
          audioPath,
          durationMs: 30000,
          status: "uploaded",
        },
      });

      const processingTime = Date.now() - startTime;

      chunkLogger.processed(data.sessionId, data.sequence, data.audioData.length, {
        sessionId: data.sessionId,
        sequence: data.sequence,
        chunkId: `${data.sessionId}_${data.sequence}`,
        processingTimeMs: processingTime,
        audioPath,
      });

      const metadata: ChunkMetadata = {
        sequence: data.sequence,
        timestamp: data.timestamp,
        receivedAt: startTime,
        processingTime,
        bytesReceived: data.audioData.length,
      };

      return metadata;
    } catch (error) {
      chunkLogger.error({
        sessionId: data.sessionId,
        sequence: data.sequence,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  async getSessionChunks(sessionId: string) {
    return await prisma.transcriptChunk.findMany({
      where: { sessionId },
      orderBy: { seq: "asc" },
    });
  }

  async getChunkCount(sessionId: string): Promise<number> {
    return await prisma.transcriptChunk.count({
      where: { sessionId },
    });
  }

  async verifyChunkSequence(
    sessionId: string
  ): Promise<{ valid: boolean; missingSequences: number[] }> {
    const chunks = await this.getSessionChunks(sessionId);
    const sequences = chunks.map((c: any) => c.seq).sort((a: number, b: number) => a - b);

    const missingSequences: number[] = [];
    for (let i = 0; i < sequences.length - 1; i++) {
      const current = sequences[i];
      const next = sequences[i + 1];

      for (let missing = current + 1; missing < next; missing++) {
        missingSequences.push(missing);
      }
    }

    return {
      valid: missingSequences.length === 0,
      missingSequences,
    };
  }
}

export const chunkManager = ChunkManager.getInstance();
