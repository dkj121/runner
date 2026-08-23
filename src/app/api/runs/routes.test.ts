import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createRun } from "@/app/api/runs/route";
import {
	GET as getRun,
	PATCH as completeRun,
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
		update: vi.fn(),
	},
}));

const gpsCacheMock = vi.hoisted(() => ({
	clearRunSession: vi.fn(),
	createRunSession: vi.fn(),
	getAllPoints: vi.fn(),
	getRunEvents: vi.fn(),
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

describe("run API canonical expansion", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		authApi.getSession.mockResolvedValue({ user: { id: "user-1" } });
		prismaMock.$transaction.mockImplementation(async (callback) =>
			callback(prismaMock),
		);
		gpsCacheMock.clearRunSession.mockResolvedValue(undefined);
		gpsCacheMock.getRunEvents.mockResolvedValue([]);
	});

	it("accepts a legacy completion while persisting canonical measurements", async () => {
		prismaMock.runRecord.findUnique.mockResolvedValue({ userId: "user-1" });
		prismaMock.runRecord.update.mockResolvedValue({ id: "run-1" });

		const response = await completeRun(
			new Request("http://localhost/api/runs/run-1", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					endTime: "2026-08-23T10:00:00.000Z",
					duration: 1_861,
					distance: 5.23,
					avgPace: "5:56 /km",
				}),
			}),
			{ params: Promise.resolve({ runId: "run-1" }) },
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(prismaMock.runRecord.update).toHaveBeenCalledWith({
			where: { id: "run-1" },
			data: expect.objectContaining({
				status: "COMPLETED",
				activeSessionOwnerId: null,
				duration: 1_861,
				durationSeconds: 1_861,
				distance: 5.23,
				distanceMeters: 5_230,
				avgPace: "5:56 /km",
			}),
		});
	});

	it("returns legacy and canonical live measurements together", async () => {
		const now = Date.now();
		prismaMock.runRecord.findUnique.mockResolvedValue({
			userId: "user-1",
			startTime: new Date(0),
			endTime: null,
			status: "ACTIVE",
			duration: 0,
			durationSeconds: 0,
			distance: 0,
			distanceMeters: 0,
			avgPace: "",
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
			duration: 5,
			durationSeconds: 5,
			distance: 0.01,
			distanceMeters: 10,
		});
	});

	it("persists event-defined active duration instead of paused wall time", async () => {
		prismaMock.runRecord.findUnique.mockResolvedValue({ userId: "user-1" });
		prismaMock.runRecord.update.mockResolvedValue({ id: "run-1" });
		gpsCacheMock.getRunEvents.mockResolvedValue([
			{ type: "START", sequence: 0, timestamp: 1_000 },
			{ type: "PAUSE", sequence: 1, timestamp: 4_000 },
			{ type: "RESUME", sequence: 2, timestamp: 10_000 },
			{ type: "STOP", sequence: 3, timestamp: 12_000 },
		]);

		await completeRun(
			new Request("http://localhost/api/runs/run-1", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					endTime: "2026-08-23T10:00:00.000Z",
					duration: 11,
					distance: 1,
					avgPace: "5:00 /km",
				}),
			}),
			{ params: Promise.resolve({ runId: "run-1" }) },
		);

		expect(prismaMock.runRecord.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ duration: 5, durationSeconds: 5 }),
			}),
		);
	});
});
