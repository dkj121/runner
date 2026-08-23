import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAllPoints, pushPoints } from "@/lib/gps-cache";

const redisState = vi.hoisted(() => ({
	points: new Map<string, string>(),
	order: new Set<string>(),
}));

const redisMock = vi.hoisted(() => ({
	del: vi.fn(),
	eval: vi.fn(
		async (_script: string, options: { arguments: [string, string] }) => {
			const [sequence, json] = options.arguments;
			if (redisState.points.has(sequence)) return 0;
			redisState.points.set(sequence, json);
			redisState.order.add(sequence);
			return 1;
		},
	),
	expire: vi.fn(async () => true),
	hmGet: vi.fn(async (_key: string, sequences: string[]) =>
		sequences.map((sequence) => redisState.points.get(sequence) ?? null),
	),
	zRange: vi.fn(async (key: string) =>
		key.includes("event")
			? []
			: [...redisState.order].sort(
					(left, right) => Number(left) - Number(right),
				),
	),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/redis", () => ({
	getRedis: vi.fn(async () => redisMock),
}));

describe("GPS cache", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		redisState.points.clear();
		redisState.order.clear();
	});

	it("keeps accepted points ordered and idempotent after a lost response replay", async () => {
		const batch = [
			{
				sequence: 1,
				segmentIndex: 0,
				lat: 0,
				lng: 0.0001,
				timestamp: 2_000,
				accuracy: 5,
				altitude: null,
			},
			{
				sequence: 0,
				segmentIndex: 0,
				lat: 0,
				lng: 0,
				timestamp: 1_000,
				accuracy: 5,
				altitude: null,
			},
		];

		await pushPoints("run-1", batch);
		await pushPoints("run-1", batch);

		const points = await getAllPoints("run-1");
		expect(points.map(({ sequence }) => sequence)).toEqual([0, 1]);
		expect(redisMock.eval).toHaveBeenCalledTimes(2);
	});
});
