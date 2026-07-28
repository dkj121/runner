import "dotenv/config";
import { createClient } from "redis";

export const redis = createClient({
	url:
		process.env.REDIS_URL ||
		`redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
	password: process.env.REDIS_ACL_PASSWORD || undefined,
});

redis.on("error", (err) => console.error("[redis] error:", err));

redis.connect().catch((err) => {
	console.error("[redis] connect failed:", err);
	process.exit(1);
});
