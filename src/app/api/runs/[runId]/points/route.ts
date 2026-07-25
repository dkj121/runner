import { NextResponse } from "next/server";
import { pushPoints, getAllPoints } from "@/lib/gps-cache";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const points = await getAllPoints(runId);
  return NextResponse.json({ points });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const body = await request.json();

  if (!body.points || !Array.isArray(body.points)) {
    return NextResponse.json({ error: "points array required" }, { status: 400 });
  }

  await pushPoints(runId, body.points);

  return NextResponse.json({ ok: true });
}
