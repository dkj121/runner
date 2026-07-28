import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRunSession } from "@/lib/gps-cache";

export async function POST(request: Request) {
	const { userId } = await request.json();

	if (!userId) {
		return NextResponse.json({ error: "userId required" }, { status: 400 });
	}

	const record = await prisma.runRecord.create({
		data: { userId, startTime: new Date() },
	});

	await createRunSession(record.id, userId);

	return NextResponse.json({ runId: record.id });
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const userId = searchParams.get("userId");

	if (!userId) {
		return NextResponse.json({ error: "userId required" }, { status: 400 });
	}

	const take = Math.min(Number(searchParams.get("take")) || 20, 100);
	const skip = Number(searchParams.get("skip")) || 0;

	const [records, total] = await Promise.all([
		prisma.runRecord.findMany({
			where: { userId },
			orderBy: { startTime: "desc" },
			take,
			skip,
		}),
		prisma.runRecord.count({ where: { userId } }),
	]);

	return NextResponse.json({ records, total });
}
