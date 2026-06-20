import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRunSession } from "@/lib/run-store";

export async function POST(request: Request) {
  const body = await request.json();
  const { userId, playGroundId } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const record = await prisma.runRecord.create({
    data: {
      userId,
      playGroundId: playGroundId || undefined,
      startTime: new Date(),
    },
  });

  await createRunSession(record.id, userId);

  return NextResponse.json({ runId: record.id });
}
