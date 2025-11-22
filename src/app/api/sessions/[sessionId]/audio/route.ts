import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();


export async function GET(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = params;

    const session = await prisma.recordingSession.findUnique({
      where: { id: sessionId },
      include: {
        chunks: {
          orderBy: { seq: "asc" },
          select: {
            id: true,
            seq: true,
            audioPath: true,
            durationMs: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.chunks.length === 0) {
      return NextResponse.json(
        { error: "No audio chunks found for this session" },
        { status: 404 }
      );
    }

    const chunkBuffers: Buffer[] = [];
    let totalSize = 0;
    let missingChunks: number[] = [];

    for (const chunk of session.chunks) {
      try {
        if (!fs.existsSync(chunk.audioPath)) {
          missingChunks.push(chunk.seq);
          continue;
        }

        const buffer = await fs.promises.readFile(chunk.audioPath);
        chunkBuffers.push(buffer);
        totalSize += buffer.length;
      } catch (error) {
        console.error(`Failed to read chunk ${chunk.seq}:`, error);
        missingChunks.push(chunk.seq);
      }
    }

    if (chunkBuffers.length === 0) {
      return NextResponse.json(
        {
          error: "No audio data available",
          missingChunks,
        },
        { status: 404 }
      );
    }

    const combinedBuffer = Buffer.concat(chunkBuffers);

    
    return new NextResponse(combinedBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/webm",
        "Content-Length": combinedBuffer.length.toString(),
        "Content-Disposition": `inline; filename="session_${sessionId}.webm"`,
        "Cache-Control": "public, max-age=31536000",
        "X-Total-Chunks": session.chunks.length.toString(),
        "X-Available-Chunks": chunkBuffers.length.toString(),
        ...(missingChunks.length > 0 && {
          "X-Missing-Chunks": missingChunks.join(","),
        }),
      },
    });
  } catch (error) {
    console.error("Failed to serve audio:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
