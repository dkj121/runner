import { NextResponse } from "next/server";
import { getActiveRunId, getAllPoints, getRunMeta } from "@/lib/run-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const runId = await getActiveRunId(userId);
  if (!runId) {
    return NextResponse.json({ active: false });
  }

  const meta = await getRunMeta(runId);
  const points = await getAllPoints(runId);

  return NextResponse.json({
    active: true,
    runId,
    startTime: meta?.startTime ? Number(meta.startTime) : null,
    points,
  });
}
