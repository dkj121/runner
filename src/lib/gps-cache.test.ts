import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
	get: vi.fn(async () => null),
	hGet: vi.fn<() => Promise<string | null>>(async () => null),
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

	afterEach(() => {
		vi.useRealTimers();
	});

	it("keeps accepted points ordered and idempotent after a lost response replay", async () => {
		const batch = [
			{
				sequence: 1,
				segmentIndex: 0,
				lat: 0,
				lng: 0.0001,
				timestamp: 2_500,
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

	it("keeps point expiry fixed at twenty-four hours from session start", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-23T12:00:00.000Z"));
		redisMock.hGet.mockResolvedValue(
			String(new Date("2026-08-23T00:00:00.000Z").getTime()),
		);

		await pushPoints("run-1", [
			{
				sequence: 0,
				segmentIndex: 0,
				lat: 0,
				lng: 0,
				timestamp: 1_000,
				accuracy: 5,
				altitude: null,
			},
		]);

		expect(redisMock.expire).toHaveBeenCalledWith(
			"run:run-1:point-order",
			12 * 60 * 60,
		);
		expect(redisMock.expire).toHaveBeenCalledWith(
			"run:run-1:point-data",
			12 * 60 * 60,
		);
	});
});
