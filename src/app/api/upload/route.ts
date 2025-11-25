import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { nanoid } from "nanoid";
import { gemini } from "@/lib/gemini";
import { GoogleGenerativeAI } from "@google/generative-ai";

const STORAGE_DIR = join(process.cwd(), "storage", "uploads");
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/mp3",
  "audio/ogg",
  "audio/webm",
  "audio/m4a",
  "audio/mp4",
];

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("audio") as File;
    const title = formData.get("title") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|webm|m4a|mp4)$/i)) {
      return NextResponse.json(
        { error: "Invalid file type. Supported: MP3, WAV, OGG, WebM, M4A, MP4" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size: 100MB" }, { status: 400 });
    }

    const sessionId = nanoid();
    const fileName = `${sessionId}-${file.name}`;
    const filePath = join(STORAGE_DIR, fileName);

    // Ensure storage directory exists
    await mkdir(STORAGE_DIR, { recursive: true });

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Create session record with user
    const recordingSession = await prisma.recordingSession.create({
      data: {
        id: sessionId,
        title: title || file.name,
        status: "processing",
        startedAt: new Date(),
        endedAt: new Date(),
        userId: session.user.id,
      },
    });

    // Start transcription in background
    transcribeUploadedFile(sessionId, filePath, file.name).catch((err) => {
      console.error(`[Upload] Transcription failed for ${sessionId}:`, err);
    });

    return NextResponse.json({
      success: true,
      sessionId,
      message: "File uploaded successfully. Transcription in progress.",
    });
  } catch (error: any) {
    console.error("[Upload] Error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}

async function transcribeUploadedFile(sessionId: string, filePath: string, originalName: string) {
  try {
    console.log(`[Upload] Starting transcription for ${sessionId}`);

    // Transcribe the full audio file with increased timeout
    const result = await gemini.transcribeChunk(sessionId, 0, filePath, {
      languageHint: "en-US",
      temperature: 0.1,
      timeout: 120000, // 2 minutes for longer files
    });

    console.log(`[Upload] Transcription successful: ${result.text.length} characters`);

    // Update session with transcript
    await prisma.recordingSession.update({
      where: { id: sessionId },
      data: {
        transcript: result.text,
        status: "finalizing",
        endedAt: new Date(),
      },
    });

    // Generate summary
    console.log(`[Upload] Generating summary for ${sessionId}`);
    const summary = await generateUploadSummary(sessionId, result.text);
    console.log(`[Upload] Summary generated:`, JSON.stringify(summary, null, 2));

    // Update with summary and mark complete
    await prisma.recordingSession.update({
      where: { id: sessionId },
      data: {
        summaryJSON: summary as any,
        status: "completed",
      },
    });

    console.log(`[Upload] Transcription completed for ${sessionId}`);
  } catch (error) {
    console.error(`[Upload] Transcription error for ${sessionId}:`, error);
    await prisma.recordingSession.update({
      where: { id: sessionId },
      data: {
        status: "failed",
        transcript: `Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
    });
  }
}

async function generateUploadSummary(sessionId: string, transcript: string) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY required");

    console.log(`[Upload] Initializing Gemini for summary generation...`);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are an expert meeting analyst. Analyze the following transcript and provide a structured summary.

Transcript:
${transcript}

Provide a JSON response with this EXACT structure:
{
  "executiveSummary": "A comprehensive 2-3 sentence overview of the main topics and outcomes",
  "keyPoints": ["Point 1", "Point 2", "Point 3", ...],
  "actionItems": [{"speaker": "Name or 'Team'", "item": "Action description", "timestamp": "optional"}],
  "decisions": [{"decision": "Decision made", "timestamp": "optional"}],
  "keyTimestamps": [{"time": "MM:SS", "event": "What happened"}],
  "duration": "X minutes",
  "participantCount": 1
}

Output ONLY valid JSON, no markdown formatting.`;

    console.log(`[Upload] Calling Gemini API for summary...`);
    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();
    console.log(`[Upload] Gemini raw response length: ${response.length} chars`);

    // Clean response
    let jsonText = response
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    console.log(`[Upload] Cleaned JSON text (first 200 chars): ${jsonText.substring(0, 200)}...`);

    try {
      const parsed = JSON.parse(jsonText);
      console.log(`[Upload] Successfully parsed summary JSON`);
      return parsed;
    } catch (e) {
      console.error("[Upload] Failed to parse summary JSON:", e);
      console.error("[Upload] Raw response was:", response);
      // Return a basic summary if parsing fails
      return {
        executiveSummary: "Summary generation encountered a parsing error.",
        keyPoints: ["Transcription completed successfully"],
        actionItems: [],
        decisions: [],
        keyTimestamps: [],
        duration: "Unknown",
        participantCount: 1,
      };
    }
  } catch (error) {
    console.error("[Upload] Summary generation error:", error);
    throw error;
  }
}
