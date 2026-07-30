import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clearRunSession, getAllPoints } from "@/lib/gps-cache";

// inline haversine to avoid importing track-calc.ts (browser-only amap-sdk)
function haversineDistance(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const R = 6_371_000;
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcLiveDistance(points: { lat: number; lng: number }[]): number {
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		const d = haversineDistance(
			points[i - 1].lat,
			points[i - 1].lng,
			points[i].lat,
			points[i].lng,
		);
		if (d > 5) total += d;
	}
	return parseFloat((total / 1000).toFixed(2));
}

function calcLivePace(distanceKm: number, durationSec: number): string {
	if (distanceKm <= 0 || durationSec <= 0) return "--";
	const secPerKm = Math.round(durationSec / distanceKm);
	const m = Math.floor(secPerKm / 60);
	const s = secPerKm % 60;
	return `${m}:${String(s).padStart(2, "0")} /km`;
}

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

	if (record.userId !== session.user.id) {
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
		const avgPace = calcLivePace(distance, duration);

		return NextResponse.json({
			...record,
			duration,
			distance,
			avgPace,
			points,
		});
	}

	return NextResponse.json(record);
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ runId: string }> },
) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { runId } = await params;

	// Verify ownership
	const existing = await prisma.runRecord.findUnique({
		where: { id: runId },
		select: { userId: true },
	});

	if (!existing || existing.userId !== session.user.id) {
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

	await clearRunSession(runId, session.user.id);

	return NextResponse.json({ ok: true });
}
