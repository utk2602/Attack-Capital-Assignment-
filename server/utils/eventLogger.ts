import { prisma as db } from "@/lib/db";

export type EventType =
  | "start"
  | "pause"
  | "resume"
  | "chunk_upload"
  | "transcription_success"
  | "transcription_fail"
  | "stop";

export async function logSessionEvent(
  sessionId: string,
  type: EventType,
  actorId?: string | null,
  metadata?: Record<string, unknown>
) {
  try {
    await db.recordingEvent.create({
      data: {
        sessionId,
        type,
        actorId: actorId || null,
        metadata: metadata || {},
      },
    });
  } catch (err) {
    console.error("[EventLogger] failed to log event", err);
  }
}
