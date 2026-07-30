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

export async function createRunSession(runId: string, userId: string) {
	try {
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
	} catch (e) {
		console.error("[gps-cache] createRunSession:", e);
	}
}

export async function pushPoints(runId: string, points: GpsPoint[]) {
	if (points.length === 0) return;
	try {
		const redis = await getRedis();
		const key = pointsKey(runId);
		const pipe = redis.multi();
		for (const p of points) {
			pipe.lPush(key, JSON.stringify(p));
		}
		pipe.expire(key, RUN_TTL);
		await pipe.exec();
	} catch (e) {
		console.error("[gps-cache] pushPoints:", e);
	}
}

export async function getAllPoints(runId: string): Promise<GpsPoint[]> {
	try {
		const redis = await getRedis();
		const raw = await redis.lRange(pointsKey(runId), 0, -1);
		return raw.reverse().map((s) => JSON.parse(s) as GpsPoint);
	} catch (e) {
		console.error("[gps-cache] getAllPoints:", e);
		return [];
	}
}

export async function getActiveRunId(userId: string): Promise<string | null> {
	try {
		const redis = await getRedis();
		return await redis.get(activeKey(userId));
	} catch (e) {
		console.error("[gps-cache] getActiveRunId:", e);
		return null;
	}
}

export async function getRunMeta(runId: string) {
	try {
		const redis = await getRedis();
		return (await redis.hGetAll(metaKey(runId))) as Record<
			string,
			string
		> | null;
	} catch (e) {
		console.error("[gps-cache] getRunMeta:", e);
		return null;
	}
}

export async function clearRunSession(runId: string, userId: string) {
	try {
		const redis = await getRedis();
		await redis.del([metaKey(runId), activeKey(userId)]);
	} catch (e) {
		console.error("[gps-cache] clearRunSession:", e);
	}
}
