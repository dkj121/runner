import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ACTIVE_RUN_LIMIT_MS,
	enforceRunLifecycle,
	INCOMPLETE_RUN_RETENTION_MS,
} from "@/lib/run-lifecycle";

const prismaMock = vi.hoisted(() => ({
	runRecord: {
		deleteMany: vi.fn(),
		findUnique: vi.fn(),
		updateMany: vi.fn(),
	},
}));
const cacheMock = vi.hoisted(() => ({
	clearRunSession: vi.fn(),
	getAllPoints: vi.fn(),
	getRunEvents: vi.fn(),
	pushRunEvents: vi.fn(),
}));
const loggerMock = vi.hoisted(() => ({ logError: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/gps-cache", () => cacheMock);
vi.mock("@/lib/logger", () => loggerMock);

describe("run lifecycle", () => {
	const startTime = new Date("2026-08-23T00:00:00.000Z");

	beforeEach(() => {
		vi.clearAllMocks();
		cacheMock.clearRunSession.mockResolvedValue(undefined);
		cacheMock.getAllPoints.mockResolvedValue([]);
		cacheMock.getRunEvents.mockResolvedValue([
			{ type: "START", sequence: 0, timestamp: startTime.getTime() },
		]);
		cacheMock.pushRunEvents.mockResolvedValue({ accepted: 1, rejected: 0 });
		prismaMock.runRecord.updateMany.mockResolvedValue({ count: 1 });
		prismaMock.runRecord.deleteMany.mockResolvedValue({ count: 1 });
	});

	it("moves an Active Run to Pending Completion after twelve hours", async () => {
		prismaMock.runRecord.findUnique.mockResolvedValue({
			id: "run-1",
			userId: "user-1",
			status: "ACTIVE",
			startTime,
		});

		const result = await enforceRunLifecycle(
			"run-1",
			"user-1",
			startTime.getTime() + ACTIVE_RUN_LIMIT_MS,
		);

		expect(result).toBe("pending");
		expect(cacheMock.pushRunEvents).toHaveBeenCalledWith("run-1", [
			expect.objectContaining({
				type: "STOP",
				sequence: 1,
				timestamp: startTime.getTime() + ACTIVE_RUN_LIMIT_MS,
			}),
		]);
		expect(prismaMock.runRecord.updateMany).toHaveBeenCalledWith({
			where: { id: "run-1", userId: "user-1", status: "ACTIVE" },
			data: { status: "PENDING_COMPLETION", activeSessionOwnerId: null },
		});
	});

	it("retains incomplete state until the twenty-four-hour boundary", async () => {
		prismaMock.runRecord.findUnique.mockResolvedValue({
			id: "run-1",
			userId: "user-1",
			status: "PENDING_COMPLETION",
			startTime,
		});

		const result = await enforceRunLifecycle(
			"run-1",
			"user-1",
			startTime.getTime() + INCOMPLETE_RUN_RETENTION_MS - 1,
		);

		expect(result).toBe("pending");
		expect(prismaMock.runRecord.deleteMany).not.toHaveBeenCalled();
		expect(cacheMock.clearRunSession).not.toHaveBeenCalled();
	});

	it("deletes expired incomplete state and releases its session", async () => {
		prismaMock.runRecord.findUnique.mockResolvedValue({
			id: "run-1",
			userId: "user-1",
			status: "PENDING_COMPLETION",
			startTime,
		});

		const result = await enforceRunLifecycle(
			"run-1",
			"user-1",
			startTime.getTime() + INCOMPLETE_RUN_RETENTION_MS,
		);

		expect(result).toBe("expired");
		expect(prismaMock.runRecord.deleteMany).toHaveBeenCalledWith({
			where: {
				id: "run-1",
				userId: "user-1",
				status: { not: "COMPLETED" },
			},
		});
		expect(cacheMock.clearRunSession).toHaveBeenCalledWith("run-1", "user-1");
	});

	it("retries failed temporary cleanup without touching Completed Runs", async () => {
		prismaMock.runRecord.findUnique
			.mockResolvedValueOnce({
				id: "run-1",
				userId: "user-1",
				status: "PENDING_COMPLETION",
				startTime,
			})
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({
				id: "completed-1",
				userId: "user-1",
				status: "COMPLETED",
				startTime,
			});
		cacheMock.clearRunSession
			.mockRejectedValueOnce(new Error("redis unavailable"))
			.mockResolvedValue(undefined);

		await expect(
			enforceRunLifecycle(
				"run-1",
				"user-1",
				startTime.getTime() + INCOMPLETE_RUN_RETENTION_MS,
			),
		).rejects.toThrow("redis unavailable");
		expect(loggerMock.logError).toHaveBeenCalled();
		await expect(enforceRunLifecycle("run-1", "user-1")).resolves.toBe(
			"missing",
		);
		await expect(enforceRunLifecycle("completed-1", "user-1")).resolves.toBe(
			"completed",
		);
		expect(prismaMock.runRecord.deleteMany).toHaveBeenCalledTimes(1);
	});
});
