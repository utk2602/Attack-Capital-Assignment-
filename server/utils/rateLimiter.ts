import { Socket } from "socket.io";
import { prisma as db } from "@/lib/db";
const MAX_CONCURRENT_SESSIONS_PER_USER = 2;
const MAX_SESSIONS_PER_DAY = 10;
const SESSION_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

const activeSessions = new Map<string, Set<string>>(); // userId -> Set<sessionId>

export class RateLimitError extends Error {
  constructor(
    message: string,
    public code: "CONCURRENT_LIMIT" | "DAILY_LIMIT" | "UNAUTHORIZED"
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * @throws RateLimitError if limits exceeded
 */
export async function checkSessionRateLimit(userId: string): Promise<void> {
  const userActiveSessions = activeSessions.get(userId);
  if (userActiveSessions && userActiveSessions.size >= MAX_CONCURRENT_SESSIONS_PER_USER) {
    throw new RateLimitError(
      `Maximum concurrent sessions (${MAX_CONCURRENT_SESSIONS_PER_USER}) exceeded`,
      "CONCURRENT_LIMIT"
    );
  }
  const cutoffTime = new Date(Date.now() - SESSION_LIMIT_WINDOW_MS);
  const recentSessions = await db.recordingSession.count({
    where: {
      userId,
      startedAt: {
        gte: cutoffTime,
      },
    },
  });

  if (recentSessions >= MAX_SESSIONS_PER_DAY) {
    throw new RateLimitError(
      `Daily session limit (${MAX_SESSIONS_PER_DAY}) exceeded. Try again in 24 hours.`,
      "DAILY_LIMIT"
    );
  }
}

export function registerActiveSession(userId: string, sessionId: string): void {
  if (!activeSessions.has(userId)) {
    activeSessions.set(userId, new Set());
  }
  activeSessions.get(userId)!.add(sessionId);

  console.log(`[RateLimit] Active sessions for ${userId}: ${activeSessions.get(userId)!.size}`);
}

export function unregisterActiveSession(userId: string, sessionId: string): void {
  const userSessions = activeSessions.get(userId);
  if (userSessions) {
    userSessions.delete(sessionId);
    if (userSessions.size === 0) {
      activeSessions.delete(userId);
    }
  }

  console.log(`[RateLimit] Active sessions for ${userId}: ${userSessions?.size || 0}`);
}

export function getActiveSessionCount(userId: string): number {
  return activeSessions.get(userId)?.size || 0;
}

export async function verifySessionOwnership(sessionId: string, userId: string): Promise<boolean> {
  const session = await db.recordingSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });

  return session?.userId === userId;
}

export async function authenticateSocket(socket: Socket): Promise<string | null> {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      console.warn(`[Auth] No token provided for socket ${socket.id}`);
      return null;
    }


    const userId = await validateAuthToken(token as string);

    if (!userId) {
      console.warn(`[Auth] Invalid token for socket ${socket.id}`);
      return null;
    }
    socket.data.userId = userId;

    console.log(`[Auth] Socket ${socket.id} authenticated as ${userId}`);
    return userId;
  } catch (error) {
    console.error(`[Auth] Error authenticating socket:`, error);
    return null;
  }
}

/**
 * Validate authentication token (integrate with Better Auth)
 * @returns userId if valid, null otherwise
 */
async function validateAuthToken(token: string): Promise<string | null> {
  try {
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return session.userId;
  } catch (error) {
    console.error("[Auth] Token validation error:", error);
    return null;
  }
}

export class ChunkRateLimiter {
  private chunkCounts = new Map<string, { count: number; resetAt: number }>();
  private readonly maxChunksPerWindow = 150; // ~75 minutes at 30s chunks
  private readonly windowMs = 60 * 60 * 1000; // 1 hour

  canAcceptChunk(sessionId: string): boolean {
    const now = Date.now();
    const record = this.chunkCounts.get(sessionId);

    if (!record || now > record.resetAt) {
      // Reset window
      this.chunkCounts.set(sessionId, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return true;
    }

    if (record.count >= this.maxChunksPerWindow) {
      return false;
    }

    record.count++;
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [sessionId, record] of this.chunkCounts.entries()) {
      if (now > record.resetAt) {
        this.chunkCounts.delete(sessionId);
      }
    }
  }
}

export const chunkRateLimiter = new ChunkRateLimiter();
setInterval(
  () => {
    chunkRateLimiter.cleanup();
  },
  10 * 60 * 1000
);
