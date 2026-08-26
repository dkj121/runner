import { NextResponse } from "next/server";
import { createRoute } from "@/lib/create-route";
import {
	calculateConfirmedRunResult,
	distanceCorrectionPercent,
} from "@/lib/confirmed-run";
import { clearRunSession, getAllPoints, getRunEvents } from "@/lib/gps-cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "../../../../../../generated/prisma/client";

function confirmedResponse(record: {
	id: string;
	endTime: Date | null;
	durationSeconds: number;
	distanceMeters: number;
	previewDistanceMeters: number | null;
	paceSecondsPerKm: number | null;
	calories: number;
	trackPoints: unknown;
	splits: unknown;
}) {
	const correctionPercent = distanceCorrectionPercent(
		record.previewDistanceMeters ?? record.distanceMeters,
		record.distanceMeters,
	);
	return {
		runId: record.id,
		endTime: record.endTime?.toISOString() ?? null,
		durationSeconds: record.durationSeconds,
		distanceMeters: record.distanceMeters,
		paceSecondsPerKm: record.paceSecondsPerKm,
		calories: record.calories,
		trackSegments: record.trackPoints,
		splits: record.splits,
		correctionPercent,
		materiallyCorrected: correctionPercent > 5,
	};
}

function matchesCompletion(
	record: { endTime: Date | null; previewDistanceMeters: number | null },
	stopTime: Date,
	previewDistanceMeters: number,
): boolean {
	return (
		record.endTime?.getTime() === stopTime.getTime() &&
		Math.abs(
			(record.previewDistanceMeters ?? previewDistanceMeters) -
				previewDistanceMeters,
		) < 0.01
	);
}

export const POST = createRoute({
	method: "POST",
	path: "/api/runs/[runId]/complete",
	auth: true,
	operation: "completeRun",
})(async ({ request, params, user }) => {
	const body = await request.json();
	const stopTime = new Date(body.stopTime);
	const previewDistanceMeters = Number(body.preview?.distanceMeters);
	if (
		!Number.isFinite(stopTime.getTime()) ||
		!Number.isFinite(previewDistanceMeters)
	) {
		return NextResponse.json(
			{ error: "invalid completion request" },
			{ status: 400 },
		);
	}

	const existing = await prisma.runRecord.findUnique({
		where: { id: params.runId },
	});
	if (!existing || existing.userId !== user!.id) {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}
	if (existing.status === "COMPLETED") {
		if (!matchesCompletion(existing, stopTime, previewDistanceMeters)) {
			return NextResponse.json(
				{ error: "conflicting completion" },
				{ status: 409 },
			);
		}
		return NextResponse.json({ result: confirmedResponse(existing) });
	}
	if (existing.status !== "PENDING_COMPLETION") {
		return NextResponse.json(
			{ error: "run is not pending completion" },
			{ status: 409 },
		);
	}

	const [points, events] = await Promise.all([
		getAllPoints(params.runId),
		getRunEvents(params.runId),
	]);
	if (events.at(-1)?.type !== "STOP") {
		return NextResponse.json({ error: "stop event required" }, { status: 409 });
	}
	const confirmed = calculateConfirmedRunResult(points, events);
	const contributesToDistance = confirmed.trackSegments.some(
		(segment) => segment.length >= 2,
	);
	const completed = await prisma.$transaction(async (transaction) => {
		const transition = await transaction.runRecord.updateMany({
			where: { id: params.runId, status: "PENDING_COMPLETION" },
			data: {
				status: "COMPLETED",
				activeSessionOwnerId: null,
				endTime: stopTime,
				durationSeconds: confirmed.durationSeconds,
				distanceMeters: confirmed.distanceMeters,
				previewDistanceMeters,
				paceSecondsPerKm: confirmed.paceSecondsPerKm,
				trackPoints: contributesToDistance
					? JSON.parse(JSON.stringify({ segments: confirmed.trackSegments }))
					: null,
				calories: contributesToDistance ? confirmed.calories : 0,
				splits: contributesToDistance ? confirmed.splits : Prisma.DbNull,
			},
		});
		if (transition.count === 0) return null;
		const lifetime = await transaction.totalRunRecord.findFirst({
			where: { userId: user!.id },
			select: {
				id: true,
				totalDurationSeconds: true,
				totalDistanceMeters: true,
			},
		});
		const totalDurationSeconds =
			(lifetime?.totalDurationSeconds ?? 0) +
			(contributesToDistance ? confirmed.durationSeconds : 0);
		const totalDistanceMeters =
			(lifetime?.totalDistanceMeters ?? 0) +
			(contributesToDistance ? confirmed.distanceMeters : 0);
		const averagePaceSecondsPerKm =
			totalDistanceMeters > 0
				? Math.round(totalDurationSeconds / (totalDistanceMeters / 1_000))
				: null;
		if (lifetime) {
			await transaction.totalRunRecord.update({
				where: { id: lifetime.id },
				data: {
					totalDurationSeconds,
					totalDistanceMeters,
					averagePaceSecondsPerKm,
				},
			});
		} else {
			await transaction.totalRunRecord.create({
				data: {
					userId: user!.id,
					totalDurationSeconds,
					totalDistanceMeters,
					averagePaceSecondsPerKm,
				},
			});
		}
		return transaction.runRecord.findUnique({ where: { id: params.runId } });
	});

	const record =
		completed ??
		(await prisma.runRecord.findUnique({ where: { id: params.runId } }));
	if (!record || record.status !== "COMPLETED") {
		return NextResponse.json({ error: "completion conflict" }, { status: 409 });
	}
	if (!matchesCompletion(record, stopTime, previewDistanceMeters)) {
		return NextResponse.json(
			{ error: "conflicting completion" },
			{ status: 409 },
		);
	}
	await clearRunSession(params.runId, user!.id);
	return NextResponse.json({ result: confirmedResponse(record) });
});
