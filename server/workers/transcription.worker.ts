import { transcriptionQueue } from "../queues/simple-queue";
import { prisma as db } from "@/lib/db";
import { convertToWav } from "../utils/ffmpeg";
import { gemini } from "@/lib/gemini";
import fs from "fs/promises";
import path from "path";
import { chunkLogger, sessionLogger } from "../utils/logger";
import { getIO } from "../server";

/**
 * Transcription worker that processes audio chunks from the queue
 * Handles conversion, transcription, and database updates
 */

interface TranscriptionJobData {
  sessionId: string;
  sequence: number;
}

/**
 * Initialize the transcription worker
 * Sets up job processing handler
 */
export function initializeTranscriptionWorker() {
  console.log("[Worker] Initializing transcription worker...");

  transcriptionQueue.process(async (job) => {
    const { sessionId, sequence } = job.data;

    try {
      await processTranscription(sessionId, sequence);
    } catch (error) {
      console.error(`[Worker] Failed to process chunk ${sessionId}/${sequence}:`, error);
      throw error; // Re-throw to trigger retry
    }
  });

  console.log("[Worker] Transcription worker initialized with queue processing");
}

/**
 * Add a chunk to the transcription queue
 */
export async function queueTranscription(sessionId: string, sequence: number): Promise<string> {
  const jobId = await transcriptionQueue.add({
    sessionId,
    sequence,
  });

  console.log(`[Worker] Queued transcription: session=${sessionId}, seq=${sequence}, job=${jobId}`);

  return jobId;
}

/**
 * Main transcription processing function
 *
 * Orchestrates the transcription pipeline for a single audio chunk:
 * 1. Retrieves chunk metadata from database
 * 2. Converts audio format (WebM -> WAV)
 * 3. Calls Gemini API for transcription
 * 4. Updates database with transcript text and confidence
 * 5. Emits socket events to notify clients
 *
 * @param sessionId - ID of the parent RecordingSession
 * @param sequence - Sequential index of the chunk in the session
 * @throws {Error} If chunk not found, conversion fails, or API errors
 */
async function processTranscription(sessionId: string, sequence: number): Promise<void> {
  const startTime = Date.now();

  console.log(`[Worker] Starting transcription: session=${sessionId}, seq=${sequence}`);

  // Step 1: Fetch chunk record by sessionId and sequence
  const chunk = await db.transcriptChunk.findFirst({
    where: {
      sessionId: sessionId,
      seq: sequence,
    },
    include: { session: true },
  });

  if (!chunk) {
    throw new Error(`Chunk not found: ${sessionId}/${sequence}`);
  }

  // Step 2: Update status to processing
  await db.transcriptChunk.update({
    where: { id: chunk.id },
    data: { status: "processing" },
  });

  try {
    // Step 3: Convert WebM to WAV
    console.log(`[Worker] Converting audio: ${chunk.audioPath}`);
    const conversionStart = Date.now();

    const wavPath = chunk.audioPath.replace(".webm", ".wav");
    const conversionResult = await convertToWav(chunk.audioPath, wavPath, {
      sampleRate: 16000,
      channels: 1,
      applyFilters: false, // Disable filters for speed, enable if quality issues
      deleteSource: false, // Keep WebM for backup
    });

    const conversionTime = Date.now() - conversionStart;
    console.log(`[Worker] Conversion completed in ${conversionTime}ms: ${wavPath}`);

    // Step 4: Get previous context for continuity
    const previousContext = await getPreviousContext(sessionId, sequence);

    // Step 5: Transcribe with Gemini
    console.log(`[Worker] Calling Gemini API for transcription...`);
    const transcriptionStart = Date.now();

    const enableDiarization = process.env.ENABLE_SPEAKER_DIARIZATION === "true";

    const result = await gemini.transcribeChunk(sessionId, sequence, wavPath, {
      previousContext,
      enableDiarization,
      languageHint: "en-US",
      temperature: 0.1,
    });

    const transcriptionTime = Date.now() - transcriptionStart;
    console.log(
      `[Worker] Transcription completed in ${transcriptionTime}ms: ${result.text.length} chars`
    );

    // Step 6: Update database with results
    await db.transcriptChunk.update({
      where: { id: chunk.id },
      data: {
        text: result.text,
        speaker: result.speakers?.[0] || null,
        confidence: result.confidence || null,
        status: "transcribed",
      },
    });

    // Step 7: Log success
    const totalTime = Date.now() - startTime;
    chunkLogger.processed(sessionId, sequence, result.text.length, {
      sessionId,
      sequence,
      chunkId: chunk.id,
      processingTimeMs: totalTime,
      audioPath: chunk.audioPath,
    });

    console.log(
      `[Worker] Chunk processed successfully: chunk=${chunk.id}, total=${totalTime}ms (conversion=${conversionTime}ms, transcription=${transcriptionTime}ms)`
    );

    emitTranscriptUpdate(sessionId, {
      sequence,
      text: result.text,
      speaker: result.speakers?.[0],
      chunkId: chunk.id,
    });

    // Step 8: Cleanup temporary WAV file
    try {
      await fs.unlink(wavPath);
      console.log(`[Worker] Cleaned up WAV file: ${wavPath}`);
    } catch (cleanupError) {
      console.warn(`[Worker] Failed to cleanup WAV file: ${wavPath}`);
    }

    // Step 9: Check if session is complete and aggregate
    await checkAndAggregateSession(sessionId);
  } catch (error) {
    // Update status to failed
    await db.transcriptChunk.update({
      where: { id: chunk.id },
      data: {
        status: "failed",
        // Store error message if schema supports it
      },
    });

    chunkLogger.error({
      sessionId,
      sequence,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * Get previous transcript context for continuity
 * Returns last 50 words from previous chunks
 */
async function getPreviousContext(
  sessionId: string,
  currentSeq: number
): Promise<string | undefined> {
  const contextWords = parseInt(process.env.TRANSCRIPTION_CONTEXT_WORDS || "50", 10);

  // Fetch previous transcribed chunks
  const previousChunks = await db.transcriptChunk.findMany({
    where: {
      sessionId,
      seq: { lt: currentSeq },
      status: "transcribed",
      text: { not: null },
    },
    orderBy: { seq: "desc" },
    take: 3, // Get last 3 chunks for context
    select: { text: true, seq: true },
  });

  if (previousChunks.length === 0) {
    return undefined;
  }

  // Concatenate and take last N words
  const fullContext = previousChunks
    .reverse()
    .map((c) => c.text)
    .join(" ");

  const words = fullContext.split(/\s+/);
  const contextWordsList = words.slice(-contextWords);

  const context = contextWordsList.join(" ");
  console.log(`[Worker] Context from previous chunks: ${context.substring(0, 100)}...`);

  return context;
}

/**
 * Check if all chunks are transcribed and aggregate into session transcript
 */
async function checkAndAggregateSession(sessionId: string): Promise<void> {
  const session = await db.recordingSession.findUnique({
    where: { id: sessionId },
    include: {
      chunks: {
        orderBy: { seq: "asc" },
        select: { seq: true, text: true, status: true },
      },
    },
  });

  if (!session) {
    return;
  }

  // Check if all chunks are transcribed
  const totalChunks = session.chunks.length;
  const transcribedChunks = session.chunks.filter(
    (c) => c.status === "transcribed" && c.text
  ).length;

  console.log(`[Worker] Session progress: ${transcribedChunks}/${totalChunks} chunks transcribed`);

  // If all chunks are transcribed, aggregate
  if (transcribedChunks === totalChunks && totalChunks > 0) {
    const fullTranscript = session.chunks
      .filter((c) => c.text)
      .map((c) => c.text)
      .join(" ");

    await db.recordingSession.update({
      where: { id: sessionId },
      data: {
        transcript: fullTranscript,
        status: "completed",
      },
    });

    sessionLogger.completed({
      sessionId,
      totalChunks,
      durationSeconds: Math.floor(
        (session.endedAt?.getTime() || Date.now() - (session.startedAt?.getTime() || 0)) / 1000
      ),
    });

    console.log(
      `[Worker] Session aggregated: ${sessionId}, transcript length: ${fullTranscript.length} chars`
    );
  }
}

/**
 * Get transcription queue statistics
 */
export function getQueueStats() {
  return transcriptionQueue.getStats();
}

/**
 * Retry all failed jobs in the queue
 */
export function retryFailedJobs() {
  transcriptionQueue.retryFailedJobs();
  console.log("[Worker] Retrying all failed jobs");
}

function emitTranscriptUpdate(
  sessionId: string,
  data: {
    sequence: number;
    text: string;
    speaker?: string;
    chunkId: string;
  }
) {
  const io = getIO();
  io.to(`session:${sessionId}`).emit("transcript-updated", {
    sessionId,
    sequence: data.sequence,
    text: data.text,
    speaker: data.speaker,
    chunkId: data.chunkId,
    timestamp: Date.now(),
  });
}
