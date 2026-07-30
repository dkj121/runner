import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createRunSession } from "@/lib/gps-cache";

export async function POST() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const record = await prisma.runRecord.create({
		data: { userId: session.user.id, startTime: new Date() },
	});

	await createRunSession(record.id, session.user.id);

	return NextResponse.json({ runId: record.id });
}

export async function GET(request: Request) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const take = Math.min(Number(searchParams.get("take")) || 20, 100);
	const skip = Number(searchParams.get("skip")) || 0;

	const [records, total] = await Promise.all([
		prisma.runRecord.findMany({
			where: { userId: session.user.id },
			orderBy: { startTime: "desc" },
			take,
			skip,
		}),
		prisma.runRecord.count({ where: { userId: session.user.id } }),
	]);

	return NextResponse.json({ records, total });
}
