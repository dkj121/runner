import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/runs/[runId]/complete/route";

const authApi = vi.hoisted(() => ({ getSession: vi.fn() }));
const completedRecord = {
	id: "run-1",
	userId: "user-1",
	status: "COMPLETED",
	endTime: new Date(11_000),
	durationSeconds: 10,
	distanceMeters: 11.12,
	previewDistanceMeters: 10,
	paceSecondsPerKm: 899,
	calories: 1,
	trackPoints: { segments: [] },
	splits: [],
};
const transactionMock = vi.hoisted(() => ({
	runRecord: { updateMany: vi.fn(), findUnique: vi.fn() },
	totalRunRecord: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
}));
const prismaMock = vi.hoisted(() => ({
	$transaction: vi.fn(),
	runRecord: { findUnique: vi.fn() },
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

function request(
	stopTime = new Date(11_000).toISOString(),
	previewDistanceMeters = 10,
) {
	return new Request("http://localhost/api/runs/run-1/complete", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			stopTime,
			preview: { distanceMeters: previewDistanceMeters, durationSeconds: 999 },
		}),
	});
}

describe("complete Run API", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		authApi.getSession.mockResolvedValue({ user: { id: "user-1" } });
		prismaMock.runRecord.findUnique.mockResolvedValue({
			id: "run-1",
			userId: "user-1",
			status: "PENDING_COMPLETION",
		});
		prismaMock.$transaction.mockImplementation((callback) =>
			callback(transactionMock),
		);
		transactionMock.runRecord.updateMany.mockResolvedValue({ count: 1 });
		transactionMock.runRecord.findUnique.mockResolvedValue(completedRecord);
		transactionMock.totalRunRecord.findFirst.mockResolvedValue({
			id: "total-1",
			totalDurationSeconds: 590,
			totalDistanceMeters: 988.88,
		});
		transactionMock.totalRunRecord.update.mockResolvedValue({});
		gpsCacheMock.getAllPoints.mockResolvedValue([
			{
				sequence: 1,
				segmentIndex: 0,
				lat: 0,
				lng: 0,
				timestamp: 1_000,
				accuracy: 5,
				altitude: null,
			},
			{
				sequence: 2,
				segmentIndex: 0,
				lat: 0,
				lng: 0.0001,
				timestamp: 11_000,
				accuracy: 5,
				altitude: null,
			},
		]);
		gpsCacheMock.getRunEvents.mockResolvedValue([
			{ type: "START", sequence: 0, timestamp: 1_000 },
			{ type: "STOP", sequence: 3, timestamp: 11_000 },
		]);
	});

	it("persists server-derived measurements and aggregate effects atomically", async () => {
		const response = await POST(request(), {
			params: Promise.resolve({ runId: "run-1" }),
		});
		expect(response.status).toBe(200);
		expect(transactionMock.runRecord.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					durationSeconds: 10,
					previewDistanceMeters: 10,
				}),
			}),
		);
		expect(transactionMock.totalRunRecord.update).toHaveBeenCalledWith({
			where: { id: "total-1" },
			data: {
				totalDurationSeconds: 600,
				totalDistanceMeters: 1_000,
				averagePaceSecondsPerKm: 600,
			},
		});
	});

	it("does not contribute a duration-only run to distance aggregates", async () => {
		gpsCacheMock.getAllPoints.mockResolvedValue([]);
		gpsCacheMock.getRunEvents.mockResolvedValue([
			{ type: "START", sequence: 0, timestamp: 1_000 },
			{ type: "STOP", sequence: 1, timestamp: 11_000 },
		]);

		const response = await POST(request(), {
			params: Promise.resolve({ runId: "run-1" }),
		});

		expect(response.status).toBe(200);
		expect(transactionMock.runRecord.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					distanceMeters: 0,
					trackPoints: null,
					calories: 0,
				}),
			}),
		);
		expect(transactionMock.totalRunRecord.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					totalDurationSeconds: 590,
					totalDistanceMeters: 988.88,
				}),
			}),
		);
	});

	it("returns the existing result for an identical retry without duplicate effects", async () => {
		prismaMock.runRecord.findUnique.mockResolvedValue(completedRecord);
		const response = await POST(request(), {
			params: Promise.resolve({ runId: "run-1" }),
		});
		expect(response.status).toBe(200);
		expect(prismaMock.$transaction).not.toHaveBeenCalled();
	});

	it("rejects a conflicting retry without overwriting the result", async () => {
		prismaMock.runRecord.findUnique.mockResolvedValue(completedRecord);
		const response = await POST(request(new Date(12_000).toISOString()), {
			params: Promise.resolve({ runId: "run-1" }),
		});
		expect(response.status).toBe(409);
		expect(prismaMock.$transaction).not.toHaveBeenCalled();
	});

	it("rejects changed preview data for the same stop time", async () => {
		prismaMock.runRecord.findUnique.mockResolvedValue(completedRecord);
		const response = await POST(request(new Date(11_000).toISOString(), 20), {
			params: Promise.resolve({ runId: "run-1" }),
		});
		expect(response.status).toBe(409);
	});

	it("does not clear active data when the aggregate transaction fails", async () => {
		transactionMock.totalRunRecord.update.mockRejectedValue(
			new Error("rollback"),
		);
		const response = await POST(request(), {
			params: Promise.resolve({ runId: "run-1" }),
		});
		expect(response.status).toBe(500);
		expect(gpsCacheMock.clearRunSession).not.toHaveBeenCalled();
	});
});
