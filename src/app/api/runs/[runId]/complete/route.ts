import { NextResponse } from "next/server";
import { createRoute } from "@/lib/create-route";
import {
	calculateConfirmedRunResult,
	distanceCorrectionPercent,
} from "@/lib/confirmed-run";
import { clearRunSession, getAllPoints, getRunEvents } from "@/lib/gps-cache";
import { prisma } from "@/lib/prisma";

function formatPace(paceSecondsPerKm: number | null): string {
	if (paceSecondsPerKm === null) return "--";
	return `${Math.floor(paceSecondsPerKm / 60)}:${String(paceSecondsPerKm % 60).padStart(2, "0")} /km`;
}

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
	const avgPace = formatPace(confirmed.paceSecondsPerKm);
	const completed = await prisma.$transaction(async (transaction) => {
		const transition = await transaction.runRecord.updateMany({
			where: { id: params.runId, status: "PENDING_COMPLETION" },
			data: {
				status: "COMPLETED",
				activeSessionOwnerId: null,
				endTime: stopTime,
				duration: confirmed.durationSeconds,
				durationSeconds: confirmed.durationSeconds,
				distance: confirmed.distanceMeters / 1_000,
				distanceMeters: confirmed.distanceMeters,
				previewDistanceMeters,
				paceSecondsPerKm: confirmed.paceSecondsPerKm,
				avgPace,
				trackPoints: JSON.parse(
					JSON.stringify({ segments: confirmed.trackSegments }),
				),
				calories: confirmed.calories,
				splits: confirmed.splits,
			},
		});
		if (transition.count === 0) return null;
		await transaction.totalRunRecord.upsert({
			where: { userId: user!.id },
			create: {
				userId: user!.id,
				totalTime: confirmed.durationSeconds,
				totalDistance: confirmed.distanceMeters / 1_000,
				avgPace,
			},
			update: {
				totalTime: { increment: confirmed.durationSeconds },
				totalDistance: { increment: confirmed.distanceMeters / 1_000 },
				avgPace,
			},
		});
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
