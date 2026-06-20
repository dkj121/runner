import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();

  await prisma.runRecord.create({
    data: {
      userId: body.userId,
      startTime: new Date(body.startTime),
      endTime: body.endTime ? new Date(body.endTime) : null,
      duration: body.duration,
      distance: body.distance,
      avgPace: body.avgPace,
      points: {
        create: body.points.map(
          (p: { lat: number; lng: number; timestamp: number }) => ({
            lat: p.lat,
            lng: p.lng,
            timestamp: p.timestamp,
          }),
        ),
      },
    },
  });

  return NextResponse.json({ ok: true });
}
