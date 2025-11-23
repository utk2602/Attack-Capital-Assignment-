import { z } from "zod";
export const SpeakerSegmentSchema = z.object({
  seq: z.number().int().nonnegative(),
  speaker: z.string().nullable(),
  text: z.string(),
  timestamp: z.string().datetime().optional(),
  startTimeMs: z.number().int().nonnegative().optional(),
  endTimeMs: z.number().int().nonnegative().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

export type SpeakerSegment = z.infer<typeof SpeakerSegmentSchema>;

export const TranscriptEventSchema = z.object({
  sessionId: z.string().uuid(),
  seq: z.number().int().nonnegative(),
  chunkId: z.string().uuid(),
  speaker: z.string().nullable(),
  text: z.string(),
  timestamp: z.string().datetime(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  status: z.enum(["transcribing", "completed", "failed"]),
});

export type TranscriptEvent = z.infer<typeof TranscriptEventSchema>;

export const ActionItemSchema = z.object({
  speaker: z.string(),
  item: z.string(),
  timestamp: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.string().datetime().optional(),
});

export type ActionItem = z.infer<typeof ActionItemSchema>;


export const DecisionSchema = z.object({
  decision: z.string(),
  timestamp: z.string().optional(),
  participants: z.array(z.string()).optional(),
  rationale: z.string().optional(),
});

export type Decision = z.infer<typeof DecisionSchema>;


export const KeyTimestampSchema = z.object({
  time: z.string(),
  event: z.string(),
  importance: z.enum(["low", "medium", "high"]).optional(),
});

export type KeyTimestamp = z.infer<typeof KeyTimestampSchema>;

export const SummaryJSONSchema = z.object({
  executiveSummary: z.string(),
  keyPoints: z.array(z.string()),
  actionItems: z.array(ActionItemSchema),
  decisions: z.array(DecisionSchema),
  keyTimestamps: z.array(KeyTimestampSchema),
  duration: z.string(),
  participantCount: z.number().int().nonnegative(),
  topics: z.array(z.string()).optional(),
  sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
  nextSteps: z.array(z.string()).optional(),
});

export type SummaryJSON = z.infer<typeof SummaryJSONSchema>;

export const SpeakerInfoSchema = z.object({
  id: z.string(),
  label: z.string(),
  segmentCount: z.number().int().nonnegative(),
  totalDurationMs: z.number().int().nonnegative().optional(),
  customName: z.string().optional(),
});

export type SpeakerInfo = z.infer<typeof SpeakerInfoSchema>;


export const SessionTranscriptSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string(),
  title: z.string(),
  status: z.enum(["recording", "paused", "stopped", "processing", "completed", "failed"]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  durationMs: z.number().int().nonnegative().optional(),
  segments: z.array(SpeakerSegmentSchema),
  speakers: z.array(SpeakerInfoSchema),
  fullTranscript: z.string().optional(),
  summary: SummaryJSONSchema.optional(),
  metadata: z
    .object({
      chunkCount: z.number().int().nonnegative(),
      audioFormat: z.string().optional(),
      averageConfidence: z.number().min(0).max(1).optional(),
      processingTimeMs: z.number().int().nonnegative().optional(),
      transcriptionEngine: z.string().optional(),
    })
    .optional(),
});

export type SessionTranscript = z.infer<typeof SessionTranscriptSchema>;

export function validateSpeakerSegment(data: unknown): SpeakerSegment {
  return SpeakerSegmentSchema.parse(data);
}

export function validateTranscriptEvent(data: unknown): TranscriptEvent {
  return TranscriptEventSchema.parse(data);
}

export function validateSummaryJSON(data: unknown): SummaryJSON {
  return SummaryJSONSchema.parse(data);
}

export function validateSessionTranscript(data: unknown): SessionTranscript {
  return SessionTranscriptSchema.parse(data);
}

export function safeParseSummary(data: unknown): {
  success: boolean;
  data?: SummaryJSON;
  errors?: string[];
} {
  const result = SummaryJSONSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`),
  };
}

export const ExportFormatSchema = z.enum(["json", "txt", "srt", "vtt", "docx", "pdf"]);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;

export const ExportRequestSchema = z.object({
  sessionId: z.string().uuid(),
  format: ExportFormatSchema,
  options: z
    .object({
      includeSpeakers: z.boolean().optional().default(true),
      includeTimestamps: z.boolean().optional().default(true),
      includeSummary: z.boolean().optional().default(true),
      includeMetadata: z.boolean().optional().default(false),
    })
    .optional(),
});

export type ExportRequest = z.infer<typeof ExportRequestSchema>;
