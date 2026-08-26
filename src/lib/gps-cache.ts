import "server-only";
import { getRedis } from "@/lib/redis";
import type { SequencedTrackPoint } from "@/lib/run-contract";
import type { RunEvent } from "@/lib/run-contract";
import { validateTrackPoints } from "@/lib/track-point-validation";
import { validateRunEvents } from "@/lib/run-timeline";

export const ACTIVE_RUN_SECONDS = 12 * 60 * 60;
export const RUN_RETENTION_SECONDS = 24 * 60 * 60;

function metaKey(runId: string) {
	return `run:${runId}:meta`;
}
function pointsKey(runId: string) {
	return `run:${runId}:point-order`;
}
function pointDataKey(runId: string) {
	return `run:${runId}:point-data`;
}
function eventOrderKey(runId: string) {
	return `run:${runId}:event-order`;
}
function eventDataKey(runId: string) {
	return `run:${runId}:event-data`;
}
function activeKey(userId: string) {
	return `run:active:${userId}`;
}

async function remainingRetentionSeconds(runId: string) {
	const redis = await getRedis();
	const startTime = Number(await redis.hGet(metaKey(runId), "startTime"));
	if (!Number.isFinite(startTime) || startTime <= 0) {
		return RUN_RETENTION_SECONDS;
	}
	return Math.max(
		1,
		Math.ceil((startTime + RUN_RETENTION_SECONDS * 1_000 - Date.now()) / 1_000),
	);
}

/**
 * 这些函数不再吞掉 Redis 错误 —— 错误会向上抛出，由调用方决定如何处理。
 * 关键数据写入（pushPoints）必须让调用方感知失败，避免静默丢失。
 */
export async function createRunSession(
	runId: string,
	userId: string,
	startTimestamp = Date.now(),
) {
	const redis = await getRedis();
	const startEvent: RunEvent = {
		type: "START",
		sequence: 0,
		timestamp: startTimestamp,
	};
	await redis
		.multi()
		.hSet(metaKey(runId), {
			userId,
			startTime: startTimestamp,
			status: "active",
		})
		.expire(metaKey(runId), RUN_RETENTION_SECONDS)
		.hSet(eventDataKey(runId), "0", JSON.stringify(startEvent))
		.zAdd(eventOrderKey(runId), { score: 0, value: "0" })
		.expire(eventDataKey(runId), RUN_RETENTION_SECONDS)
		.expire(eventOrderKey(runId), RUN_RETENTION_SECONDS)
		.set(activeKey(userId), runId, { EX: ACTIVE_RUN_SECONDS })
		.exec();
}

export async function pushRunEvents(runId: string, events: unknown[]) {
	if (events.length === 0) return { accepted: 0, rejected: 0 };
	const redis = await getRedis();
	const retentionSeconds = await remainingRetentionSeconds(runId);
	const existing = await getRunEvents(runId);
	const points = await getAllPoints(runId);
	const minimumSequenceExclusive = Math.max(
		existing.at(-1)?.sequence ?? -1,
		points.at(-1)?.sequence ?? -1,
	);
	const result = validateRunEvents(existing, events, minimumSequenceExclusive);

	for (const event of result.accepted) {
		await redis.eval(
			"if redis.call('HSETNX', KEYS[2], ARGV[1], ARGV[2]) == 1 then redis.call('ZADD', KEYS[1], ARGV[1], ARGV[1]); return 1 else return 0 end",
			{
				keys: [eventOrderKey(runId), eventDataKey(runId)],
				arguments: [String(event.sequence), JSON.stringify(event)],
			},
		);
	}

	await Promise.all([
		redis.expire(eventOrderKey(runId), retentionSeconds),
		redis.expire(eventDataKey(runId), retentionSeconds),
	]);
	return { accepted: result.accepted.length, rejected: result.rejected };
}

export async function getRunEvents(runId: string): Promise<RunEvent[]> {
	const redis = await getRedis();
	const sequences = await redis.zRange(eventOrderKey(runId), 0, -1);
	if (sequences.length === 0) return [];
	const raw = await redis.hmGet(eventDataKey(runId), sequences);
	return raw
		.filter((value): value is string => value !== null)
		.map((value) => JSON.parse(value) as RunEvent);
}

export async function pushPoints(runId: string, points: unknown[]) {
	if (points.length === 0) return { accepted: 0, rejected: 0 };
	const redis = await getRedis();
	const retentionSeconds = await remainingRetentionSeconds(runId);
	const existing = await getAllPoints(runId);
	const events = await getRunEvents(runId);
	const latestEventSequence = events.at(-1)?.sequence ?? -1;
	const existingSegmentIndex = Math.max(
		-1,
		...existing.map((point) => point.segmentIndex),
	);
	const maxSegmentIndex = Math.max(
		existingSegmentIndex + 1,
		events.filter((event) => event.type === "RESUME").length,
	);
	const result = validateTrackPoints(existing, points, {
		minimumSequenceExclusive: latestEventSequence,
		maxSegmentIndex,
	});

	for (const point of result.accepted) {
		await redis.eval(
			"if redis.call('HSETNX', KEYS[2], ARGV[1], ARGV[2]) == 1 then redis.call('ZADD', KEYS[1], ARGV[1], ARGV[1]); return 1 else return 0 end",
			{
				keys: [pointsKey(runId), pointDataKey(runId)],
				arguments: [String(point.sequence), JSON.stringify(point)],
			},
		);
	}

	await Promise.all([
		redis.expire(pointsKey(runId), retentionSeconds),
		redis.expire(pointDataKey(runId), retentionSeconds),
	]);
	return { accepted: result.accepted.length, rejected: result.rejected };
}

export async function getAllPoints(
	runId: string,
): Promise<SequencedTrackPoint[]> {
	const redis = await getRedis();
	const sequences = await redis.zRange(pointsKey(runId), 0, -1);
	if (sequences.length === 0) return [];
	const raw = await redis.hmGet(pointDataKey(runId), sequences);
	return raw
		.filter((value): value is string => value !== null)
		.map((value) => JSON.parse(value) as SequencedTrackPoint);
}

export async function getActiveRunId(userId: string): Promise<string | null> {
	const redis = await getRedis();
	return await redis.get(activeKey(userId));
}

export async function getRunMeta(runId: string) {
	const redis = await getRedis();
	return (await redis.hGetAll(metaKey(runId))) as Record<string, string> | null;
}

export async function clearRunSession(runId: string, userId: string) {
	const redis = await getRedis();
	const keys = [
		metaKey(runId),
		pointsKey(runId),
		pointDataKey(runId),
		eventOrderKey(runId),
		eventDataKey(runId),
	];
	if ((await redis.get(activeKey(userId))) === runId) {
		keys.push(activeKey(userId));
	}
	await redis.del(keys);
}
