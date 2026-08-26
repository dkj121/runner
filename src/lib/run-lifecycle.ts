import "server-only";
import {
	clearRunSession,
	getAllPoints,
	getRunEvents,
	pushRunEvents,
} from "@/lib/gps-cache";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const ACTIVE_RUN_LIMIT_MS = 12 * 60 * 60 * 1_000;
export const INCOMPLETE_RUN_RETENTION_MS = 24 * 60 * 60 * 1_000;

export async function enforceRunLifecycle(
	runId: string,
	userId: string,
	now = Date.now(),
) {
	const record = await prisma.runRecord.findUnique({
		where: { id: runId },
		select: { id: true, userId: true, status: true, startTime: true },
	});
	if (!record) {
		await clearRunSession(runId, userId);
		return "missing" as const;
	}
	if (record.userId !== userId) return "missing" as const;
	if (record.status === "COMPLETED") return "completed" as const;

	const age = now - record.startTime.getTime();
	if (age >= INCOMPLETE_RUN_RETENTION_MS) {
		await prisma.runRecord.deleteMany({
			where: { id: runId, userId, status: { not: "COMPLETED" } },
		});
		try {
			await clearRunSession(runId, userId);
		} catch (error) {
			logError(error instanceof Error ? error : new Error(String(error)), {
				userId,
				runRecordId: runId,
				operation: "expireRunSession",
			});
			throw error;
		}
		return "expired" as const;
	}

	if (record.status === "ACTIVE" && age >= ACTIVE_RUN_LIMIT_MS) {
		const [events, points] = await Promise.all([
			getRunEvents(runId),
			getAllPoints(runId),
		]);
		if (events.at(-1)?.type !== "STOP") {
			const latestItem = [...events, ...points].reduce(
				(latest, item) => (item.sequence > latest.sequence ? item : latest),
				{ sequence: -1, timestamp: record.startTime.getTime() },
			);
			await pushRunEvents(runId, [
				{
					type: "STOP",
					sequence: latestItem.sequence + 1,
					timestamp: Math.max(
						record.startTime.getTime() + ACTIVE_RUN_LIMIT_MS,
						latestItem.timestamp + 1,
					),
				},
			]);
		}
		await prisma.runRecord.updateMany({
			where: { id: runId, userId, status: "ACTIVE" },
			data: { status: "PENDING_COMPLETION", activeSessionOwnerId: null },
		});
		return "pending" as const;
	}

	return record.status === "PENDING_COMPLETION"
		? ("pending" as const)
		: ("active" as const);
}

export async function expireOwnedRunSessions(userId: string, now = Date.now()) {
	const records = await prisma.runRecord.findMany({
		where: { userId, status: { not: "COMPLETED" } },
		select: { id: true },
	});
	for (const record of records) {
		await enforceRunLifecycle(record.id, userId, now);
	}
}
