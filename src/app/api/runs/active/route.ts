import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAllPoints, getRunEvents } from "@/lib/gps-cache";
import { createRoute } from "@/lib/create-route";
import { enforceRunLifecycle } from "@/lib/run-lifecycle";

export const GET = createRoute({
	method: "GET",
	path: "/api/runs/active",
	auth: true,
	operation: "getActiveRun",
})(async ({ user }) => {
	const record = await prisma.runRecord.findFirst({
		where: {
			userId: user!.id,
			status: { in: ["ACTIVE", "PENDING_COMPLETION"] },
		},
		orderBy: { startTime: "desc" },
		select: { id: true, status: true, startTime: true },
	});

	if (!record) return NextResponse.json({ active: null });

	await enforceRunLifecycle(record.id, user!.id);
	const currentRecord = await prisma.runRecord.findUnique({
		where: { id: record.id },
		select: { status: true },
	});
	const [points, events] = await Promise.all([
		getAllPoints(record.id),
		getRunEvents(record.id),
	]);
	const lastEvent = events.at(-1)?.type;
	const status =
		currentRecord?.status === "PENDING_COMPLETION"
			? "pending_completion"
			: lastEvent === "PAUSE"
				? "paused"
				: "running";

	return NextResponse.json({
		active: {
			runId: record.id,
			status,
			startTime: record.startTime,
			points,
			events,
		},
	});
});
