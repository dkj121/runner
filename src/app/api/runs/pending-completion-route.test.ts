import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/runs/[runId]/pending-completion/route";

const authApi = vi.hoisted(() => ({ getSession: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
	runRecord: { delete: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}));
const gpsCacheMock = vi.hoisted(() => ({
	clearRunSession: vi.fn(),
	getAllPoints: vi.fn(),
	getRunEvents: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
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

describe("pending completion API", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		authApi.getSession.mockResolvedValue({ user: { id: "user-1" } });
		prismaMock.runRecord.findUnique.mockResolvedValue({
			userId: "user-1",
			status: "ACTIVE",
		});
		gpsCacheMock.clearRunSession.mockResolvedValue(undefined);
	});

	it("abandons a run below the minimum completion threshold", async () => {
		gpsCacheMock.getAllPoints.mockResolvedValue([{}]);
		gpsCacheMock.getRunEvents.mockResolvedValue([
			{ type: "START", sequence: 0, timestamp: 1_000 },
			{ type: "STOP", sequence: 1, timestamp: 5_000 },
		]);
		const response = await POST(
			new Request("http://localhost/api/runs/run-1/pending-completion", {
				method: "POST",
			}),
			{ params: Promise.resolve({ runId: "run-1" }) },
		);
		expect(await response.json()).toMatchObject({ abandoned: true });
		expect(prismaMock.runRecord.delete).toHaveBeenCalled();
	});

	it("moves an eligible run into Pending Completion", async () => {
		gpsCacheMock.getAllPoints.mockResolvedValue([{}, {}]);
		gpsCacheMock.getRunEvents.mockResolvedValue([
			{ type: "START", sequence: 0, timestamp: 1_000 },
			{ type: "STOP", sequence: 3, timestamp: 11_000 },
		]);
		const response = await POST(
			new Request("http://localhost/api/runs/run-1/pending-completion", {
				method: "POST",
			}),
			{ params: Promise.resolve({ runId: "run-1" }) },
		);
		expect(await response.json()).toEqual({ pending: true });
		expect(prismaMock.runRecord.update).toHaveBeenCalledWith({
			where: { id: "run-1" },
			data: { status: "PENDING_COMPLETION" },
		});
	});
});
