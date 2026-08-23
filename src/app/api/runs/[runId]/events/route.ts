import { NextResponse } from "next/server";
import { createRoute } from "@/lib/create-route";
import { getRunEvents, pushRunEvents } from "@/lib/gps-cache";
import { prisma } from "@/lib/prisma";

async function findOwnedActiveRun(runId: string, userId: string) {
	const record = await prisma.runRecord.findUnique({
		where: { id: runId },
		select: { userId: true, status: true },
	});
	return record?.userId === userId && record.status === "ACTIVE";
}

export const GET = createRoute({
	method: "GET",
	path: "/api/runs/[runId]/events",
	auth: true,
	operation: "getRunEvents",
})(async ({ params, user }) => {
	if (!(await findOwnedActiveRun(params.runId, user!.id))) {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}
	return NextResponse.json({ events: await getRunEvents(params.runId) });
});

export const POST = createRoute({
	method: "POST",
	path: "/api/runs/[runId]/events",
	auth: true,
	operation: "pushRunEvents",
})(async ({ request, params, user }) => {
	if (!(await findOwnedActiveRun(params.runId, user!.id))) {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}
	const body = await request.json();
	if (!Array.isArray(body.events)) {
		return NextResponse.json(
			{ error: "events array required" },
			{ status: 400 },
		);
	}
	const result = await pushRunEvents(params.runId, body.events);
	if (result.rejected > 0) {
		return NextResponse.json(
			{ error: "invalid run event order", ...result },
			{ status: 409 },
		);
	}
	return NextResponse.json({ ok: true, ...result });
});
