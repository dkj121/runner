import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushPoints, getAllPoints } from "@/lib/gps-cache";
import { logError } from "@/lib/logger";
import { createRoute } from "@/lib/create-route";

export const GET = createRoute({
	method: "GET",
	path: "/api/runs/[runId]/points",
	auth: true,
	operation: "getRunPoints",
})(
	async ({ params, user }) => {
		const { runId } = params;

		const record = await prisma.runRecord.findUnique({
			where: { id: runId },
			select: { userId: true },
		});

		if (!record || record.userId !== user!.id) {
			return NextResponse.json({ error: "not found" }, { status: 404 });
		}

		const points = await getAllPoints(runId);
		return NextResponse.json({ points });
	},
);

export const POST = createRoute({
	method: "POST",
	path: "/api/runs/[runId]/points",
	auth: true,
	operation: "pushRunPoints",
})(
	async ({ request, params, user }) => {
		const { runId } = params;

		const record = await prisma.runRecord.findUnique({
			where: { id: runId },
			select: { userId: true },
		});

		if (!record || record.userId !== user!.id) {
			return NextResponse.json({ error: "not found" }, { status: 404 });
		}

		const body = await request.json();

		if (!body.points || !Array.isArray(body.points)) {
			return NextResponse.json(
				{ error: "points array required" },
				{ status: 400 },
			);
		}

		try {
			await pushPoints(runId, body.points);
		} catch (e) {
			// 关键数据写入：GPS 轨迹点不能静默丢失，必须让调用端感知失败
			logError(e instanceof Error ? e : new Error(String(e)), {
				userId: user!.id,
				runRecordId: runId,
				operation: "pushPoints",
			});
			return NextResponse.json(
				{ error: "GPS 数据暂存失败" },
				{ status: 503 },
			);
		}

		return NextResponse.json({ ok: true });
	},
);