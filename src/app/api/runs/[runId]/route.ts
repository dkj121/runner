import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearRunSession } from "@/lib/run-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  const record = await prisma.runRecord.findUnique({
    where: { id: runId },
    include: { user: { select: { id: true, name: true, image: true } } },
  });

  if (!record) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(record);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const { userId, endTime, duration, distance, avgPace } =
    await request.json();

  if (!userId || !endTime) {
    return NextResponse.json(
      { error: "userId and endTime required" },
      { status: 400 },
    );
  }

  await prisma.runRecord.update({
    where: { id: runId },
    data: {
      endTime: new Date(endTime),
      duration,
      distance,
      avgPace,
    },
  });

  await clearRunSession(runId, userId);

  return NextResponse.json({ ok: true });
}
