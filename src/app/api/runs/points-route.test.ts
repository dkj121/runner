import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	GET as getPoints,
	POST as pushPoints,
} from "@/app/api/runs/[runId]/points/route";

const authApi = vi.hoisted(() => ({ getSession: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
	runRecord: { findUnique: vi.fn() },
}));
const gpsCacheMock = vi.hoisted(() => ({
	getAllPoints: vi.fn(),
	pushPoints: vi.fn(),
}));

vi.mock("next/headers", () => ({
	headers: vi.fn(async () => new Headers()),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: authApi } }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/gps-cache", () => gpsCacheMock);
vi.mock("@/lib/logger", () => ({
	createRequestLogger: vi.fn(() => ({})),
	PerformanceLogger: class {
		error = vi.fn();
	},
	logApiRequest: vi.fn(),
	logError: vi.fn(),
}));

describe("run points API", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		authApi.getSession.mockResolvedValue({ user: { id: "user-1" } });
	});

	it("hides active points from another runner", async () => {
		prismaMock.runRecord.findUnique.mockResolvedValue({
			userId: "user-2",
			status: "ACTIVE",
		});

		const response = await getPoints(
			new Request("http://localhost/api/runs/run-1/points"),
			{ params: Promise.resolve({ runId: "run-1" }) },
		);

		expect(response.status).toBe(404);
		expect(gpsCacheMock.getAllPoints).not.toHaveBeenCalled();
	});

	it("returns accepted and rejected counts to the owner", async () => {
		prismaMock.runRecord.findUnique.mockResolvedValue({
			userId: "user-1",
			status: "ACTIVE",
		});
		gpsCacheMock.pushPoints.mockResolvedValue({ accepted: 1, rejected: 1 });

		const response = await pushPoints(
			new Request("http://localhost/api/runs/run-1/points", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ points: [{ sequence: 0 }] }),
			}),
			{ params: Promise.resolve({ runId: "run-1" }) },
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			ok: true,
			accepted: 1,
			rejected: 1,
		});
	});
});
