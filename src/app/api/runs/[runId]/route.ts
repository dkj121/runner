import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearRunSession, getAllPoints } from "@/lib/gps-cache";
import { calcPace, segmentDistance } from "@/lib/track-calc";
import { logError } from "@/lib/logger";
import { createRoute } from "@/lib/create-route";

// 实时距离：复用 track-calc 的 haversine（segmentDistance），仅额外做两位小数舍入作为展示格式
function calcLiveDistance(points: { lat: number; lng: number }[]): number {
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		const d = segmentDistance(points[i - 1], points[i]);
		if (d > 5) total += d;
	}
	return parseFloat((total / 1000).toFixed(2));
}

export const GET = createRoute({
	method: "GET",
	path: "/api/runs/[runId]",
	auth: true,
	operation: "getRun",
})(async ({ params, user }) => {
	const { runId } = params;

	const record = await prisma.runRecord.findUnique({
		where: { id: runId },
		select: {
			userId: true,
			startTime: true,
			endTime: true,
			duration: true,
			distance: true,
			avgPace: true,
			trackPoints: true,
			calories: true,
			splits: true,
			notes: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	if (!record) {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}

	if (record.userId !== user!.id) {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}

	// 跑步进行中：从 Redis 轨迹点推算实时数据
	if (!record.endTime) {
		const points = await getAllPoints(runId);
		const now = Date.now();

		const duration =
			points.length >= 2
				? Math.floor(
						(points[points.length - 1].timestamp - points[0].timestamp) / 1000,
					)
				: Math.floor((now - new Date(record.startTime).getTime()) / 1000);

		const distance = calcLiveDistance(points);
		const avgPace = duration > 0 ? calcPace(distance, duration) : "--";

		return NextResponse.json({
			...record,
			duration,
			distance,
			avgPace,
			points,
		});
	}

	return NextResponse.json(record);
});

export const PATCH = createRoute({
	method: "PATCH",
	path: "/api/runs/[runId]",
	auth: true,
	operation: "updateRun",
})(async ({ request, params, user }) => {
	const { runId } = params;

	// Verify ownership
	const existing = await prisma.runRecord.findUnique({
		where: { id: runId },
		select: { userId: true },
	});

	if (!existing || existing.userId !== user!.id) {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}

	const {
		endTime,
		duration,
		distance,
		avgPace,
		trackPoints,
		calories,
		splits,
		notes,
	} = await request.json();

	if (!endTime) {
		return NextResponse.json({ error: "endTime required" }, { status: 400 });
	}

	await prisma.runRecord.update({
		where: { id: runId },
		data: {
			endTime: new Date(endTime),
			duration,
			distance,
			avgPace,
			...(trackPoints !== undefined && { trackPoints }),
			...(calories !== undefined && { calories }),
			...(splits !== undefined && { splits }),
			...(notes !== undefined && { notes }),
		},
	});

	try {
		await clearRunSession(runId, user!.id);
	} catch (e) {
		// 清理类操作：跑步记录已落库，Redis 会话清理失败仅影响临时缓存，记日志而非失败整个请求
		logError(e instanceof Error ? e : new Error(String(e)), {
			userId: user!.id,
			runRecordId: runId,
			operation: "clearRunSession",
		});
	}

	return NextResponse.json({ ok: true });
});
