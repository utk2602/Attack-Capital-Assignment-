import { prisma } from "@/lib/db";

// Cast to any to avoid type errors if Prisma Client types are not yet updated in the editor
const db = prisma as any;

/**
 * Gemini API Cost Tracking
 *
 * Pricing (as of Nov 2023, verify current rates):
 * - Gemini 1.5 Pro: ~$0.0025 per 1K input tokens, ~$0.01 per 1K output tokens
 * - Audio input: ~1 token per 0.4 seconds of audio
 *
 * For transcription:
 * - Input: audio duration
 * - Output: transcript text length
 */

interface CostMetrics {
  totalCalls: number;
  totalAudioSeconds: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUSD: number;
}

interface CallMetadata {
  audioDurationSeconds: number;
  outputTextLength: number;
  modelUsed?: string;
}

// Pricing constants (adjust based on current Gemini pricing)
const PRICING = {
  INPUT_TOKEN_COST: 0.0025 / 1000, // $0.0025 per 1K tokens
  OUTPUT_TOKEN_COST: 0.01 / 1000, // $0.01 per 1K tokens
  AUDIO_SECONDS_PER_TOKEN: 0.4, // Approximate
  CHARS_PER_OUTPUT_TOKEN: 4, // Approximate
};

/**
 * Log a Gemini API call for cost tracking
 */
export async function logGeminiCall(sessionId: string, metadata: CallMetadata): Promise<void> {
  try {
    const inputTokens = Math.ceil(metadata.audioDurationSeconds / PRICING.AUDIO_SECONDS_PER_TOKEN);
    const outputTokens = Math.ceil(metadata.outputTextLength / PRICING.CHARS_PER_OUTPUT_TOKEN);
    const estimatedCost =
      inputTokens * PRICING.INPUT_TOKEN_COST + outputTokens * PRICING.OUTPUT_TOKEN_COST;

    await db.recordingEvent.create({
      data: {
        sessionId,
        type: "gemini_api_call",
        actorId: null,
        metadata: {
          audioDurationSeconds: metadata.audioDurationSeconds,
          outputTextLength: metadata.outputTextLength,
          inputTokens,
          outputTokens,
          estimatedCostUSD: estimatedCost,
          modelUsed: metadata.modelUsed || "gemini-1.5-pro",
          timestamp: new Date().toISOString(),
        },
      },
    });

    console.log(`[CostTracker] Logged call for session ${sessionId}: $${estimatedCost.toFixed(6)}`);
  } catch (error) {
    console.error("[CostTracker] Failed to log API call:", error);
  }
}

/**
 * Get cost metrics for a specific session
 */
export async function getSessionCostMetrics(sessionId: string): Promise<CostMetrics> {
  const events = await db.recordingEvent.findMany({
    where: {
      sessionId,
      type: "gemini_api_call",
    },
  });

  const metrics: CostMetrics = {
    totalCalls: events.length,
    totalAudioSeconds: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    estimatedCostUSD: 0,
  };

  for (const event of events) {
    const meta = event.metadata as any;
    if (meta) {
      metrics.totalAudioSeconds += meta.audioDurationSeconds || 0;
      metrics.totalInputTokens += meta.inputTokens || 0;
      metrics.totalOutputTokens += meta.outputTokens || 0;
      metrics.estimatedCostUSD += meta.estimatedCostUSD || 0;
    }
  }

  return metrics;
}

/**
 * Get cost metrics for all sessions in a time range
 */
export async function getGlobalCostMetrics(
  startDate?: Date,
  endDate?: Date
): Promise<CostMetrics & { sessionCount: number }> {
  const whereClause: any = {
    type: "gemini_api_call",
  };

  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) whereClause.createdAt.gte = startDate;
    if (endDate) whereClause.createdAt.lte = endDate;
  }

  const events = await db.recordingEvent.findMany({
    where: whereClause,
    select: {
      sessionId: true,
      metadata: true,
    },
  });

  const uniqueSessions = new Set(events.map((e: { sessionId: string }) => e.sessionId));

  const metrics: CostMetrics & { sessionCount: number } = {
    totalCalls: events.length,
    totalAudioSeconds: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    estimatedCostUSD: 0,
    sessionCount: uniqueSessions.size,
  };

  for (const event of events) {
    const meta = event.metadata as any;
    if (meta) {
      metrics.totalAudioSeconds += meta.audioDurationSeconds || 0;
      metrics.totalInputTokens += meta.inputTokens || 0;
      metrics.totalOutputTokens += meta.outputTokens || 0;
      metrics.estimatedCostUSD += meta.estimatedCostUSD || 0;
    }
  }

  return metrics;
}

/**
 * Estimate monthly cost based on usage patterns
 *
 * @param sessionsPerHour Average number of sessions starting per hour
 * @param avgSessionDurationMinutes Average session duration in minutes
 * @param callsPerChunk Number of API calls per chunk (1 for transcription, +1 if diarization)
 * @param hoursPerDay Hours of active usage per day
 * @param daysPerMonth Days of active usage per month
 */
export function estimateMonthlyCost(params: {
  sessionsPerHour: number;
  avgSessionDurationMinutes: number;
  callsPerChunk: number;
  chunkIntervalSeconds?: number;
  hoursPerDay?: number;
  daysPerMonth?: number;
}): {
  totalSessions: number;
  totalApiCalls: number;
  totalAudioHours: number;
  estimatedCostUSD: number;
  breakdown: {
    inputCost: number;
    outputCost: number;
  };
} {
  const {
    sessionsPerHour,
    avgSessionDurationMinutes,
    callsPerChunk,
    chunkIntervalSeconds = 5,
    hoursPerDay = 8,
    daysPerMonth = 22,
  } = params;

  const totalHours = hoursPerDay * daysPerMonth;
  const totalSessions = sessionsPerHour * totalHours;
  const chunksPerSession = Math.ceil((avgSessionDurationMinutes * 60) / chunkIntervalSeconds);
  const totalApiCalls = totalSessions * chunksPerSession * callsPerChunk;
  const totalAudioSeconds = totalSessions * avgSessionDurationMinutes * 60;
  const totalAudioHours = totalAudioSeconds / 3600;

  // Estimate tokens
  const inputTokens = Math.ceil(totalAudioSeconds / PRICING.AUDIO_SECONDS_PER_TOKEN);
  const avgOutputCharsPerSecond = 10; // Rough estimate for transcription
  const outputChars = totalAudioSeconds * avgOutputCharsPerSecond;
  const outputTokens = Math.ceil(outputChars / PRICING.CHARS_PER_OUTPUT_TOKEN);

  const inputCost = inputTokens * PRICING.INPUT_TOKEN_COST;
  const outputCost = outputTokens * PRICING.OUTPUT_TOKEN_COST;
  const estimatedCostUSD = inputCost + outputCost;

  return {
    totalSessions,
    totalApiCalls,
    totalAudioHours,
    estimatedCostUSD,
    breakdown: {
      inputCost,
      outputCost,
    },
  };
}

/**
 * Get real-time cost statistics for monitoring
 */
export async function getCostStatistics(period: "day" | "week" | "month" = "month") {
  const now = new Date();
  const startDate = new Date();

  switch (period) {
    case "day":
      startDate.setDate(now.getDate() - 1);
      break;
    case "week":
      startDate.setDate(now.getDate() - 7);
      break;
    case "month":
      startDate.setMonth(now.getMonth() - 1);
      break;
  }

  const metrics = await getGlobalCostMetrics(startDate, now);

  return {
    period,
    startDate,
    endDate: now,
    ...metrics,
    avgCostPerSession:
      metrics.sessionCount > 0 ? metrics.estimatedCostUSD / metrics.sessionCount : 0,
    avgCostPerCall: metrics.totalCalls > 0 ? metrics.estimatedCostUSD / metrics.totalCalls : 0,
  };
}
