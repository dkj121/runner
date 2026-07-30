import "server-only";
import { createClient, type RedisClientType } from "redis";

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

function getUrl(): string {
	return (
		process.env.REDIS_URL ||
		`redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
	);
}

async function connect(): Promise<RedisClientType> {
	const url = getUrl();
	const c = createClient({
		url,
		password: process.env.REDIS_ACL_PASSWORD || undefined,
	});
	c.on("error", (err) => console.error("[redis] error:", err));
	await c.connect();
	return c;
}

export async function getRedis(): Promise<RedisClientType> {
	if (client) return client;
	if (!connecting) {
		connecting = connect().catch((err) => {
			connecting = null;
			client = null;
			throw err;
		});
	}
	client = await connecting;
	return client;
}
