import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/playgrounds/[id]/leaderboard/route";

const authApi = vi.hoisted(() => ({ getSession: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
	playGround: { findUnique: vi.fn() },
	playGroundRankingList: { findUnique: vi.fn() },
}));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/auth", () => ({ auth: { api: authApi } }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
	createRequestLogger: vi.fn(() => ({ debug: vi.fn(), warn: vi.fn() })),
	PerformanceLogger: class {
		error = vi.fn();
		checkpoint = vi.fn();
		done = vi.fn();
	},
	logApiRequest: vi.fn(),
	logError: vi.fn(),
}));

describe("playground leaderboard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		authApi.getSession.mockResolvedValue(null);
		prismaMock.playGround.findUnique.mockResolvedValue({
			visibility: "PUBLIC",
			users: [],
		});
		prismaMock.playGroundRankingList.findUnique.mockResolvedValue({
			runRecords: [
				{
					userId: "user-1",
					distanceMeters: 5_000,
					durationSeconds: 1_500,
					paceSecondsPerKm: 300,
					user: { id: "user-1", name: "Runner", image: null },
				},
			],
		});
	});

	it("aggregates only canonical Completed Run fields without route data", async () => {
		const response = await GET(
			new Request("http://localhost/api/playgrounds/pg-1/leaderboard"),
			{ params: Promise.resolve({ id: "pg-1" }) },
		);
		const body = await response.json();
		expect(body.leaderboard[0]).toEqual({
			userId: "user-1",
			name: "Runner",
			image: null,
			totalDistanceMeters: 5_000,
			totalDurationSeconds: 1_500,
			runCount: 1,
			bestPaceSecondsPerKm: 300,
			rank: 1,
		});
		expect(prismaMock.playGroundRankingList.findUnique).toHaveBeenCalledWith(
			expect.objectContaining({
				include: {
					runRecords: expect.objectContaining({
						where: expect.objectContaining({ status: "COMPLETED" }),
						select: expect.not.objectContaining({ trackPoints: true }),
					}),
				},
			}),
		);
	});
});
