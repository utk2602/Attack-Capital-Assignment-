import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { sessionLogger } from "../utils/logger";

const prisma = new PrismaClient();
const STORAGE_DIR = path.join(process.cwd(), "storage", "audio-chunks");

export interface SessionConfig {
  sessionId: string;
  userId: string;
  title?: string;
  source: "mic" | "tab";
}

export interface SessionInfo {
  id: string;
  userId: string;
  title: string;
  status: string;
  startedAt: Date;
}


export class SessionManager {
  private static instance: SessionManager;

  private constructor() {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  async createSession(config: SessionConfig): Promise<SessionInfo> {
    sessionLogger.started({
      sessionId: config.sessionId,
      userId: config.userId,
      source: config.source,
      title: config.title,
    });
    const sessionDir = path.join(STORAGE_DIR, config.sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    const session = await prisma.recordingSession.create({
      data: {
        id: config.sessionId,
        userId: config.userId,
        title: config.title || `Recording - ${new Date().toLocaleString()}`,
        status: "recording",
        startedAt: new Date(),
      },
    });

    return {
      id: session.id,
      userId: session.userId,
      title: session.title || `Recording - ${new Date().toLocaleString()}`,
      status: session.status,
      startedAt: session.startedAt,
    };
  }

  async getSession(sessionId: string) {
    return await prisma.recordingSession.findUnique({
      where: { id: sessionId },
      include: {
        chunks: {
          orderBy: { seq: "asc" },
        },
      },
    });
  }
  async verifySession(sessionId: string, userId: string): Promise<boolean> {
    const session = await prisma.recordingSession.findFirst({
      where: {
        id: sessionId,
        userId: userId,
      },
    });
    return !!session;
  }
  async pauseSession(sessionId: string) {
    sessionLogger.paused({
      sessionId,
      pausedAt: Date.now(),
    });

    return await prisma.recordingSession.update({
      where: { id: sessionId },
      data: {
        status: "paused",
      },
    });
  }
  async resumeSession(sessionId: string) {
    sessionLogger.resumed({
      sessionId,
      resumedAt: Date.now(),
    });

    return await prisma.recordingSession.update({
      where: { id: sessionId },
      data: {
        status: "recording",
      },
    });
  }
  async completeSession(sessionId: string, userId: string) {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    sessionLogger.completed({
      sessionId,
      userId,
      totalChunks: session.chunks.length,
    });

    return await prisma.recordingSession.update({
      where: { id: sessionId },
      data: {
        status: "completed",
      },
    });
  }
  getSessionDirectory(sessionId: string): string {
    return path.join(STORAGE_DIR, sessionId);
  }
  sessionDirectoryExists(sessionId: string): boolean {
    return fs.existsSync(this.getSessionDirectory(sessionId));
  }
  async cleanupSession(sessionId: string) {
    const sessionDir = this.getSessionDirectory(sessionId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  }
}

export const sessionManager = SessionManager.getInstance();
