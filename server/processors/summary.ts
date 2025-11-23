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
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  const result = await model.generateContent(prompt);
  const summaryText = result.response.text() || "";

  const summary = parseSummaryJson(summaryText);

  return {
    ...summary,
    duration: `${durationMin}m ${Math.floor((durationMs % 60000) / 1000)}s`,
    participantCount: speakers.size,
  };
}

function buildSummaryPrompt(transcript: string, speakerCount: number, durationMin: number): string {
  return `You are an AI meeting assistant. Analyze this ${durationMin}-minute transcript with ${speakerCount} participants and generate a comprehensive summary.

**Important Context:**
- The audio may contain background noise, various accents, and environmental sounds
- Some sections may be unclear or unintelligible
- Focus on extracting clear, actionable information
- If speech is garbled or background noise interferes, mark as [inaudible] or omit
- Remove obvious filler words (um, uh, like) unless they provide meaningful context

**Transcript:**
${transcript.slice(0, 8000)}${transcript.length > 8000 ? "..." : ""}

**Your Task:**
1. **Executive Summary** (3-5 sentences): High-level overview of meeting purpose and outcomes.
2. **Key Points** (5-8 bullet points): Main discussion topics and themes.
3. **Action Items**: Extract specific tasks assigned to speakers with timestamps if mentioned.
4. **Decisions**: Identify concrete decisions made during the meeting.
5. **Key Timestamps**: Mark significant moments (e.g., "5:30 - Product roadmap discussion").

**Output Format (strict JSON):**
\`\`\`json
{
  "executiveSummary": "...",
  "keyPoints": ["...", "..."],
  "actionItems": [
    {"speaker": "Speaker 1", "item": "Follow up with client", "timestamp": "3:45"}
  ],
  "decisions": [
    {"decision": "Approved Q2 budget", "timestamp": "12:30"}
  ],
  "keyTimestamps": [
    {"time": "5:30", "event": "Discussed roadmap"}
  ]
}
\`\`\`

Return ONLY the JSON object, no markdown formatting.`;
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
