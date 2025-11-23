import { NextResponse } from "next/server";
import { getCostStatistics } from "@/../server/utils/geminiCostTracker";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") || "month") as "day" | "week" | "month";

  try {
    const stats = await getCostStatistics(period);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[API] Failed to fetch cost statistics:", error);
    return NextResponse.json({ error: "Failed to fetch cost statistics" }, { status: 500 });
  }
}
