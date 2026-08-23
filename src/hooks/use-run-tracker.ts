"use client";

import { useState, useRef, useCallback } from "react";
import { segmentDistance, formatDuration, calcPace } from "@/lib/track-calc";
import useGpsTracking from "@/hooks/use-gps-tracking";
import type { SequencedTrackPoint } from "@/lib/run-contract";
import type { RunEventType } from "@/lib/run-contract";
import { groupTrackSegments } from "@/lib/run-timeline";

type GpsPosition = Omit<SequencedTrackPoint, "sequence" | "segmentIndex">;

interface RunOptions {
	samplingDensity?: "high" | "medium" | "low";
}

interface CompletionSnapshot {
	startTime: string;
	endTime: string;
	duration: number;
	distance: number;
	avgPace: string;
	trackPoints: SequencedTrackPoint[];
	calories: number;
	splits?: { km: number; pace: string; duration: number }[];
}

export default function useRunTracker(userId?: string, options?: RunOptions) {
	const [status, setStatus] = useState<
		"idle" | "running" | "paused" | "pending_completion" | "finished"
	>("idle");
	const [completionError, setCompletionError] = useState<string | null>(null);
	const [distance, setDistance] = useState(0);
	const [duration, setDuration] = useState(0);
	const [track, setTrack] = useState<SequencedTrackPoint[]>([]);
	const [currentPace, setCurrentPace] = useState("--");
	const [isStarting, setIsStarting] = useState(false);
	const [startError, setStartError] = useState<string | null>(null);
	const [splits, setSplits] = useState<
		{ km: number; pace: string; duration: number }[]
	>([]);
	const lastPoint = useRef<SequencedTrackPoint | null>(null);
	const runStartRef = useRef<number>(0);
	const startTime = useRef<number>(0);
	const timer = useRef<ReturnType<typeof setInterval> | null>(null);
	const accumulatedRef = useRef(0);
	const distanceMetersRef = useRef(0);
	const rollingWindow = useRef<SequencedTrackPoint[]>([]);

	const runIdRef = useRef<string | null>(null);
	const isStartingRef = useRef(false);
	const pointQueue = useRef<SequencedTrackPoint[]>([]);
	const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
	const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const retryDelay = useRef(1_000);
	const flushInFlight = useRef(false);
	const flushPointsRef = useRef<(() => Promise<void>) | null>(null);
	const sequenceRef = useRef(0);
	const segmentIndexRef = useRef(0);
	const lastEventTimestampRef = useRef(0);
	const stopEventPersistedRef = useRef(false);
	const splitStartActiveSecondsRef = useRef(0);
	const completionSnapshotRef = useRef<CompletionSnapshot | null>(null);

	const pushEvent = useCallback(
		async (type: RunEventType, requestedTimestamp?: number) => {
			const runId = runIdRef.current;
			if (!runId) return false;
			const timestamp = Math.max(
				requestedTimestamp ?? Date.now(),
				lastEventTimestampRef.current + 1,
			);
			const event = { type, sequence: sequenceRef.current, timestamp };
			try {
				const response = await fetch(`/api/runs/${runId}/events`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ events: [event] }),
				});
				if (!response.ok) return false;
				sequenceRef.current++;
				lastEventTimestampRef.current = timestamp;
				return true;
			} catch {
				return false;
			}
		},
		[],
	);

	const flushPoints = useCallback(async () => {
		const runId = runIdRef.current;
		if (!runId || pointQueue.current.length === 0 || flushInFlight.current)
			return;

		flushInFlight.current = true;
		const batch = pointQueue.current.slice();
		try {
			const response = await fetch(`/api/runs/${runId}/points`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ points: batch }),
			});
			if (!response.ok)
				throw new Error(`GPS upload failed: ${response.status}`);
			pointQueue.current.splice(0, batch.length);
			retryDelay.current = 1_000;
		} catch {
			if (retryTimer.current === null) {
				retryTimer.current = setTimeout(() => {
					retryTimer.current = null;
					void flushPointsRef.current?.();
				}, retryDelay.current);
				retryDelay.current = Math.min(retryDelay.current * 2, 15_000);
			}
		} finally {
			flushInFlight.current = false;
		}
	}, []);
	flushPointsRef.current = flushPoints;

	const handleGpsPoint = useCallback(
		(position: GpsPosition) => {
			const point: SequencedTrackPoint = {
				...position,
				sequence: sequenceRef.current++,
				segmentIndex: segmentIndexRef.current,
			};
			setTrack((prev) => [...prev, point]);
			pointQueue.current.push(point);
			if (pointQueue.current.length >= 20) void flushPoints();

			const prev = lastPoint.current;
			if (!prev) {
				lastPoint.current = point;
				rollingWindow.current = [point];
				return;
			}

			const dist = segmentDistance(prev, point);
			if (dist > 5) {
				distanceMetersRef.current += dist;
				setDistance((d) => d + dist / 1000);

				const km = Math.floor(distanceMetersRef.current / 1000);
				if (
					km > 0 &&
					km !== Math.floor((distanceMetersRef.current - dist) / 1000)
				) {
					const activeSeconds =
						accumulatedRef.current +
						Math.floor((Date.now() - startTime.current) / 1000);
					const kmDuration = activeSeconds - splitStartActiveSecondsRef.current;
					setSplits((prev) => [
						...prev,
						{ km, pace: calcPace(1, kmDuration), duration: kmDuration },
					]);
					splitStartActiveSecondsRef.current = activeSeconds;
				}
			}

			lastPoint.current = point;

			const cutoff = point.timestamp - 30000;
			rollingWindow.current = [
				...rollingWindow.current.filter((p) => p.timestamp >= cutoff),
				point,
			];

			if (rollingWindow.current.length >= 2) {
				let winDist = 0;
				const pts = rollingWindow.current;
				for (let i = 1; i < pts.length; i++) {
					winDist += segmentDistance(pts[i - 1], pts[i]);
				}
				const winDuration =
					(pts[pts.length - 1].timestamp - pts[0].timestamp) / 1000;
				if (winDist > 10 && winDuration > 10) {
					setCurrentPace(calcPace(winDist / 1000, winDuration));
				}
			}
		},
		[flushPoints],
	);

	const gps = useGpsTracking({
		onPoint: handleGpsPoint,
		samplingDensity: options?.samplingDensity,
	});

	const startTimer = useCallback(() => {
		startTime.current = Date.now();
		timer.current = setInterval(() => {
			setDuration(
				() =>
					accumulatedRef.current +
					Math.floor((Date.now() - startTime.current) / 1000),
			);
		}, 1000);
	}, []);

	const stopTimer = useCallback(() => {
		accumulatedRef.current += Math.floor(
			(Date.now() - startTime.current) / 1000,
		);
		if (timer.current !== null) {
			clearInterval(timer.current);
			timer.current = null;
		}
	}, []);

	const clearResources = useCallback(() => {
		stopTimer();
		gps.stopTracking();
		if (flushTimer.current !== null) {
			clearInterval(flushTimer.current);
			flushTimer.current = null;
		}
		if (retryTimer.current !== null) {
			clearTimeout(retryTimer.current);
			retryTimer.current = null;
		}
	}, [stopTimer, gps]);

	const start = useCallback(async () => {
		if (!userId || isStartingRef.current) return;

		isStartingRef.current = true;
		setIsStarting(true);
		setStartError(null);

		try {
			const res = await fetch("/api/runs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			if (!res.ok) {
				setStartError(
					res.status === 409
						? "已有未完成的跑步，请先完成后再试。"
						: "无法开始跑步，请重试。",
				);
				console.error("创建跑步会话失败", res.status);
				return;
			}
			const data = await res.json();
			if (typeof data.runId !== "string") {
				setStartError("无法开始跑步，请重试。");
				console.error("创建跑步会话失败", "响应缺少 runId");
				return;
			}
			runIdRef.current = data.runId;
		} catch (e) {
			setStartError("无法开始跑步，请重试。");
			console.error("创建跑步会话失败", e);
			return;
		} finally {
			isStartingRef.current = false;
			setIsStarting(false);
		}

		accumulatedRef.current = 0;
		distanceMetersRef.current = 0;
		rollingWindow.current = [];
		runStartRef.current = Date.now();
		sequenceRef.current = 1;
		segmentIndexRef.current = 0;
		lastEventTimestampRef.current = runStartRef.current;
		stopEventPersistedRef.current = false;
		splitStartActiveSecondsRef.current = 0;
		retryDelay.current = 1_000;
		setStatus("running");
		setDistance(0);
		setDuration(0);
		setTrack([]);
		setCurrentPace("--");
		setSplits([]);
		lastPoint.current = null;
		pointQueue.current = [];

		flushTimer.current = setInterval(flushPoints, 15000);
		startTimer();
		gps.startTracking();
	}, [startTimer, gps, flushPoints, userId]);

	const pause = useCallback(async () => {
		if (status !== "running") return false;
		await flushPoints();
		if (pointQueue.current.length > 0 || !(await pushEvent("PAUSE")))
			return false;
		clearResources();
		lastPoint.current = null;
		rollingWindow.current = [];
		setCurrentPace("--");
		setStatus("paused");
		return true;
	}, [status, flushPoints, pushEvent, clearResources]);

	const resume = useCallback(async () => {
		if (status !== "paused" || !(await pushEvent("RESUME"))) return false;
		segmentIndexRef.current++;
		lastPoint.current = null;
		rollingWindow.current = [];
		setStatus("running");
		startTimer();
		gps.startTracking();
		flushTimer.current = setInterval(flushPoints, 15000);
		return true;
	}, [status, pushEvent, startTimer, gps, flushPoints]);

	const getSnapshot = useCallback(
		(now = Date.now()): CompletionSnapshot => {
			const liveDelta =
				timer.current !== null
					? Math.floor((now - startTime.current) / 1000)
					: 0;
			const finalDuration = accumulatedRef.current + liveDelta;
			const distKm = parseFloat(distance.toFixed(2));
			const calories = Math.round(distKm * 70);
			return {
				startTime: new Date(runStartRef.current).toISOString(),
				endTime: new Date(now).toISOString(),
				duration: finalDuration,
				distance: distKm,
				avgPace: calcPace(distance, finalDuration),
				trackPoints: track,
				calories,
				splits: splits.length > 0 ? splits : undefined,
			};
		},
		[distance, track, splits],
	);

	const retryCompletion = useCallback(async () => {
		const runId = runIdRef.current;
		const snapshot = completionSnapshotRef.current;
		if (!runId || !snapshot) return;
		setCompletionError(null);
		try {
			const response = await fetch(`/api/runs/${runId}/complete`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					stopTime: snapshot.endTime,
					preview: {
						distanceMeters: snapshot.distance * 1_000,
						durationSeconds: snapshot.duration,
					},
				}),
			});
			if (!response.ok)
				throw new Error(`completion failed: ${response.status}`);
			const body = await response.json();
			if (!body.result) throw new Error("confirmed result missing");
			setStatus("finished");
			runIdRef.current = null;
			return body.result;
		} catch {
			setCompletionError("保存跑步结果失败，请重试或放弃。");
			return;
		}
	}, []);

	const stop = useCallback(async () => {
		const runId = runIdRef.current;
		if (!runId) return;
		let stopTimestamp: number;
		if (status === "pending_completion") {
			const snapshot = completionSnapshotRef.current;
			if (!snapshot) return;
			stopTimestamp = new Date(snapshot.endTime).getTime();
		} else {
			stopTimestamp = Math.max(Date.now(), lastEventTimestampRef.current + 1);
			completionSnapshotRef.current = getSnapshot(stopTimestamp);
			clearResources();
			setStatus("pending_completion");
			setCompletionError(null);
		}

		await flushPoints();
		if (pointQueue.current.length > 0) {
			setCompletionError("轨迹上传失败，请重试或放弃。");
			return;
		}
		if (!stopEventPersistedRef.current) {
			if (!(await pushEvent("STOP", stopTimestamp))) {
				setCompletionError("停止事件保存失败，请重试或放弃。");
				return;
			}
			stopEventPersistedRef.current = true;
		}
		try {
			const response = await fetch(`/api/runs/${runId}/pending-completion`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			if (!response.ok) throw new Error(`pending failed: ${response.status}`);
			const result = await response.json();
			if (result.abandoned) {
				runIdRef.current = null;
				completionSnapshotRef.current = null;
				setStatus("idle");
				setCompletionError("跑步未达到 10 秒或 2 个有效轨迹点，已放弃。");
				return;
			}
		} catch {
			setCompletionError("进入待完成状态失败，请重试或放弃。");
			return;
		}
		return retryCompletion();
	}, [
		status,
		retryCompletion,
		getSnapshot,
		clearResources,
		flushPoints,
		pushEvent,
	]);

	const abandon = useCallback(async () => {
		const runId = runIdRef.current;
		if (!runId || status !== "pending_completion") return false;
		const response = await fetch(`/api/runs/${runId}`, { method: "DELETE" });
		if (!response.ok) {
			setCompletionError("放弃失败，请重试。");
			return false;
		}
		runIdRef.current = null;
		completionSnapshotRef.current = null;
		pointQueue.current = [];
		setTrack([]);
		setStatus("idle");
		setCompletionError(null);
		return true;
	}, [status]);

	const pace = calcPace(distance, duration);
	const distKm = parseFloat(distance.toFixed(2));
	const calories = Math.round(distKm * 70);

	return {
		status,
		completionError,
		isStarting,
		startError,
		distance: distance.toFixed(2),
		duration: formatDuration(duration),
		pace,
		currentPace,
		splits,
		calories,
		track,
		trackSegments: groupTrackSegments(track),
		gpsState: gps.state,
		retryGps: gps.startTracking,
		start,
		pause,
		resume,
		stop,
		retryCompletion: stop,
		abandon,
		getSnapshot,
	};
}
