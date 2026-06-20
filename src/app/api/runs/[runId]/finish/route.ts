import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearRunSession } from "@/lib/run-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const body = await request.json();
  const { userId, endTime, duration, distance, avgPace, points } = body;

  if (!userId || !endTime) {
    return NextResponse.json({ error: "userId and endTime required" }, { status: 400 });
  }

  await prisma.runRecord.update({
    where: { id: runId },
    data: {
      endTime: new Date(endTime),
      duration,
      distance,
      avgPace,
      points: {
        create: (points ?? []).map(
          (p: { lat: number; lng: number; timestamp: number }) => ({
            lat: p.lat,
            lng: p.lng,
            timestamp: p.timestamp,
          }),
        ),
      },
    },
  });

  await clearRunSession(runId, userId);

  return NextResponse.json({ ok: true });
}
