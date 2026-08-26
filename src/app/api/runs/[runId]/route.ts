import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearRunSession, getAllPoints, getRunEvents } from "@/lib/gps-cache";
import { calcDistance } from "@/lib/track-calc";
import {
	calculateActiveDuration,
	groupTrackSegments,
} from "@/lib/run-timeline";
import { createRoute } from "@/lib/create-route";
import { enforceRunLifecycle } from "@/lib/run-lifecycle";
import { COMPLETED_RUN_FILTER } from "@/lib/run-query";

function calcLiveDistance(
	points: { lat: number; lng: number; segmentIndex?: number }[],
): number {
	const distance = groupTrackSegments(points).reduce(
		(total, segment) => total + calcDistance(segment),
		0,
	);
	return Math.round(distance * 100_000) / 100;
}

export const GET = createRoute({
	method: "GET",
	path: "/api/runs/[runId]",
	auth: true,
	operation: "getRun",
})(async ({ params, user }) => {
	const { runId } = params;
	await enforceRunLifecycle(runId, user!.id);

	const record = await prisma.runRecord.findUnique({
		where: { id: runId },
		select: {
			id: true,
			userId: true,
			startTime: true,
			endTime: true,
			status: true,
			durationSeconds: true,
			distanceMeters: true,
			previewDistanceMeters: true,
			paceSecondsPerKm: true,
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

		const distanceMeters = calcLiveDistance(points);
		const paceSecondsPerKm =
			duration > 0 && distanceMeters > 0
				? Math.round(duration / (distanceMeters / 1_000))
				: null;

		return NextResponse.json({
			...record,
			durationSeconds: duration,
			distanceMeters,
			paceSecondsPerKm,
			points,
		});
	}

	return NextResponse.json(record);
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
	if (record.status !== "COMPLETED") {
		await prisma.runRecord.delete({ where: { id: params.runId } });
		await clearRunSession(params.runId, user!.id);
		return NextResponse.json({ abandoned: true });
	}

	await prisma.$transaction(async (transaction) => {
		await transaction.runRecord.delete({ where: { id: params.runId } });
		const remainingRuns = await transaction.runRecord.findMany({
			where: { userId: user!.id, ...COMPLETED_RUN_FILTER },
			select: { durationSeconds: true, distanceMeters: true },
		});
		const totals = remainingRuns.reduce(
			(result, run) => ({
				durationSeconds: result.durationSeconds + run.durationSeconds,
				distanceMeters: result.distanceMeters + run.distanceMeters,
			}),
			{ durationSeconds: 0, distanceMeters: 0 },
		);
		const paceSecondsPerKm =
			totals.distanceMeters > 0
				? Math.round(totals.durationSeconds / (totals.distanceMeters / 1_000))
				: null;
		await transaction.totalRunRecord.updateMany({
			where: { userId: user!.id },
			data: {
				totalDurationSeconds: totals.durationSeconds,
				totalDistanceMeters: totals.distanceMeters,
				averagePaceSecondsPerKm: paceSecondsPerKm,
			},
		});
	});
	return NextResponse.json({ deleted: true });
});
