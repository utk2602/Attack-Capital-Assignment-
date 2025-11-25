import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const skip = (page - 1) * limit;

    const recordingSession = await prisma.recordingSession.findUnique({
      where: { id: sessionId },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    if (!recordingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (recordingSession.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const chunks = await prisma.transcriptChunk.findMany({
      where: { sessionId },
      skip,
      take: limit,
      orderBy: { seq: "asc" },
      select: {
        id: true,
        seq: true,
        audioPath: true,
        durationMs: true,
        text: true,
        speaker: true,
        confidence: true,
        status: true,
        createdAt: true,
      },
    });

    const duration =
      recordingSession.endedAt && recordingSession.startedAt
        ? Math.floor(
            (recordingSession.endedAt.getTime() - recordingSession.startedAt.getTime()) / 1000
          )
        : 0;

    const response = {
      id: recordingSession.id,
      title: recordingSession.title || "Untitled Recording",
      status: recordingSession.status,
      startedAt: recordingSession.startedAt.toISOString(),
      endedAt: recordingSession.endedAt?.toISOString() || null,
      duration,
      transcript: recordingSession.transcript,
      summaryJSON: recordingSession.summaryJSON,
      chunks: {
        items: chunks.map((chunk) => ({
          id: chunk.id,
          seq: chunk.seq,
          audioPath: chunk.audioPath,
          durationMs: chunk.durationMs,
          text: chunk.text,
          speaker: chunk.speaker,
          confidence: chunk.confidence,
          status: chunk.status,
          createdAt: chunk.createdAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total: recordingSession._count.chunks,
          totalPages: Math.ceil(recordingSession._count.chunks / limit),
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}
