import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useRunTracker from "@/hooks/use-run-tracker";

const gps = vi.hoisted(() => ({
	startTracking: vi.fn(),
	stopTracking: vi.fn(),
	state: {
		isTracking: false,
		currentPosition: null,
		error: null,
	},
}));

const gpsHarness = vi.hoisted(() => ({
	onPoint: undefined as
		| ((point: {
				lat: number;
				lng: number;
				timestamp: number;
				accuracy: number;
				altitude: number | null;
		  }) => void)
		| undefined,
}));

vi.mock("@/hooks/use-gps-tracking", () => ({
	default: vi.fn(
		(options: {
			onPoint: (point: {
				lat: number;
				lng: number;
				timestamp: number;
				accuracy: number;
				altitude: number | null;
			}) => void;
		}) => {
			gpsHarness.onPoint = options.onPoint;
			return gps;
		},
	),
}));

describe("useRunTracker", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		gps.startTracking.mockClear();
		gps.stopTracking.mockClear();
		gpsHarness.onPoint = undefined;
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it("stays idle when the run session cannot be created", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn<typeof fetch>().mockResolvedValue(
				new Response(JSON.stringify({ error: "unauthorized" }), {
					status: 401,
				}),
			),
		);

		const { result } = renderHook(() => useRunTracker("user-1"));
		await act(async () => {
			await result.current.start();
		});

		expect(result.current.status).toBe("idle");
		expect(result.current.startError).toBe("无法开始跑步，请重试。");
		expect(gps.startTracking).not.toHaveBeenCalled();
	});

	it("shows a resolvable conflict without starting GPS", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn<typeof fetch>().mockResolvedValue(
				new Response(JSON.stringify({ code: "RUN_SESSION_CONFLICT" }), {
					status: 409,
				}),
			),
		);

		const { result } = renderHook(() => useRunTracker("user-1"));
		await act(async () => {
			await result.current.start();
		});

		expect(result.current.status).toBe("idle");
		expect(result.current.startError).toBe(
			"已有未完成的跑步，请先完成后再试。",
		);
		expect(result.current.isStarting).toBe(false);
		expect(gps.startTracking).not.toHaveBeenCalled();
	});

	it("coalesces repeated start taps into one request", async () => {
		let resolveRequest: ((response: Response) => void) | undefined;
		const fetchMock = vi.fn<typeof fetch>().mockImplementation(
			() =>
				new Promise<Response>((resolve) => {
					resolveRequest = resolve;
				}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const { result } = renderHook(() => useRunTracker("user-1"));
		let firstStart: Promise<void>;
		let secondStart: Promise<void>;
		act(() => {
			firstStart = result.current.start();
			secondStart = result.current.start();
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		await act(async () => {
			resolveRequest?.(
				new Response(JSON.stringify({ runId: "run-1" }), { status: 200 }),
			);
			await Promise.all([firstStart!, secondStart!]);
		});

		expect(result.current.status).toBe("running");
	});

	it("excludes paused time from a successfully completed run", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn<typeof fetch>()
				.mockResolvedValueOnce(
					new Response(JSON.stringify({ runId: "run-1" }), { status: 200 }),
				)
				.mockResolvedValueOnce(new Response(null, { status: 200 }))
				.mockResolvedValueOnce(new Response(null, { status: 200 }))
				.mockResolvedValueOnce(new Response(null, { status: 200 }))
				.mockResolvedValueOnce(
					new Response(JSON.stringify({ pending: true }), { status: 200 }),
				)
				.mockResolvedValueOnce(
					new Response(
						JSON.stringify({ result: { runId: "run-1", durationSeconds: 5 } }),
						{ status: 200 },
					),
				),
		);

		const { result } = renderHook(() => useRunTracker("user-1"));
		await act(async () => {
			await result.current.start();
			await vi.advanceTimersByTimeAsync(2_000);
		});
		expect(result.current.duration).toBe("00:02");

		await act(async () => {
			await result.current.pause();
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(5_000);
		});
		expect(result.current.status).toBe("paused");
		expect(result.current.duration).toBe("00:02");

		await act(async () => {
			await result.current.resume();
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3_000);
		});

		let completion: Awaited<ReturnType<typeof result.current.stop>>;
		await act(async () => {
			completion = await result.current.stop();
		});

		expect(completion?.durationSeconds).toBe(5);
		expect(result.current.status).toBe("finished");
	});

	it("keeps the run active when final persistence fails", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ runId: "run-1" }), { status: 200 }),
			)
			.mockResolvedValueOnce(new Response(null, { status: 200 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ pending: true }), { status: 200 }),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: "save failed" }), { status: 500 }),
			);
		vi.stubGlobal("fetch", fetchMock);

		const { result } = renderHook(() => useRunTracker("user-1"));

		await act(async () => {
			await result.current.start();
		});
		expect(result.current.status).toBe("running");

		let completion: Awaited<ReturnType<typeof result.current.stop>>;
		await act(async () => {
			completion = await result.current.stop();
		});

		expect(completion).toBeUndefined();
		expect(result.current.status).toBe("pending_completion");
	});

	it("retries queued GPS points before completing the run", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ runId: "run-1" }), { status: 200 }),
			)
			.mockResolvedValueOnce(new Response(null, { status: 503 }))
			.mockResolvedValueOnce(new Response(null, { status: 200 }))
			.mockResolvedValueOnce(new Response(null, { status: 200 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ pending: true }), { status: 200 }),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ result: { runId: "run-1" } }), {
					status: 200,
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		const { result } = renderHook(() => useRunTracker("user-1"));
		await act(async () => {
			await result.current.start();
			gpsHarness.onPoint?.({
				lat: 32.041,
				lng: 118.784,
				timestamp: 1_000,
				accuracy: 5,
				altitude: null,
			});
		});

		let firstCompletion: Awaited<ReturnType<typeof result.current.stop>>;
		await act(async () => {
			firstCompletion = await result.current.stop();
		});
		expect(firstCompletion).toBeUndefined();
		expect(result.current.status).toBe("pending_completion");

		let secondCompletion: Awaited<ReturnType<typeof result.current.stop>>;
		await act(async () => {
			secondCompletion = await result.current.stop();
		});

		expect(secondCompletion?.runId).toBe("run-1");
		const pointUploads = fetchMock.mock.calls.filter(([url]) =>
			String(url).endsWith("/points"),
		);
		expect(pointUploads).toHaveLength(2);
		expect(pointUploads[1]?.[1]?.body).toBe(pointUploads[0]?.[1]?.body);
	});

	it("retries GPS points after a scheduled upload fails", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ runId: "run-1" }), { status: 200 }),
			)
			.mockResolvedValueOnce(new Response(null, { status: 503 }))
			.mockResolvedValueOnce(new Response(null, { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const { result } = renderHook(() => useRunTracker("user-1"));
		await act(async () => {
			await result.current.start();
			gpsHarness.onPoint?.({
				lat: 32.041,
				lng: 118.784,
				timestamp: 1_000,
				accuracy: 5,
				altitude: null,
			});
		});

		await act(async () => {
			await vi.advanceTimersByTimeAsync(15_000);
			await vi.advanceTimersByTimeAsync(15_000);
		});

		const pointUploads = fetchMock.mock.calls.filter(([url]) =>
			String(url).endsWith("/points"),
		);
		expect(pointUploads).toHaveLength(2);
		expect(pointUploads[1]?.[1]?.body).toBe(pointUploads[0]?.[1]?.body);
	});

	it("uploads immediately when twenty points are queued", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ runId: "run-1" }), { status: 200 }),
			)
			.mockResolvedValueOnce(new Response(null, { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const { result } = renderHook(() => useRunTracker("user-1"));
		await act(async () => {
			await result.current.start();
			for (let sequence = 0; sequence < 20; sequence++) {
				gpsHarness.onPoint?.({
					lat: 32.041,
					lng: 118.784 + sequence * 0.0001,
					timestamp: 1_000 + sequence * 1_000,
					accuracy: 5,
					altitude: null,
				});
			}
			await Promise.resolve();
		});

		const pointUploads = fetchMock.mock.calls.filter(([url]) =>
			String(url).endsWith("/points"),
		);
		expect(pointUploads).toHaveLength(1);
		const body = JSON.parse(String(pointUploads[0]?.[1]?.body));
		expect(body.points).toHaveLength(20);
		expect(body.points[0]).toMatchObject({
			sequence: 1,
			segmentIndex: 0,
			accuracy: 5,
		});
		expect(body.points[19]).toMatchObject({
			sequence: 20,
			segmentIndex: 0,
			accuracy: 5,
		});
	});

	it("keeps multiple pause gaps out of distance and map segments", async () => {
		const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) => {
			if (String(url) === "/api/runs") {
				return new Response(JSON.stringify({ runId: "run-1" }), {
					status: 200,
				});
			}
			return new Response(null, { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const { result } = renderHook(() => useRunTracker("user-1"));
		await act(async () => {
			await result.current.start();
			gpsHarness.onPoint?.({
				lat: 0,
				lng: 0,
				timestamp: 1_000,
				accuracy: 5,
				altitude: null,
			});
			gpsHarness.onPoint?.({
				lat: 0,
				lng: 0.0001,
				timestamp: 2_000,
				accuracy: 5,
				altitude: null,
			});
		});
		await act(async () => {
			await result.current.pause();
		});
		await act(async () => {
			await result.current.resume();
			gpsHarness.onPoint?.({
				lat: 0,
				lng: 0.01,
				timestamp: 10_000,
				accuracy: 5,
				altitude: null,
			});
			gpsHarness.onPoint?.({
				lat: 0,
				lng: 0.0101,
				timestamp: 11_000,
				accuracy: 5,
				altitude: null,
			});
		});
		await act(async () => {
			await result.current.pause();
		});
		await act(async () => {
			await result.current.resume();
			gpsHarness.onPoint?.({
				lat: 0,
				lng: -0.01,
				timestamp: 20_000,
				accuracy: 5,
				altitude: null,
			});
			gpsHarness.onPoint?.({
				lat: 0,
				lng: -0.0099,
				timestamp: 21_000,
				accuracy: 5,
				altitude: null,
			});
		});

		expect(
			result.current.trackSegments.map((segment) => segment.length),
		).toEqual([2, 2, 2]);
		expect(Number(result.current.distance)).toBeCloseTo(0.03, 2);
	});

	it("retries Pending Completion with the immutable snapshot", async () => {
		let completionAttempts = 0;
		const completionBodies: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
				if (String(url) === "/api/runs") {
					return new Response(JSON.stringify({ runId: "run-1" }), {
						status: 200,
					});
				}
				if (String(url).endsWith("/pending-completion")) {
					return new Response(JSON.stringify({ pending: true }), {
						status: 200,
					});
				}
				if (String(url).endsWith("/complete")) {
					completionBodies.push(String(init?.body));
					completionAttempts++;
					return completionAttempts === 1
						? new Response(null, { status: 500 })
						: new Response(JSON.stringify({ result: { runId: "run-1" } }), {
								status: 200,
							});
				}
				return new Response(null, { status: 200 });
			}),
		);

		const { result } = renderHook(() => useRunTracker("user-1"));
		await act(async () => {
			await result.current.start();
		});
		await act(async () => {
			await result.current.stop();
		});
		expect(result.current.status).toBe("pending_completion");
		await act(async () => {
			await result.current.retryCompletion();
		});
		expect(result.current.status).toBe("finished");
		expect(completionBodies[1]).toBe(completionBodies[0]);
	});
});
