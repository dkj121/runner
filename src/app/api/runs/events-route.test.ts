import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as pushEvents } from "@/app/api/runs/[runId]/events/route";

const authApi = vi.hoisted(() => ({ getSession: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
	runRecord: { findUnique: vi.fn() },
}));
const gpsCacheMock = vi.hoisted(() => ({
	getRunEvents: vi.fn(),
	pushRunEvents: vi.fn(),
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

describe("run events API", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		authApi.getSession.mockResolvedValue({ user: { id: "user-1" } });
	});

	it("does not expose another runner's activity timeline", async () => {
		prismaMock.runRecord.findUnique.mockResolvedValue({
			userId: "user-2",
			status: "ACTIVE",
		});
		const response = await pushEvents(
			new Request("http://localhost/api/runs/run-1/events", {
				method: "POST",
				body: JSON.stringify({ events: [] }),
			}),
			{ params: Promise.resolve({ runId: "run-1" }) },
		);
		expect(response.status).toBe(404);
		expect(gpsCacheMock.pushRunEvents).not.toHaveBeenCalled();
	});

	it("returns a conflict without accepting an invalid event order", async () => {
		prismaMock.runRecord.findUnique.mockResolvedValue({
			userId: "user-1",
			status: "ACTIVE",
		});
		gpsCacheMock.pushRunEvents.mockResolvedValue({ accepted: 0, rejected: 1 });
		const response = await pushEvents(
			new Request("http://localhost/api/runs/run-1/events", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					events: [{ type: "RESUME", sequence: 1, timestamp: 2_000 }],
				}),
			}),
			{ params: Promise.resolve({ runId: "run-1" }) },
		);
		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({ accepted: 0, rejected: 1 });
	});
});
