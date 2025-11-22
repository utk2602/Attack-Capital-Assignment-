import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const status = searchParams.get("status") || undefined;

    const skip = (page - 1) * limit;

    const where: any = {
      userId: session.user.id,
    };

    if (status) {
      where.status = status;
    }

    const [sessions, totalCount] = await Promise.all([
      prisma.recordingSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: "desc" },
        include: {
          _count: {
            select: { chunks: true },
          },
        },
      }),
      prisma.recordingSession.count({ where }),
    ]);

    const formattedSessions = sessions.map((session) => {
      const duration =
        session.endedAt && session.startedAt
          ? Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
          : 0;

      return {
        id: session.id,
        title: session.title || "Untitled Recording",
        status: session.status,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt?.toISOString() || null,
        duration,
        chunkCount: session._count.chunks,
        hasTranscript: !!session.transcript,
      };
    });

    return NextResponse.json({
      sessions: formattedSessions,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}
