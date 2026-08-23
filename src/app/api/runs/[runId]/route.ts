import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearRunSession, getAllPoints, getRunEvents } from "@/lib/gps-cache";
import { calcDistance, calcPace } from "@/lib/track-calc";
import { canonicalizeLegacyRunMeasurements } from "@/lib/run-contract";
import {
	calculateActiveDuration,
	groupTrackSegments,
} from "@/lib/run-timeline";
import { logError } from "@/lib/logger";
import { createRoute } from "@/lib/create-route";

function calcLiveDistance(
	points: { lat: number; lng: number; segmentIndex?: number }[],
): number {
	const distance = groupTrackSegments(points).reduce(
		(total, segment) => total + calcDistance(segment),
		0,
	);
	return parseFloat(distance.toFixed(2));
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
			status: true,
			duration: true,
			durationSeconds: true,
			distance: true,
			distanceMeters: true,
			previewDistanceMeters: true,
			paceSecondsPerKm: true,
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
		const [points, events] = await Promise.all([
			getAllPoints(runId),
			getRunEvents(runId),
		]);
		const now = Date.now();

		const duration =
			events.length > 0
				? calculateActiveDuration(events, now)
				: points.length >= 2
					? Math.floor(
							(points[points.length - 1].timestamp - points[0].timestamp) /
								1000,
						)
					: Math.floor((now - new Date(record.startTime).getTime()) / 1000);

		const distance = calcLiveDistance(points);
		const avgPace = duration > 0 ? calcPace(distance, duration) : "--";
		const canonical = canonicalizeLegacyRunMeasurements({ duration, distance });

		return NextResponse.json({
			...record,
			duration,
			distance,
			avgPace,
			...canonical,
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
	const events = await getRunEvents(runId);
	const activeDuration =
		events.length > 0 ? calculateActiveDuration(events) : duration;
	const canonical = canonicalizeLegacyRunMeasurements({
		duration: activeDuration,
		distance,
	});

	await prisma.runRecord.update({
		where: { id: runId },
		data: {
			endTime: new Date(endTime),
			status: "COMPLETED",
			activeSessionOwnerId: null,
			duration: activeDuration,
			durationSeconds: canonical.durationSeconds,
			distance,
			distanceMeters: canonical.distanceMeters,
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

export const DELETE = createRoute({
	method: "DELETE",
	path: "/api/runs/[runId]",
	auth: true,
	operation: "abandonRun",
})(async ({ params, user }) => {
	const record = await prisma.runRecord.findUnique({
		where: { id: params.runId },
		select: { userId: true, status: true },
	});
	if (!record || record.userId !== user!.id) {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}
	if (record.status === "COMPLETED") {
		return NextResponse.json({ error: "completed run" }, { status: 409 });
	}
	await prisma.runRecord.delete({ where: { id: params.runId } });
	await clearRunSession(params.runId, user!.id);
	return NextResponse.json({ abandoned: true });
});
