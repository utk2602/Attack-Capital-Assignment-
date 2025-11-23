
import { NextRequest, NextResponse } from "next/server";
import { saveAudioChunk } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const chunk = formData.get("chunk") as File;
    const sessionId = formData.get("sessionId") as string;
    const seq = parseInt(formData.get("seq") as string);

    if (!chunk || !sessionId || isNaN(seq)) {
      return NextResponse.json(
        { error: "Missing required fields: chunk, sessionId, seq" },
        { status: 400 }
      );
    }

    const arrayBuffer = await chunk.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const filepath = await saveAudioChunk(sessionId, seq, buffer);

    return NextResponse.json({
      success: true,
      path: filepath,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to save audio chunk" }, { status: 500 });
  }
}
