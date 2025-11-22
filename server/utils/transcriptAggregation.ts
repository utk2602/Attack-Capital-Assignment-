import { prisma as db } from "@/lib/db";


export interface TranscriptSegment {
  seq: number;
  text: string;
  speaker?: string | null;
  confidence?: number | null;
  durationMs: number;
  startTime: number; 
  endTime: number; 
}

export interface AggregatedTranscript {
  fullText: string;
  segments: TranscriptSegment[];
  totalDuration: number;
  wordCount: number;
  speakers: string[];
  chunkCount: number;
}

/**
 * Merge chunk transcripts preserving order and calculating timestamps
 *
 * @param sessionId - Recording session ID
 * @returns Aggregated transcript with timing information
 *
 * @example
 * ```typescript
 * const transcript = await mergeChunkTranscripts('session_abc123');
 * console.log(`Full transcript: ${transcript.fullText}`);
 * console.log(`Total speakers: ${transcript.speakers.length}`);
 * ```
 */
export async function mergeChunkTranscripts(sessionId: string): Promise<AggregatedTranscript> {
  const chunks = await db.transcriptChunk.findMany({
    where: {
      sessionId,
      status: "transcribed",
      text: { not: null },
    },
    orderBy: { seq: "asc" },
    select: {
      seq: true,
      text: true,
      speaker: true,
      confidence: true,
      durationMs: true,
    },
  });

  if (chunks.length === 0) {
    return {
      fullText: "",
      segments: [],
      totalDuration: 0,
      wordCount: 0,
      speakers: [],
      chunkCount: 0,
    };
  }
  let cumulativeTime = 0;
  const segments: TranscriptSegment[] = chunks.map((chunk: any) => {
    const startTime = cumulativeTime;
    const endTime = cumulativeTime + chunk.durationMs;
    cumulativeTime = endTime;

    return {
      seq: chunk.seq,
      text: chunk.text || "",
      speaker: chunk.speaker,
      confidence: chunk.confidence,
      durationMs: chunk.durationMs,
      startTime,
      endTime,
    };
  });

  const fullText = segments
    .map((s) => s.text)
    .join(" ")
    .replace(/\s+/g, " ") 
    .trim();

  const wordCount = fullText.split(/\s+/).length;

  const speakers = Array.from(
    new Set(
      segments.map((s) => s.speaker).filter((s): s is string => s !== null && s !== undefined)
    )
  ).sort();

  return {
    fullText,
    segments,
    totalDuration: cumulativeTime,
    wordCount,
    speakers,
    chunkCount: chunks.length,
  };
}

/**
 * Update session with aggregated transcript
 *
 * @param sessionId - Recording session ID
 * @returns Updated session with full transcript
 */
export async function updateSessionTranscript(sessionId: string): Promise<void> {
  const aggregated = await mergeChunkTranscripts(sessionId);

  if (aggregated.chunkCount === 0) {
    console.warn(`[Aggregation] No transcribed chunks found for session: ${sessionId}`);
    return;
  }

  await db.recordingSession.update({
    where: { id: sessionId },
    data: {
      transcript: aggregated.fullText,
      status: "completed",
      summaryJSON: {
        wordCount: aggregated.wordCount,
        speakers: aggregated.speakers,
        totalDuration: aggregated.totalDuration,
        chunkCount: aggregated.chunkCount,
      } as any,
    },
  });

  console.log(
    `[Aggregation] Session updated: ${sessionId}, ${aggregated.wordCount} words, ${aggregated.speakers.length} speakers`
  );
}

/**
 * Get transcript with timestamps for UI display
 * Returns segments with formatted timestamps
 *
 * @param sessionId - Recording session ID
 * @returns Transcript segments with formatted times
 */
export async function getTranscriptWithTimestamps(sessionId: string): Promise<{
  segments: Array<{
    seq: number;
    text: string;
    speaker?: string;
    timeLabel: string;
    confidence?: number;
  }>;
  fullText: string;
}> {
  const aggregated = await mergeChunkTranscripts(sessionId);

  const segments = aggregated.segments.map((seg) => ({
    seq: seg.seq,
    text: seg.text,
    speaker: seg.speaker || undefined,
    timeLabel: `${formatTimestamp(seg.startTime)} - ${formatTimestamp(seg.endTime)}`,
    confidence: seg.confidence || undefined,
  }));

  return {
    segments,
    fullText: aggregated.fullText,
  };
}


function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export async function exportTranscript(
  sessionId: string,
  format: "txt" | "json" | "srt" | "vtt"
): Promise<string> {
  const aggregated = await mergeChunkTranscripts(sessionId);

  switch (format) {
    case "txt":
      return exportAsText(aggregated);
    case "json":
      return exportAsJSON(aggregated);
    case "srt":
      return exportAsSRT(aggregated);
    case "vtt":
      return exportAsVTT(aggregated);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}
 
function exportAsText(transcript: AggregatedTranscript): string {
  return transcript.segments
    .map((seg) => {
      const speaker = seg.speaker ? `[${seg.speaker}] ` : "";
      return `${speaker}${seg.text}`;
    })
    .join("\n\n");
}


function exportAsJSON(transcript: AggregatedTranscript): string {
  return JSON.stringify(transcript, null, 2);
}


function exportAsSRT(transcript: AggregatedTranscript): string {
  return transcript.segments
    .map((seg, index) => {
      const startTime = formatSRTTimestamp(seg.startTime);
      const endTime = formatSRTTimestamp(seg.endTime);
      return `${index + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
    })
    .join("\n");
}

function exportAsVTT(transcript: AggregatedTranscript): string {
  const header = "WEBVTT\n\n";
  const cues = transcript.segments
    .map((seg, index) => {
      const startTime = formatVTTTimestamp(seg.startTime);
      const endTime = formatVTTTimestamp(seg.endTime);
      const speaker = seg.speaker ? `<v ${seg.speaker}>` : "";
      return `${index + 1}\n${startTime} --> ${endTime}\n${speaker}${seg.text}`;
    })
    .join("\n\n");

  return header + cues;
}

function formatSRTTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")},${milliseconds
    .toString()
    .padStart(3, "0")}`;
}


function formatVTTTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds
    .toString()
    .padStart(3, "0")}`;
}

/**
 * Check session transcription progress
 *
 * @param sessionId - Recording session ID
 * @returns Progress information
 */
export async function getTranscriptionProgress(sessionId: string): Promise<{
  total: number;
  transcribed: number;
  processing: number;
  failed: number;
  uploaded: number;
  progress: number;
}> {
  const chunks = await db.transcriptChunk.findMany({
    where: { sessionId },
    select: { status: true },
  });

  const total = chunks.length;
  const statusCounts = chunks.reduce(
    (acc: Record<string, number>, chunk: any) => {
      acc[chunk.status] = (acc[chunk.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const transcribed = statusCounts.transcribed || 0;
  const processing = statusCounts.processing || 0;
  const failed = statusCounts.failed || 0;
  const uploaded = statusCounts.uploaded || 0;

  const progress = total > 0 ? (transcribed / total) * 100 : 0;

  return {
    total,
    transcribed,
    processing,
    failed,
    uploaded,
    progress: Math.round(progress * 100) / 100,
  };
}
