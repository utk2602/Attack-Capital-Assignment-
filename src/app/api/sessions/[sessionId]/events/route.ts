import { NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { sessionId: string } }) {
  const { sessionId } = params;

  try {
    const events = await db.recordingEvent.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 1000,
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("[API] Failed to fetch events:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
