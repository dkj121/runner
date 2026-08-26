"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
	segmentDistance,
	formatDuration,
	calcPace,
	calcDistance,
} from "@/lib/track-calc";
import useGpsTracking from "@/hooks/use-gps-tracking";
import type {
	RunEvent,
	RunEventType,
	SequencedTrackPoint,
	TrackObservation,
} from "@/lib/run-contract";
import {
	isTrackObservationEligible,
	isStableCalibration,
	calibrationPoint,
	isValidNextTrackPoint,
} from "@/lib/track-point-validation";
import {
	calculateActiveDuration,
	groupTrackSegments,
} from "@/lib/run-timeline";

type RunTrackerStatus =
	| "idle"
	| "locating"
	| "running"
	| "paused"
	| "pending_completion"
	| "finished";

interface CompletionSnapshot {
	stopTime: string;
	durationSeconds: number;
	distanceMeters: number;
}

const FLUSH_INTERVAL_MS = 15_000;

export default function useRunTracker(userId?: string) {
	const [status, setStatus] = useState<RunTrackerStatus>("idle");
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

	const statusRef = useRef<RunTrackerStatus>("idle");
	const lastPoint = useRef<SequencedTrackPoint | null>(null);
	const runStartRef = useRef(0);
	const startTime = useRef(0);
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
	const calibrationPointsRef = useRef<TrackObservation[]>([]);
	const calibrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const signalLostAtRef = useRef<number | null>(null);
	const beginRunSessionRef = useRef<
		((initialPoint?: TrackObservation) => Promise<void>) | null
	>(null);

	const updateStatus = useCallback((nextStatus: RunTrackerStatus) => {
		statusRef.current = nextStatus;
		setStatus(nextStatus);
	}, []);

	const startTimer = useCallback((startedAt = Date.now()) => {
		if (timer.current !== null) clearInterval(timer.current);
		startTime.current = startedAt;
		timer.current = setInterval(() => {
			setDuration(
				accumulatedRef.current +
					Math.floor((Date.now() - startTime.current) / 1000),
			);
		}, 1_000);
	}, []);

	const stopTimer = useCallback(() => {
		if (timer.current === null) return;
		accumulatedRef.current += Math.floor(
			(Date.now() - startTime.current) / 1000,
		);
		clearInterval(timer.current);
		timer.current = null;
		setDuration(accumulatedRef.current);
	}, []);

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
			const result = response.headers.get("content-type")?.includes("json")
				? ((await response.json()) as {
						accepted?: number;
						rejected?: number;
					})
				: {};
			if (result.rejected && result.rejected > 0) {
				const syncResponse = await fetch(`/api/runs/${runId}/points`);
				if (syncResponse.ok) {
					const synced = (await syncResponse.json()) as {
						points?: SequencedTrackPoint[];
					};
					const syncedPoints = synced.points ?? [];
					const syncedDistance = groupTrackSegments(syncedPoints).reduce(
						(total, segment) => total + calcDistance(segment),
						0,
					);
					setTrack(syncedPoints);
					distanceMetersRef.current = syncedDistance;
					setDistance(syncedDistance / 1_000);
					lastPoint.current = syncedPoints.at(-1) ?? null;
					rollingWindow.current = syncedPoints.slice(-20);
					setSplits([]);
				}
			}
			pointQueue.current.splice(0, batch.length);
			retryDelay.current = 1_000;
		} catch {
			if (retryTimer.current === null) {
				retryTimer.current = setTimeout(() => {
					retryTimer.current = null;
					void flushPointsRef.current?.();
				}, retryDelay.current);
				retryDelay.current = Math.min(
					retryDelay.current * 2,
					FLUSH_INTERVAL_MS,
				);
			}
		} finally {
			flushInFlight.current = false;
		}
	}, []);
	flushPointsRef.current = flushPoints;

	const acceptObservation = useCallback(
		(position: TrackObservation) => {
			const point: SequencedTrackPoint = {
				...position,
				sequence: sequenceRef.current,
				segmentIndex: segmentIndexRef.current,
			};
			if (!isValidNextTrackPoint(lastPoint.current, point)) return false;

			sequenceRef.current++;
			setTrack((previousTrack) => [...previousTrack, point]);
			pointQueue.current.push(point);
			if (pointQueue.current.length >= 20) void flushPoints();

			const previous = lastPoint.current;
			if (!previous) {
				lastPoint.current = point;
				rollingWindow.current = [point];
				return true;
			}

			const distanceMeters = segmentDistance(previous, point);
			distanceMetersRef.current += distanceMeters;
			setDistance(distanceMetersRef.current / 1_000);

			const completedKilometers = Math.floor(distanceMetersRef.current / 1_000);
			if (
				completedKilometers > 0 &&
				completedKilometers !==
					Math.floor((distanceMetersRef.current - distanceMeters) / 1_000)
			) {
				const activeSeconds =
					accumulatedRef.current +
					Math.floor((Date.now() - startTime.current) / 1_000);
				const kilometerDuration =
					activeSeconds - splitStartActiveSecondsRef.current;
				setSplits((previousSplits) => [
					...previousSplits,
					{
						km: completedKilometers,
						pace: calcPace(1, kilometerDuration),
						duration: kilometerDuration,
					},
				]);
				splitStartActiveSecondsRef.current = activeSeconds;
			}

			lastPoint.current = point;
			const cutoff = point.timestamp - 30_000;
			rollingWindow.current = [
				...rollingWindow.current.filter(
					(windowPoint) => windowPoint.timestamp >= cutoff,
				),
				point,
			];

			if (rollingWindow.current.length >= 2) {
				const windowPoints = rollingWindow.current;
				const windowDistance = calcDistance(windowPoints);
				const windowDuration =
					(windowPoints.at(-1)!.timestamp - windowPoints[0].timestamp) / 1_000;
				if (windowDistance > 0.01 && windowDuration > 10) {
					setCurrentPace(calcPace(windowDistance, windowDuration));
				}
			}
			return true;
		},
		[flushPoints],
	);

	const handleGpsPoint = useCallback(
		(position: TrackObservation) => {
			if (statusRef.current === "locating") {
				if (!isTrackObservationEligible(position)) return;
				calibrationPointsRef.current.push(position);
				if (isStableCalibration(calibrationPointsRef.current)) {
					if (calibrationTimerRef.current !== null) {
						clearTimeout(calibrationTimerRef.current);
						calibrationTimerRef.current = null;
					}
					void beginRunSessionRef.current?.(
						calibrationPoint(calibrationPointsRef.current),
					);
				}
				return;
			}
			if (statusRef.current !== "running") return;
			const observationTimestamp = position.timestamp;
			if (!isTrackObservationEligible(position)) {
				signalLostAtRef.current ??= observationTimestamp;
				return;
			}
			if (
				signalLostAtRef.current !== null &&
				position.timestamp - signalLostAtRef.current >= 10_000
			) {
				segmentIndexRef.current += 1;
				lastPoint.current = null;
				rollingWindow.current = [];
				setCurrentPace("--");
			}
			signalLostAtRef.current = null;
			acceptObservation(position);
		},
		[acceptObservation],
	);

	const {
		startTracking: startGpsTracking,
		stopTracking: stopGpsTracking,
		state: gpsState,
	} = useGpsTracking({ onPoint: handleGpsPoint });

	const startFlushTimer = useCallback(() => {
		if (flushTimer.current !== null) clearInterval(flushTimer.current);
		flushTimer.current = setInterval(flushPoints, FLUSH_INTERVAL_MS);
	}, [flushPoints]);

	const clearResources = useCallback(() => {
		stopTimer();
		stopGpsTracking();
		if (flushTimer.current !== null) {
			clearInterval(flushTimer.current);
			flushTimer.current = null;
		}
		if (retryTimer.current !== null) {
			clearTimeout(retryTimer.current);
			retryTimer.current = null;
		}
	}, [stopTimer, stopGpsTracking]);

	const beginRunSession = useCallback(
		async (initialPoint?: TrackObservation) => {
			if (!userId || isStartingRef.current || runIdRef.current) return;
			if (calibrationTimerRef.current !== null) {
				clearTimeout(calibrationTimerRef.current);
				calibrationTimerRef.current = null;
			}
			isStartingRef.current = true;
			setIsStarting(true);
			setStartError(null);

			try {
				const response = await fetch("/api/runs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
				});
				if (!response.ok) {
					setStartError(
						response.status === 409
							? "已有未完成的跑步，请先完成后再试。"
							: "无法开始跑步，请重试。",
					);
					updateStatus("idle");
					stopGpsTracking();
					return;
				}
				const data = await response.json();
				if (typeof data.runId !== "string") {
					setStartError("无法开始跑步，请重试。");
					updateStatus("idle");
					stopGpsTracking();
					return;
				}
				runIdRef.current = data.runId;
			} catch (error) {
				setStartError("无法开始跑步，请重试。");
				console.error("创建跑步会话失败", error);
				updateStatus("idle");
				stopGpsTracking();
				return;
			} finally {
				isStartingRef.current = false;
				setIsStarting(false);
			}

			const startedAt = Date.now();
			accumulatedRef.current = 0;
			distanceMetersRef.current = 0;
			rollingWindow.current = [];
			runStartRef.current = startedAt;
			sequenceRef.current = 1;
			segmentIndexRef.current = 0;
			lastEventTimestampRef.current = startedAt;
			stopEventPersistedRef.current = false;
			splitStartActiveSecondsRef.current = 0;
			retryDelay.current = 1_000;
			completionSnapshotRef.current = null;
			calibrationPointsRef.current = [];
			signalLostAtRef.current = null;
			lastPoint.current = null;
			pointQueue.current = [];
			setDistance(0);
			setDuration(0);
			setTrack([]);
			setCurrentPace("--");
			setSplits([]);
			updateStatus("running");
			startFlushTimer();
			startTimer(startedAt);
			if (initialPoint) acceptObservation(initialPoint);
		},
		[
			userId,
			calibrationTimerRef,
			updateStatus,
			stopGpsTracking,
			startFlushTimer,
			startTimer,
			acceptObservation,
		],
	);
	beginRunSessionRef.current = beginRunSession;

	useEffect(() => {
		if (!userId) return;
		let cancelled = false;
		void fetch("/api/runs/active")
			.then((response) => (response.ok ? response.json() : null))
			.then((payload) => {
				if (cancelled || !payload?.active) return;
				const active = payload.active as {
					runId: string;
					status: "running" | "paused" | "pending_completion";
					startTime: string;
					points: SequencedTrackPoint[];
					events: RunEvent[];
				};
				const points = active.points ?? [];
				const events = active.events ?? [];
				const restoredAt = Date.now();
				const distanceMeters = groupTrackSegments(points).reduce(
					(total, segment) => total + calcDistance(segment),
					0,
				);
				const restoredDuration = calculateActiveDuration(events, restoredAt);
				const latestSegment = groupTrackSegments(points).at(-1) ?? [];

				runIdRef.current = active.runId;
				runStartRef.current = new Date(active.startTime).getTime();
				sequenceRef.current = Math.max(
					0,
					...events.map((event) => event.sequence + 1),
					...points.map((point) => point.sequence + 1),
				);
				lastEventTimestampRef.current =
					events.at(-1)?.timestamp ?? runStartRef.current;
				segmentIndexRef.current = Math.max(
					0,
					...points.map((point) => point.segmentIndex ?? 0),
					events.filter((event) => event.type === "RESUME").length,
				);
				distanceMetersRef.current = distanceMeters;
				accumulatedRef.current = restoredDuration;
				lastPoint.current = latestSegment.at(-1) ?? null;
				rollingWindow.current = latestSegment.slice(-20);
				stopEventPersistedRef.current = events.at(-1)?.type === "STOP";
				setTrack(points);
				setDistance(distanceMeters / 1_000);
				setDuration(restoredDuration);
				updateStatus(active.status);

				if (active.status === "running") {
					startTimer(restoredAt);
					startGpsTracking();
					startFlushTimer();
				} else if (active.status === "pending_completion") {
					const stopTimestamp =
						events.findLast((event) => event.type === "STOP")?.timestamp ??
						restoredAt;
					completionSnapshotRef.current = {
						stopTime: new Date(stopTimestamp).toISOString(),
						durationSeconds: calculateActiveDuration(events, stopTimestamp),
						distanceMeters: Math.round(distanceMeters * 100) / 100,
					};
				}
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [userId, startGpsTracking, startTimer, startFlushTimer, updateStatus]);

	const start = useCallback(async () => {
		if (!userId || statusRef.current !== "idle") return;
		setStartError(null);
		calibrationPointsRef.current = [];
		signalLostAtRef.current = null;
		updateStatus("locating");
		startGpsTracking();
		if (calibrationTimerRef.current !== null) {
			clearTimeout(calibrationTimerRef.current);
		}
		calibrationTimerRef.current = setTimeout(() => {
			calibrationTimerRef.current = null;
			stopGpsTracking();
			setStartError("暂时无法获得稳定定位，请到室外开阔处重试");
			updateStatus("idle");
		}, 30_000);
	}, [userId, updateStatus, startGpsTracking, stopGpsTracking]);

	const startAnyway = useCallback(async () => {
		if (statusRef.current !== "locating") return;
		await beginRunSession();
	}, [beginRunSession]);

	const pause = useCallback(async () => {
		if (statusRef.current !== "running") return false;
		clearResources();
		await flushPoints();
		if (pointQueue.current.length > 0 || !(await pushEvent("PAUSE"))) {
			startTimer();
			startGpsTracking();
			startFlushTimer();
			return false;
		}
		lastPoint.current = null;
		signalLostAtRef.current = null;
		rollingWindow.current = [];
		setCurrentPace("--");
		updateStatus("paused");
		return true;
	}, [
		clearResources,
		flushPoints,
		pushEvent,
		startTimer,
		startGpsTracking,
		startFlushTimer,
		updateStatus,
	]);

	const resume = useCallback(async () => {
		if (statusRef.current !== "paused" || !(await pushEvent("RESUME")))
			return false;
		segmentIndexRef.current++;
		lastPoint.current = null;
		signalLostAtRef.current = null;
		rollingWindow.current = [];
		setCurrentPace("--");
		updateStatus("running");
		startTimer();
		startGpsTracking();
		startFlushTimer();
		return true;
	}, [pushEvent, updateStatus, startTimer, startGpsTracking, startFlushTimer]);

	const getSnapshot = useCallback((now = Date.now()): CompletionSnapshot => {
		const liveDelta =
			timer.current !== null
				? Math.floor((now - startTime.current) / 1_000)
				: 0;
		return {
			stopTime: new Date(now).toISOString(),
			durationSeconds: accumulatedRef.current + liveDelta,
			distanceMeters: Math.round(distanceMetersRef.current * 100) / 100,
		};
	}, []);

	const retryCompletionRequest = useCallback(async () => {
		const runId = runIdRef.current;
		const snapshot = completionSnapshotRef.current;
		if (!runId || !snapshot) return;
		setCompletionError(null);
		try {
			const response = await fetch(`/api/runs/${runId}/complete`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					stopTime: snapshot.stopTime,
					preview: {
						distanceMeters: snapshot.distanceMeters,
						durationSeconds: snapshot.durationSeconds,
					},
				}),
			});
			if (!response.ok)
				throw new Error(`completion failed: ${response.status}`);
			const body = await response.json();
			if (!body.result) throw new Error("confirmed result missing");
			updateStatus("finished");
			runIdRef.current = null;
			completionSnapshotRef.current = null;
			return body.result;
		} catch {
			setCompletionError("保存跑步结果失败，请重试或放弃。");
		}
	}, [updateStatus]);

	const stop = useCallback(async () => {
		const runId = runIdRef.current;
		if (!runId) return;
		let stopTimestamp: number;
		if (statusRef.current === "pending_completion") {
			const snapshot = completionSnapshotRef.current;
			if (!snapshot) return;
			stopTimestamp = new Date(snapshot.stopTime).getTime();
		} else {
			stopTimestamp = Math.max(Date.now(), lastEventTimestampRef.current + 1);
			completionSnapshotRef.current = getSnapshot(stopTimestamp);
			clearResources();
			updateStatus("pending_completion");
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
				updateStatus("idle");
				setCompletionError("跑步未达到最短记录时长，已放弃。");
				return;
			}
		} catch {
			setCompletionError("进入待完成状态失败，请重试或放弃。");
			return;
		}
		return retryCompletionRequest();
	}, [
		getSnapshot,
		clearResources,
		updateStatus,
		flushPoints,
		pushEvent,
		retryCompletionRequest,
	]);

	const abandon = useCallback(async () => {
		const runId = runIdRef.current;
		if (!runId || statusRef.current !== "pending_completion") return false;
		const response = await fetch(`/api/runs/${runId}`, { method: "DELETE" });
		if (!response.ok) {
			setCompletionError("放弃失败，请重试。");
			return false;
		}
		runIdRef.current = null;
		completionSnapshotRef.current = null;
		pointQueue.current = [];
		setTrack([]);
		updateStatus("idle");
		setCompletionError(null);
		return true;
	}, [updateStatus]);

	useEffect(
		() => () => {
			if (timer.current !== null) clearInterval(timer.current);
			if (flushTimer.current !== null) clearInterval(flushTimer.current);
			if (retryTimer.current !== null) clearTimeout(retryTimer.current);
			if (calibrationTimerRef.current !== null) {
				clearTimeout(calibrationTimerRef.current);
			}
		},
		[],
	);

	const pace = calcPace(distance, duration);
	const distanceKilometers = Number(distance.toFixed(2));

	return {
		status,
		completionError,
		isStarting,
		startError,
		distanceKilometersFormatted: distance.toFixed(2),
		durationFormatted: formatDuration(duration),
		paceFormatted: pace,
		currentPaceFormatted: currentPace,
		splits,
		calories: Math.round(distanceKilometers * 70),
		track,
		trackSegments: groupTrackSegments(track),
		gpsState,
		retryGps: startGpsTracking,
		start,
		startAnyway,
		pause,
		resume,
		stop,
		retryCompletion: stop,
		abandon,
		getSnapshot,
	};
}
