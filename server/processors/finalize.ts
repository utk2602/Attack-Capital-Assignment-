import { prisma as db } from "@/lib/db";
import { mergeChunkTranscripts } from "../utils/transcriptAggregation";
import { refineSpeakerDiarization } from "./diarization";
import { generateSummary } from "./summary";
import { getIO } from "../server";

export async function finalizeSession(sessionId: string): Promise<void> {
  console.log(`[Finalize] Starting finalization: ${sessionId}`);

  const session = await db.recordingSession.findUnique({
    where: { id: sessionId },
    include: { chunks: { select: { status: true } } },
  });

  if (!session) throw new Error(`Session not found: ${sessionId}`);

  await db.recordingSession.update({
    where: { id: sessionId },
    data: { status: "processing" },
  });

  // Only wait for chunks that aren't permanently failed
  const pendingChunks = session.chunks.filter((c) => c.status === "processing");
  const failedChunks = session.chunks.filter((c) => c.status === "failed");
  
  if (pendingChunks.length > 0) {
    console.log(`[Finalize] Waiting for ${pendingChunks.length} pending chunks (${failedChunks.length} failed, skipping)`);
    setTimeout(() => finalizeSession(sessionId), 2000);
    return;
  }
  
  if (failedChunks.length > 0) {
    console.log(`[Finalize] Skipping ${failedChunks.length} failed chunks, proceeding with successful ones`);
  }

  const aggregated = await mergeChunkTranscripts(sessionId);

  if (session.chunks.length >= 5) {
    await refineSpeakerDiarization(sessionId);
  }

  await db.recordingSession.update({
    where: { id: sessionId },
    data: { transcript: aggregated.fullText },
  });

  const summary = await generateSummary(sessionId, aggregated.fullText);

  await db.recordingSession.update({
    where: { id: sessionId },
    data: {
      summaryJSON: summary as any,
      status: "completed",
      endedAt: new Date(),
    },
  });

  const io = getIO();
  io.to(`session:${sessionId}`).emit("session-completed", {
    sessionId,
    transcriptLength: aggregated.fullText.length,
    summary,
    downloadUrl: `/api/sessions/${sessionId}/download`,
  });

  console.log(`[Finalize] Session completed: ${sessionId}`);
}
