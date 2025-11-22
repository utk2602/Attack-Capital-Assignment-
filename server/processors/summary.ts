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

export async function generateSummary(
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
