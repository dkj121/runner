import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRunSession } from "@/lib/gps-cache";
import { logError } from "@/lib/logger";
import { createRoute } from "@/lib/create-route";
import { COMPLETED_RUN_FILTER } from "@/lib/run-query";
import { expireOwnedRunSessions } from "@/lib/run-lifecycle";

function isUniqueConstraintError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "P2002"
	);
}

export const POST = createRoute({
	method: "POST",
	path: "/api/runs",
	auth: true,
	operation: "createRun",
})(async ({ user }) => {
	await expireOwnedRunSessions(user!.id);
	let record: { id: string };
	const startTime = new Date();
	try {
		record = await prisma.runRecord.create({
			data: {
				userId: user!.id,
				startTime,
				status: "ACTIVE",
				activeSessionOwnerId: user!.id,
			},
		});
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			return NextResponse.json(
				{
					error: "An active run session already exists",
					code: "RUN_SESSION_CONFLICT",
				},
				{ status: 409 },
			);
		}
		throw error;
	}

	try {
		await createRunSession(record.id, user!.id, startTime.getTime());
	} catch (e) {
		// 会话启动失败：跑步记录已落库，此时降级为无 Redis 实时会话，记日志而非失败整个请求
		logError(e instanceof Error ? e : new Error(String(e)), {
			userId: user!.id,
			runRecordId: record.id,
			operation: "createRunSession",
		});
	}

	return NextResponse.json({ runId: record.id });
});

export const GET = createRoute({
	method: "GET",
	path: "/api/runs",
	auth: true,
	operation: "listRuns",
})(async ({ request, user }) => {
	const { searchParams } = new URL(request.url);
	const take = Math.min(Number(searchParams.get("take")) || 20, 100);
	const skip = Number(searchParams.get("skip")) || 0;

	const [records, total] = await Promise.all([
		prisma.runRecord.findMany({
			where: { userId: user!.id, ...COMPLETED_RUN_FILTER },
			orderBy: { startTime: "desc" },
			take,
			skip,
		}),
		prisma.runRecord.count({
			where: { userId: user!.id, ...COMPLETED_RUN_FILTER },
		}),
	]);

	return NextResponse.json({ records, total });
});
