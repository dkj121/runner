import "server-only";
import { redis } from "@/lib/redis";

export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
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
    await redis
      .pipeline()
      .hset(metaKey(runId), {
        userId,
        startTime: Date.now(),
        status: "active",
      })
      .expire(metaKey(runId), RUN_TTL)
      .set(activeKey(userId), runId, "EX", RUN_TTL)
      .exec();
  } catch (e) {
    console.error("[run-store] createRunSession:", e);
  }
}

export async function pushPoints(runId: string, points: GpsPoint[]) {
  if (points.length === 0) return;
  try {
    const key = pointsKey(runId);
    const pipe = redis.pipeline();
    for (const p of points) {
      pipe.lpush(key, JSON.stringify(p));
    }
    pipe.expire(key, RUN_TTL);
    await pipe.exec();
  } catch (e) {
    console.error("[run-store] pushPoints:", e);
  }
}

export async function getAllPoints(runId: string): Promise<GpsPoint[]> {
  try {
    const raw = await redis.lrange(pointsKey(runId), 0, -1);
    return raw.reverse().map((s) => JSON.parse(s) as GpsPoint);
  } catch (e) {
    console.error("[run-store] getAllPoints:", e);
    return [];
  }
}

export async function getActiveRunId(
  userId: string,
): Promise<string | null> {
  try {
    return await redis.get(activeKey(userId));
  } catch (e) {
    console.error("[run-store] getActiveRunId:", e);
    return null;
  }
}

export async function getRunMeta(runId: string) {
  try {
    return (await redis.hgetall(metaKey(runId))) as Record<string, string> | null;
  } catch (e) {
    console.error("[run-store] getRunMeta:", e);
    return null;
  }
}

export async function clearRunSession(runId: string, userId: string) {
  try {
    await redis.del(metaKey(runId), pointsKey(runId), activeKey(userId));
  } catch (e) {
    console.error("[run-store] clearRunSession:", e);
  }
}
