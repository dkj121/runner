import { NextResponse } from "next/server";
import { createRoute } from "@/lib/create-route";
import { clearRunSession, getAllPoints, getRunEvents } from "@/lib/gps-cache";
import { prisma } from "@/lib/prisma";
import { calculateActiveDuration } from "@/lib/run-timeline";

export const POST = createRoute({
	method: "POST",
	path: "/api/runs/[runId]/pending-completion",
	auth: true,
	operation: "prepareRunCompletion",
})(async ({ params, user }) => {
	const record = await prisma.runRecord.findUnique({
		where: { id: params.runId },
		select: { userId: true, status: true },
	});
	if (!record || record.userId !== user!.id) {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}
	if (record.status === "PENDING_COMPLETION") {
		return NextResponse.json({ pending: true });
	}
	if (record.status !== "ACTIVE") {
		return NextResponse.json({ error: "run is not active" }, { status: 409 });
	}

	const [points, events] = await Promise.all([
		getAllPoints(params.runId),
		getRunEvents(params.runId),
	]);
	if (events.at(-1)?.type !== "STOP") {
		return NextResponse.json({ error: "stop event required" }, { status: 409 });
	}
	const durationSeconds = calculateActiveDuration(events);
	if (durationSeconds < 10 || points.length < 2) {
		await prisma.runRecord.delete({ where: { id: params.runId } });
		await clearRunSession(params.runId, user!.id);
		return NextResponse.json({ abandoned: true, reason: "minimum_threshold" });
	}

	await prisma.runRecord.update({
		where: { id: params.runId },
		data: { status: "PENDING_COMPLETION" },
	});
	return NextResponse.json({ pending: true });
});
