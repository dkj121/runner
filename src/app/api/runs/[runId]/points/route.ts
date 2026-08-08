import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pushPoints, getAllPoints } from "@/lib/gps-cache";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ runId: string }> },
) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { runId } = await params;

	const record = await prisma.runRecord.findUnique({
		where: { id: runId },
		select: { userId: true },
	});

	if (!record || record.userId !== session.user.id) {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}

	const points = await getAllPoints(runId);
	return NextResponse.json({ points });
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ runId: string }> },
) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { runId } = await params;

	const record = await prisma.runRecord.findUnique({
		where: { id: runId },
		select: { userId: true },
	});

	if (!record || record.userId !== session.user.id) {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}

	const body = await request.json();

	if (!body.points || !Array.isArray(body.points)) {
		return NextResponse.json(
			{ error: "points array required" },
			{ status: 400 },
		);
	}

	await pushPoints(runId, body.points);

	return NextResponse.json({ ok: true });
}
