import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as listRuns, POST as createRun } from "@/app/api/runs/route";
import {
	DELETE as deleteRun,
	GET as getRun,
} from "@/app/api/runs/[runId]/route";

const authApi = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
	$transaction: vi.fn(),
	runRecord: {
		count: vi.fn(),
		create: vi.fn(),
		findMany: vi.fn(),
		findUnique: vi.fn(),
		delete: vi.fn(),
		update: vi.fn(),
	},
	totalRunRecord: {
		updateMany: vi.fn(),
	},
}));

const gpsCacheMock = vi.hoisted(() => ({
	clearRunSession: vi.fn(),
	createRunSession: vi.fn(),
	getAllPoints: vi.fn(),
	getRunEvents: vi.fn(),
}));
const lifecycleMock = vi.hoisted(() => ({
	enforceRunLifecycle: vi.fn(),
	expireOwnedRunSessions: vi.fn(),
}));

vi.mock("next/headers", () => ({
	headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/auth", () => ({
	auth: { api: authApi },
}));

vi.mock("@/lib/prisma", () => ({
	prisma: prismaMock,
}));

vi.mock("@/lib/gps-cache", () => gpsCacheMock);
vi.mock("@/lib/run-lifecycle", () => lifecycleMock);

vi.mock("@/lib/logger", () => ({
	createRequestLogger: vi.fn(() => ({})),
	PerformanceLogger: class {
		error = vi.fn();
	},
	logApiRequest: vi.fn(),
	logError: vi.fn(),
}));

describe("run API authorization", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		prismaMock.$transaction.mockImplementation(async (callback) =>
			callback(prismaMock),
		);
	});

	it("rejects creating a run without an authenticated session", async () => {
		authApi.getSession.mockResolvedValue(null);

		const response = await createRun(
			new Request("http://localhost/api/runs", { method: "POST" }),
			{ params: Promise.resolve({}) },
		);

		expect(response.status).toBe(401);
		expect(prismaMock.runRecord.create).not.toHaveBeenCalled();
	});

	it("hides a run owned by another user", async () => {
		authApi.getSession.mockResolvedValue({ user: { id: "user-1" } });
		prismaMock.runRecord.findUnique.mockResolvedValue({ userId: "user-2" });

		const response = await getRun(
			new Request("http://localhost/api/runs/run-1"),
			{ params: Promise.resolve({ runId: "run-1" }) },
		);

		expect(response.status).toBe(404);
		expect(gpsCacheMock.getAllPoints).not.toHaveBeenCalled();
	});
});

describe("run API session creation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		authApi.getSession.mockResolvedValue({ user: { id: "user-1" } });
		prismaMock.$transaction.mockImplementation(async (callback) =>
			callback(prismaMock),
		);
		prismaMock.runRecord.create.mockResolvedValue({ id: "run-1" });
		gpsCacheMock.createRunSession.mockResolvedValue(undefined);
	});

	it("creates one active Personal Run for the authenticated runner", async () => {
		const response = await createRun(
			new Request("http://localhost/api/runs", { method: "POST" }),
			{ params: Promise.resolve({}) },
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ runId: "run-1" });
		expect(prismaMock.runRecord.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				userId: "user-1",
				status: "ACTIVE",
				activeSessionOwnerId: "user-1",
			}),
		});
	});

	it("returns a conflict when the database rejects a concurrent start", async () => {
		prismaMock.runRecord.create.mockRejectedValue({ code: "P2002" });

		const response = await createRun(
			new Request("http://localhost/api/runs", { method: "POST" }),
			{ params: Promise.resolve({}) },
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: "An active run session already exists",
			code: "RUN_SESSION_CONFLICT",
		});
		expect(gpsCacheMock.createRunSession).not.toHaveBeenCalled();
	});

	it("uses a runner-scoped session key so another runner is not blocked", async () => {
		prismaMock.runRecord.create
			.mockResolvedValueOnce({ id: "run-1" })
			.mockResolvedValueOnce({ id: "run-2" });

		await createRun(
			new Request("http://localhost/api/runs", { method: "POST" }),
			{
				params: Promise.resolve({}),
			},
		);
		authApi.getSession.mockResolvedValue({ user: { id: "user-2" } });
		const response = await createRun(
			new Request("http://localhost/api/runs", { method: "POST" }),
			{ params: Promise.resolve({}) },
		);

		expect(response.status).toBe(200);
		expect(prismaMock.runRecord.create).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				data: expect.objectContaining({ activeSessionOwnerId: "user-2" }),
			}),
		);
	});
});

describe("run history API", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		authApi.getSession.mockResolvedValue({ user: { id: "user-1" } });
		prismaMock.runRecord.findMany.mockResolvedValue([{ id: "completed-1" }]);
		prismaMock.runRecord.count.mockResolvedValue(1);
	});

	it("returns only the owner's Completed Runs", async () => {
		const response = await listRuns(
			new Request("http://localhost/api/runs?take=5"),
			{ params: Promise.resolve({}) },
		);
		expect(await response.json()).toEqual({
			records: [{ id: "completed-1" }],
			total: 1,
		});
		expect(prismaMock.runRecord.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					userId: "user-1",
					status: "COMPLETED",
				}),
			}),
		);
	});
});

describe("completed run deletion", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		authApi.getSession.mockResolvedValue({ user: { id: "user-1" } });
		prismaMock.$transaction.mockImplementation(async (callback) =>
			callback(prismaMock),
		);
		prismaMock.runRecord.delete.mockResolvedValue({ id: "run-1" });
		prismaMock.totalRunRecord.updateMany.mockResolvedValue({ count: 1 });
	});

	it("does not delete another runner's completed run", async () => {
		prismaMock.runRecord.findUnique.mockResolvedValue({
			userId: "user-2",
			status: "COMPLETED",
		});

		const response = await deleteRun(
			new Request("http://localhost/api/runs/run-1", { method: "DELETE" }),
			{ params: Promise.resolve({ runId: "run-1" }) },
		);

		expect(response.status).toBe(404);
		expect(prismaMock.$transaction).not.toHaveBeenCalled();
	});

	it("deletes the run and rebuilds lifetime totals in one transaction", async () => {
		prismaMock.runRecord.findUnique.mockResolvedValue({
			userId: "user-1",
			status: "COMPLETED",
		});
		prismaMock.runRecord.findMany.mockResolvedValue([
			{ durationSeconds: 1_500, distanceMeters: 5_000 },
			{ durationSeconds: 620, distanceMeters: 2_000 },
		]);

		const response = await deleteRun(
			new Request("http://localhost/api/runs/run-1", { method: "DELETE" }),
			{ params: Promise.resolve({ runId: "run-1" }) },
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ deleted: true });
		expect(prismaMock.runRecord.delete).toHaveBeenCalledWith({
			where: { id: "run-1" },
		});
		expect(prismaMock.runRecord.findMany).toHaveBeenCalledWith({
			where: expect.objectContaining({
				userId: "user-1",
				status: "COMPLETED",
			}),
			select: { durationSeconds: true, distanceMeters: true },
		});
		expect(prismaMock.totalRunRecord.updateMany).toHaveBeenCalledWith({
			where: { userId: "user-1" },
			data: {
				totalDurationSeconds: 2_120,
				totalDistanceMeters: 7_000,
				averagePaceSecondsPerKm: 303,
			},
		});
	});

	it("returns an error when the deletion transaction rolls back", async () => {
		prismaMock.runRecord.findUnique.mockResolvedValue({
			userId: "user-1",
			status: "COMPLETED",
		});
		prismaMock.$transaction.mockRejectedValue(
			new Error("database unavailable"),
		);

		const response = await deleteRun(
			new Request("http://localhost/api/runs/run-1", { method: "DELETE" }),
			{ params: Promise.resolve({ runId: "run-1" }) },
		);

		expect(response.status).toBe(500);
		expect(gpsCacheMock.clearRunSession).not.toHaveBeenCalled();
	});
});

describe("run API canonical measurements", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		authApi.getSession.mockResolvedValue({ user: { id: "user-1" } });
		prismaMock.$transaction.mockImplementation(async (callback) =>
			callback(prismaMock),
		);
		gpsCacheMock.clearRunSession.mockResolvedValue(undefined);
		gpsCacheMock.getRunEvents.mockResolvedValue([]);
	});

	it("returns only canonical live measurements", async () => {
		const now = Date.now();
		prismaMock.runRecord.findUnique.mockResolvedValue({
			userId: "user-1",
			startTime: new Date(0),
			endTime: null,
			status: "ACTIVE",
			durationSeconds: 0,
			distanceMeters: 0,
			paceSecondsPerKm: null,
			trackPoints: null,
			calories: 0,
			splits: null,
			notes: null,
			createdAt: new Date(0),
			updatedAt: new Date(0),
		});
		gpsCacheMock.getAllPoints.mockResolvedValue([
			{ lat: 0, lng: 0, timestamp: 1_000, segmentIndex: 0 },
			{ lat: 0, lng: 0.0001, timestamp: 6_000, segmentIndex: 0 },
		]);
		gpsCacheMock.getRunEvents.mockResolvedValue([
			{ type: "START", sequence: 0, timestamp: now - 10_000 },
			{ type: "PAUSE", sequence: 1, timestamp: now - 7_000 },
			{ type: "RESUME", sequence: 2, timestamp: now - 2_000 },
		]);

		const response = await getRun(
			new Request("http://localhost/api/runs/run-1"),
			{ params: Promise.resolve({ runId: "run-1" }) },
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			status: "ACTIVE",
			durationSeconds: 5,
			distanceMeters: 11.12,
			paceSecondsPerKm: 450,
		});
		expect(body).not.toHaveProperty("duration");
		expect(body).not.toHaveProperty("distance");
		expect(body).not.toHaveProperty("avgPace");
	});
});
