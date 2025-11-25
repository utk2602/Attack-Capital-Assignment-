import { prisma as db } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface MeetingSummary {
  executiveSummary: string;
  keyPoints: string[];
  actionItems: Array<{
    speaker: string;
    item: string;
    timestamp?: string;
  }>;
  decisions: Array<{
    decision: string;
    timestamp?: string;
  }>;
  keyTimestamps: Array<{
    time: string;
    event: string;
  }>;
  duration: string;
  participantCount: number;
}

const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

export async function generateSummary(
  sessionId: string,
  fullTranscript: string
): Promise<MeetingSummary> {
  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt < RETRY_CONFIG.maxAttempts) {
    try {
      attempt++;
      console.log(
        `[Summary] Attempt ${attempt}/${RETRY_CONFIG.maxAttempts} for session: ${sessionId}`
      );

      const summary = await generateSummaryInternal(sessionId, fullTranscript);
      await logSummaryAttempt(sessionId, attempt, true);

      return summary;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      console.error(`[Summary] Attempt ${attempt} failed:`, lastError.message);

      await logSummaryAttempt(sessionId, attempt, false, lastError.message);

      if (attempt < RETRY_CONFIG.maxAttempts) {
        const delay = Math.min(
          RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
          RETRY_CONFIG.maxDelayMs
        );

        console.log(`[Summary] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[Summary] Failed after ${RETRY_CONFIG.maxAttempts} attempts`);
  throw new Error(
    `Summary generation failed after ${RETRY_CONFIG.maxAttempts} attempts: ${lastError?.message}`
  );
}

async function generateSummaryInternal(
  sessionId: string,
  fullTranscript: string
): Promise<MeetingSummary> {
  console.log(`[Summary] Generating for session: ${sessionId}`);

  const chunks = await db.transcriptChunk.findMany({
    where: { sessionId },
    orderBy: { seq: "asc" },
  });

  const speakers = new Set(chunks.map((c) => c.speaker).filter((s): s is string => s !== null));

  const startTime = chunks[0]?.createdAt || new Date();
  const endTime = chunks[chunks.length - 1]?.createdAt || new Date();
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMin = Math.floor(durationMs / 60000);

  const prompt = buildSummaryPrompt(fullTranscript, speakers.size, durationMin);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY required");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent(prompt);
  const summaryText = result.response.text() || "";

  // New format: Plain text narrative, not JSON
  const summary = {
    executiveSummary: summaryText.trim(),
    keyPoints: [], // No longer used
    actionItems: [], // No longer used
    decisions: [], // No longer used
    keyTimestamps: [], // No longer used
  };

  return {
    ...summary,
    duration: `${durationMin}m ${Math.floor((durationMs % 60000) / 1000)}s`,
    participantCount: speakers.size,
  };
}

function buildSummaryPrompt(transcript: string, speakerCount: number, durationMin: number): string {
  return `You are an intelligent meeting analyst helping someone who missed a ${durationMin}-minute conversation understand what happened.

**YOUR TASK:**
Read the transcript and explain the meeting in a natural, conversational way - as if you're briefing a colleague who wasn't there.

**TRANSCRIPT:**
${transcript.slice(0, 8000)}${transcript.length > 8000 ? "..." : ""}

**INSTRUCTIONS:**
Write a cohesive explanation (3-5 paragraphs) covering:
- What was the meeting about? (main topic/purpose)
- What were the key discussion points?
- What decisions were made or actions planned?
- Any important names, dates, or context mentioned
- The overall tone/sentiment (urgent, casual, concerned, etc.)

**STYLE:**
- Write naturally, like telling a story
- Be MUCH more concise than the original (summarize, don't repeat)
- Use past tense ("The team discussed...", "They decided...")
- Focus on meaning and context, not word-for-word transcription
- Skip unclear parts or background noise
- No bullet points, no structured format - just flowing paragraphs

**EXAMPLE FORMAT:**
"The meeting focused on the Q2 product roadmap. The team discussed concerns about missing the launch deadline due to design delays. Sarah from marketing emphasized the importance of hitting the April launch to align with their campaign. John proposed reallocating two developers from the maintenance team to accelerate development. After some debate about resource constraints, they agreed to this approach and set up a checkpoint meeting for next week. The overall tone was urgent but optimistic about meeting the revised timeline."

Now explain this conversation naturally and concisely:`;
}

function parseSummaryJson(text: string): Omit<MeetingSummary, "duration" | "participantCount"> {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      executiveSummary: parsed.executiveSummary || "No summary available",
      keyPoints: parsed.keyPoints || [],
      actionItems: parsed.actionItems || [],
      decisions: parsed.decisions || [],
      keyTimestamps: parsed.keyTimestamps || [],
    };
  } catch (error) {
    console.error("[Summary] JSON parsing failed:", error);
    return {
      executiveSummary: text.slice(0, 300),
      keyPoints: [],
      actionItems: [],
      decisions: [],
      keyTimestamps: [],
    };
  }
}

async function logSummaryAttempt(
  sessionId: string,
  attempt: number,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    const existingSession = await db.recordingSession.findUnique({
      where: { id: sessionId },
      select: { summaryJSON: true },
    });

    const retryMetadata = {
      ...(typeof existingSession?.summaryJSON === "object" && existingSession.summaryJSON !== null
        ? existingSession.summaryJSON
        : {}),
      _retryMetadata: {
        attempts: attempt,
        success,
        lastError: errorMessage || null,
        lastAttemptAt: new Date().toISOString(),
      },
    };

    await db.recordingSession.update({
      where: { id: sessionId },
      data: {
        summaryJSON: retryMetadata as any, // Store retry info temporarily
      },
    });
  } catch (error) {
    console.error("[Summary] Failed to log attempt:", error);
  }
}
