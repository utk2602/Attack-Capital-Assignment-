import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";


export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = params;

    const chunks = await db.transcriptChunk.findMany({
      where: { sessionId },
      select: { seq: true },
      orderBy: { seq: "asc" },
    });

    if (chunks.length === 0) {
      return NextResponse.json({
        missing: [],
        maxSeq: -1,
        totalChunks: 0,
      });
    }

    const sequences = chunks.map((c) => c.seq);
    const maxSeq = Math.max(...sequences);
    const missing: number[] = [];

    for (let i = 0; i <= maxSeq; i++) {
      if (!sequences.includes(i)) {
        missing.push(i);
      }
    }

    return NextResponse.json({
      missing,
      maxSeq,
      totalChunks: sequences.length,
      expectedChunks: maxSeq + 1,
      complete: missing.length === 0,
    });
  } catch (error) {
    console.error("[Missing Chunks] Error:", error);
    return NextResponse.json({ error: "Failed to check missing chunks" }, { status: 500 });
  }
}
