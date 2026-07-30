import "dotenv/config";
import { createClient } from "redis";

const redisUrl =
	process.env.REDIS_URL ||
	(process.env.REDIS_HOST && process.env.REDIS_PORT
		? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
		: undefined);

export const redis = createClient({
	...(redisUrl ? { url: redisUrl } : {}),
	password: process.env.REDIS_ACL_PASSWORD || undefined,
});

redis.on("error", (err) => console.error("[redis] error:", err));

redis.connect().catch((err) => {
	console.error("[redis] connect failed:", err);
});
