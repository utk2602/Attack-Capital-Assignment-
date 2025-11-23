import { prisma as db } from "@/lib/db";
import { gemini } from "@/lib/gemini";

export async function refineSpeakerDiarization(sessionId: string): Promise<void> {
  const chunks = await db.transcriptChunk.findMany({
    where: { sessionId, status: "transcribed", text: { not: null } },
    orderBy: { seq: "asc" },
    select: { seq: true, text: true, speaker: true },
  });

  if (chunks.length < 5) return;

  const aggregatedText = chunks.map((c) => c.text).join(" ");
  const prompt = buildDiarizationRefinementPrompt(aggregatedText, chunks);

  const model = gemini["genAI"].getGenerativeModel({ model: gemini["model"] });
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
  });

  const refinedData = JSON.parse(result.response.text());

  for (const item of refinedData.segments) {
    await db.transcriptChunk.update({
      where: { sessionId_seq: { sessionId, seq: item.sequence } },
      data: { speaker: item.speaker },
    });
  }
}

function buildDiarizationRefinementPrompt(text: string, chunks: any[]): string {
  return `Analyze this meeting transcript and improve speaker diarization.

Current transcript with preliminary speaker labels:
${chunks.map((c) => `[Seq ${c.seq}] ${c.speaker || "UNKNOWN"}: ${c.text}`).join("\n")}

Tasks:
1. Identify consistent speaker voices throughout conversation
2. Relabel speaker tags for consistency (SPEAKER_1, SPEAKER_2, etc.)
3. Detect speaker changes based on context and speech patterns
4. Extract action items and decisions

Output JSON format:
{
  "segments": [
    {"sequence": 0, "speaker": "SPEAKER_1", "text": "..."},
    {"sequence": 1, "speaker": "SPEAKER_2", "text": "..."}
  ],
  "speakerMap": {"SPEAKER_1": "likely role (e.g., Manager)", "SPEAKER_2": "likely role"},
  "actionItems": ["Action item 1", "Action item 2"],
  "decisions": ["Decision 1", "Decision 2"]
}`;
}
