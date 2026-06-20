import { NextResponse } from "next/server";
import { pushPoints } from "@/lib/run-store";

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
