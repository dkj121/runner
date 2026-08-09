import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRunSession } from "@/lib/gps-cache";
import { logError } from "@/lib/logger";
import { createRoute } from "@/lib/create-route";

export const POST = createRoute({
	method: "POST",
	path: "/api/runs",
	auth: true,
	operation: "createRun",
})(async ({ user }) => {
	const record = await prisma.runRecord.create({
		data: { userId: user!.id, startTime: new Date() },
	});

	try {
		await createRunSession(record.id, user!.id);
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
			where: { userId: user!.id },
			orderBy: { startTime: "desc" },
			take,
			skip,
		}),
		prisma.runRecord.count({ where: { userId: user!.id } }),
	]);

	return NextResponse.json({ records, total });
});
