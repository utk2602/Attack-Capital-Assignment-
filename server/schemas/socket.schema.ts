import { z } from "zod";

export const StartSessionSchema = z.object({
  sessionId: z.string().uuid("Session ID must be a valid UUID"),
  userId: z.string().min(1, "User ID is required"),
  title: z.string().min(1, "Session title is required").optional(),
  source: z.enum(["mic", "tab"]).default("mic"),
});

export type StartSessionPayload = z.infer<typeof StartSessionSchema>;

export const AudioChunkSchema = z.object({
  sessionId: z.string().uuid("Session ID must be a valid UUID"),
  sequence: z.number().int().nonnegative("Sequence must be a non-negative integer"),
  timestamp: z.number().int().positive("Timestamp must be a positive integer"),
  size: z.number().int().positive("Size must be a positive integer"),
  mimeType: z.string().regex(/^audio\//, "MIME type must be an audio type"),
  audio: z.any(),
});

export type AudioChunkPayload = z.infer<typeof AudioChunkSchema>;

export const PauseSessionSchema = z.object({
  sessionId: z.string().uuid("Session ID must be a valid UUID"),
  pausedAt: z.number().int().positive("Paused timestamp must be a positive integer"),
});

export type PauseSessionPayload = z.infer<typeof PauseSessionSchema>;

export const ResumeSessionSchema = z.object({
  sessionId: z.string().uuid("Session ID must be a valid UUID"),
  resumedAt: z.number().int().positive("Resumed timestamp must be a positive integer"),
});

export type ResumeSessionPayload = z.infer<typeof ResumeSessionSchema>;

export const StopSessionSchema = z.object({
  sessionId: z.string().uuid("Session ID must be a valid UUID"),
  userId: z.string().optional(),
});

export type StopSessionPayload = z.infer<typeof StopSessionSchema>;

export function validateSocketPayload<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  eventName: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      throw new Error(`Validation failed for ${eventName}: ${errorMessage}`);
    }
    throw error;
  }
}

export function safeValidateSocketPayload<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
