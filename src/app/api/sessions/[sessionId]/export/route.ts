import { NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";
import { exportTranscript, ExportFormat, getMimeType } from "@/../server/utils/exportFormats";

export async function GET(req: Request, { params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") || "txt") as ExportFormat;

  try {
    const session = await db.recordingSession.findUnique({
      where: { id: sessionId },
      include: {
        chunks: {
          orderBy: { seq: "asc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const transcript = {
      sessionId: session.id,
      title: session.title || `Recording ${session.id.slice(0, 8)}`,
      segments: session.chunks.map((chunk) => ({
        seq: chunk.seq,
        text: chunk.text || "",
        speaker: chunk.speaker,
        startTimeMs: chunk.seq * 5000,
        endTimeMs: (chunk.seq + 1) * 5000,
        confidence: chunk.confidence === null ? undefined : chunk.confidence,
      })),
      speakers: Array.from(
        new Set(session.chunks.map((c) => c.speaker).filter(Boolean))
      ) as string[],
      summary: session.summaryJSON as any,
      metadata: {
        duration: session.chunks.length * 5,
        createdAt: session.createdAt.toISOString(),
      },
    };
    const content = exportTranscript(transcript, format);
    const mimeType = getMimeType(format);
    const filename = `transcript-${sessionId.slice(0, 8)}.${format}`;

    return new NextResponse(content, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[API] Export failed:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
