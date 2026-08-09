import "server-only";
import { getRedis } from "@/lib/redis";

export interface GpsPoint {
	lat: number;
	lng: number;
	timestamp: number;
	distance?: number;
	pace?: string;
}

const RUN_TTL = 7200;

function metaKey(runId: string) {
	return `run:${runId}:meta`;
}
function pointsKey(runId: string) {
	return `run:${runId}:points`;
}
function activeKey(userId: string) {
	return `run:active:${userId}`;
}

/**
 * 这些函数不再吞掉 Redis 错误 —— 错误会向上抛出，由调用方决定如何处理。
 * 关键数据写入（pushPoints）必须让调用方感知失败，避免静默丢失。
 */
export async function createRunSession(runId: string, userId: string) {
	const redis = await getRedis();
	await redis
		.multi()
		.hSet(metaKey(runId), {
			userId,
			startTime: Date.now(),
			status: "active",
		})
		.expire(metaKey(runId), RUN_TTL)
		.set(activeKey(userId), runId, { EX: RUN_TTL })
		.exec();
}

export async function pushPoints(runId: string, points: GpsPoint[]) {
	if (points.length === 0) return;
	const redis = await getRedis();
	const key = pointsKey(runId);
	const pipe = redis.multi();
	for (const p of points) {
		pipe.lPush(key, JSON.stringify(p));
	}
	pipe.expire(key, RUN_TTL);
	await pipe.exec();
}

export async function getAllPoints(runId: string): Promise<GpsPoint[]> {
	const redis = await getRedis();
	const raw = await redis.lRange(pointsKey(runId), 0, -1);
	return raw.reverse().map((s) => JSON.parse(s) as GpsPoint);
}

export async function getActiveRunId(userId: string): Promise<string | null> {
	const redis = await getRedis();
	return await redis.get(activeKey(userId));
}

export async function getRunMeta(runId: string) {
	const redis = await getRedis();
	return (await redis.hGetAll(metaKey(runId))) as Record<
		string,
		string
	> | null;
}

export async function clearRunSession(runId: string, userId: string) {
	const redis = await getRedis();
	await redis.del([metaKey(runId), activeKey(userId), pointsKey(runId)]);
}