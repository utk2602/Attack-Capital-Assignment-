import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";
import * as path from "path";
import * as fs from "fs/promises";

function exportTranscript(
  chunks: Array<{ seq: number; text: string | null; speaker: string | null; createdAt: Date }>,
  format: "txt" | "srt" | "vtt"
): string {
  if (format === "txt") {
    return chunks
      .filter((c) => c.text)
      .map((c) => {
        const speaker = c.speaker || "Unknown";
        return `[${speaker}]: ${c.text}`;
      })
      .join("\n\n");
  }

  if (format === "srt") {
    let srtContent = "";
    let index = 1;
    let cumulativeTime = 0;

    chunks.forEach((chunk) => {
      if (!chunk.text) return;

      const startTime = cumulativeTime;
      const endTime = startTime + 30000;
      cumulativeTime = endTime;

      const startSrt = formatSrtTime(startTime);
      const endSrt = formatSrtTime(endTime);

      srtContent += `${index}\n${startSrt} --> ${endSrt}\n${chunk.text}\n\n`;
      index++;
    });

    return srtContent;
  }

  if (format === "vtt") {
    let vttContent = "WEBVTT\n\n";
    let cumulativeTime = 0;

    chunks.forEach((chunk) => {
      if (!chunk.text) return;

      const startTime = cumulativeTime;
      const endTime = startTime + 30000;
      cumulativeTime = endTime;

      const startVtt = formatVttTime(startTime);
      const endVtt = formatVttTime(endTime);

      const speaker = chunk.speaker || "Unknown";
      vttContent += `${startVtt} --> ${endVtt}\n<v ${speaker}>${chunk.text}\n\n`;
    });

    return vttContent;
  }

  return "";
}

function formatSrtTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")},${milliseconds.toString().padStart(3, "0")}`;
}

function formatVttTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}

export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = params;
    const searchParams = req.nextUrl.searchParams;
    const format = searchParams.get("format") || "json";

    const session = await db.recordingSession.findUnique({
      where: { id: sessionId },
      include: { chunks: { orderBy: { seq: "asc" } } },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status !== "completed") {
      return NextResponse.json({ error: "Session not completed yet" }, { status: 400 });
    }

    const validFormats = ["json", "txt", "srt", "vtt"];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: "Invalid format. Use: json, txt, srt, or vtt" },
        { status: 400 }
      );
    }

    if (format === "json") {
      const data = {
        sessionId: session.id,
        title: session.title,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        transcript: session.transcript,
        summary: session.summaryJSON,
        chunks: session.chunks.map((chunk) => ({
          sequence: chunk.seq,
          text: chunk.text,
          speaker: chunk.speaker,
          timestamp: chunk.createdAt,
          confidence: chunk.confidence,
        })),
      };

      return NextResponse.json(data, {
        headers: {
          "Content-Disposition": `attachment; filename="transcript_${sessionId}.json"`,
          "Content-Type": "application/json",
        },
      });
    }

    const exportedContent = exportTranscript(session.chunks, format as any);

    const mimeTypes = {
      txt: "text/plain",
      srt: "application/x-subrip",
      vtt: "text/vtt",
    };

    return new NextResponse(exportedContent, {
      headers: {
        "Content-Disposition": `attachment; filename="transcript_${sessionId}.${format}"`,
        "Content-Type": mimeTypes[format as keyof typeof mimeTypes],
      },
    });
  } catch (error) {
    console.error("[Download] Error:", error);
    return NextResponse.json({ error: "Failed to export transcript" }, { status: 500 });
  }
}
