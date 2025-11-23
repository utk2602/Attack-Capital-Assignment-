/**
 * Transcript Export Utilities
 *
 * Converts transcripts into various formats:
 * - SRT (SubRip Subtitle format)
 * - VTT (WebVTT format)
 * - JSON (structured data)
 * - TXT (plain text)
 */

interface TranscriptSegment {
  seq: number;
  text: string;
  speaker?: string | null;
  startTimeMs?: number;
  endTimeMs?: number;
  confidence?: number;
}

interface SessionTranscript {
  sessionId: string;
  title?: string;
  segments: TranscriptSegment[];
  speakers?: string[];
  summary?: any;
  metadata?: {
    duration?: number;
    createdAt?: string;
    [key: string]: any;
  };
}

/**
 * Format milliseconds as SRT timestamp (HH:MM:SS,mmm)
 */
function formatSRTTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")},${milliseconds.toString().padStart(3, "0")}`;
}

/**
 * Format milliseconds as VTT timestamp (HH:MM:SS.mmm)
 */
function formatVTTTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}

/**
 * Convert transcript to SRT format
 */
export function toSRT(transcript: SessionTranscript): string {
  const lines: string[] = [];

  transcript.segments.forEach((segment, index) => {
    const startMs = segment.startTimeMs || index * 5000;
    const endMs = segment.endTimeMs || startMs + 5000;

    // Sequence number
    lines.push((index + 1).toString());

    // Timestamp
    lines.push(`${formatSRTTimestamp(startMs)} --> ${formatSRTTimestamp(endMs)}`);

    // Text with speaker label
    const text = segment.speaker ? `${segment.speaker}: ${segment.text}` : segment.text;
    lines.push(text);

    // Blank line separator
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Convert transcript to WebVTT format
 */
export function toVTT(transcript: SessionTranscript): string {
  const lines: string[] = ["WEBVTT", ""];

  if (transcript.title) {
    lines.push(`NOTE ${transcript.title}`, "");
  }

  transcript.segments.forEach((segment, index) => {
    const startMs = segment.startTimeMs || index * 5000;
    const endMs = segment.endTimeMs || startMs + 5000;

    // Cue identifier (optional)
    lines.push(`${index + 1}`);

    // Timestamp
    lines.push(`${formatVTTTimestamp(startMs)} --> ${formatVTTTimestamp(endMs)}`);

    // Text with speaker as voice tag
    if (segment.speaker) {
      lines.push(`<v ${segment.speaker}>${segment.text}`);
    } else {
      lines.push(segment.text);
    }

    // Blank line separator
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Convert transcript to JSON format
 */
export function toJSON(transcript: SessionTranscript): string {
  return JSON.stringify(transcript, null, 2);
}

/**
 * Convert transcript to plain text format
 */
export function toPlainText(
  transcript: SessionTranscript,
  options?: {
    includeSpeakers?: boolean;
    includeTimestamps?: boolean;
    includeConfidence?: boolean;
  }
): string {
  const {
    includeSpeakers = true,
    includeTimestamps = false,
    includeConfidence = false,
  } = options || {};

  const lines: string[] = [];

  if (transcript.title) {
    lines.push(transcript.title);
    lines.push("=".repeat(transcript.title.length));
    lines.push("");
  }

  transcript.segments.forEach((segment) => {
    const parts: string[] = [];

    if (includeTimestamps && segment.startTimeMs !== undefined) {
      const timestamp = formatVTTTimestamp(segment.startTimeMs);
      parts.push(`[${timestamp}]`);
    }

    if (includeSpeakers && segment.speaker) {
      parts.push(`${segment.speaker}:`);
    }

    if (includeConfidence && segment.confidence !== undefined) {
      parts.push(`(${(segment.confidence * 100).toFixed(0)}%)`);
    }

    parts.push(segment.text);

    lines.push(parts.join(" "));
  });

  return lines.join("\n");
}

/**
 * Convert transcript to Markdown format
 */
export function toMarkdown(transcript: SessionTranscript): string {
  const lines: string[] = [];

  if (transcript.title) {
    lines.push(`# ${transcript.title}`);
    lines.push("");
  }

  if (transcript.metadata) {
    lines.push("## Metadata");
    lines.push("");
    if (transcript.metadata.createdAt) {
      lines.push(`**Date:** ${new Date(transcript.metadata.createdAt).toLocaleString()}`);
    }
    if (transcript.metadata.duration) {
      const minutes = Math.floor(transcript.metadata.duration / 60);
      const seconds = transcript.metadata.duration % 60;
      lines.push(`**Duration:** ${minutes}m ${seconds}s`);
    }
    if (transcript.speakers && transcript.speakers.length > 0) {
      lines.push(`**Speakers:** ${transcript.speakers.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("## Transcript");
  lines.push("");

  transcript.segments.forEach((segment) => {
    if (segment.speaker) {
      lines.push(`**${segment.speaker}:** ${segment.text}`);
    } else {
      lines.push(segment.text);
    }
    lines.push("");
  });

  if (transcript.summary) {
    lines.push("## Summary");
    lines.push("");

    if (transcript.summary.executiveSummary) {
      lines.push(transcript.summary.executiveSummary);
      lines.push("");
    }

    if (transcript.summary.keyPoints && transcript.summary.keyPoints.length > 0) {
      lines.push("### Key Points");
      lines.push("");
      transcript.summary.keyPoints.forEach((point: string) => {
        lines.push(`- ${point}`);
      });
      lines.push("");
    }

    if (transcript.summary.actionItems && transcript.summary.actionItems.length > 0) {
      lines.push("### Action Items");
      lines.push("");
      transcript.summary.actionItems.forEach((item: any) => {
        lines.push(`- **${item.speaker || "Team"}:** ${item.item}`);
      });
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Export formats enum
 */
export enum ExportFormat {
  SRT = "srt",
  VTT = "vtt",
  JSON = "json",
  TXT = "txt",
  MD = "md",
}

/**
 * Get MIME type for export format
 */
export function getMimeType(format: ExportFormat): string {
  switch (format) {
    case ExportFormat.SRT:
      return "application/x-subrip";
    case ExportFormat.VTT:
      return "text/vtt";
    case ExportFormat.JSON:
      return "application/json";
    case ExportFormat.TXT:
      return "text/plain";
    case ExportFormat.MD:
      return "text/markdown";
    default:
      return "text/plain";
  }
}

/**
 * Export transcript in specified format
 */
export function exportTranscript(
  transcript: SessionTranscript,
  format: ExportFormat,
  options?: any
): string {
  switch (format) {
    case ExportFormat.SRT:
      return toSRT(transcript);
    case ExportFormat.VTT:
      return toVTT(transcript);
    case ExportFormat.JSON:
      return toJSON(transcript);
    case ExportFormat.TXT:
      return toPlainText(transcript, options);
    case ExportFormat.MD:
      return toMarkdown(transcript);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
