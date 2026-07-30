"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { segmentDistance, formatDuration, calcPace } from "@/lib/track-calc";
import useGpsTracking from "@/hooks/use-gps-tracking";

interface TrackPoint {
	lat: number;
	lng: number;
	timestamp: number;
}

interface RunOptions {
	samplingDensity?: "high" | "medium" | "low";
}

export default function useRunTracker(userId?: string, options?: RunOptions) {
	const [status, setStatus] = useState<"idle" | "running" | "paused" | "finished">("idle");
	const [distance, setDistance] = useState(0);
	const [duration, setDuration] = useState(0);
	const [track, setTrack] = useState<TrackPoint[]>([]);
	const [currentPace, setCurrentPace] = useState("--");
	const [splits, setSplits] = useState<
		{ km: number; pace: string; duration: number }[]
	>([]);
	const lastPoint = useRef<TrackPoint | null>(null);
	const runStartRef = useRef<number>(0);
	const startTime = useRef<number>(0);
	const timer = useRef<ReturnType<typeof setInterval> | null>(null);
	const accumulatedRef = useRef(0);
	const distanceMetersRef = useRef(0);
	const splitStartRef = useRef(0);
	const rollingWindow = useRef<TrackPoint[]>([]);

	const runIdRef = useRef<string | null>(null);
	const userIdRef = useRef(userId);
	const pointQueue = useRef<TrackPoint[]>([]);
	const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		userIdRef.current = userId;
	}, [userId]);

	const flushPoints = useCallback(() => {
		const runId = runIdRef.current;
		if (!runId || pointQueue.current.length === 0) return;

		const batch = pointQueue.current.splice(0);
		fetch(`/api/runs/${runId}/points`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ points: batch }),
		}).catch(() => {});
	}, []);

	const handleGpsPoint = useCallback((point: TrackPoint) => {
		setTrack((prev) => [...prev, point]);
		pointQueue.current.push(point);

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

			// Auto km split
			const km = Math.floor(distanceMetersRef.current / 1000);
			if (
				km > 0 &&
				km !== Math.floor((distanceMetersRef.current - dist) / 1000)
			) {
				const kmDuration = Math.round(
					(Date.now() - splitStartRef.current) / 1000,
				);
				setSplits((prev) => [
					...prev,
					{ km, pace: calcPace(1, kmDuration), duration: kmDuration },
				]);
				splitStartRef.current = Date.now();
			}
		}

		lastPoint.current = point;

		// Rolling 30s window for instant pace
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
	}, []);

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
	}, [stopTimer, gps]);

	const start = useCallback(async () => {
		const uid = userIdRef.current;
		if (!uid) return;

		accumulatedRef.current = 0;
		distanceMetersRef.current = 0;
		splitStartRef.current = Date.now();
		rollingWindow.current = [];
		runStartRef.current = Date.now();
		setStatus("running");
		setDistance(0);
		setDuration(0);
		setTrack([]);
		setCurrentPace("--");
		setSplits([]);
		lastPoint.current = null;
		pointQueue.current = [];

		try {
			const res = await fetch("/api/runs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: uid }),
			});
			const data = await res.json();
			runIdRef.current = data.runId;
		} catch (e) {
			console.error("创建跑步会话失败", e);
			return;
		}

		flushTimer.current = setInterval(flushPoints, 15000);
		startTimer();
		gps.startTracking();
	}, [startTimer, gps, flushPoints]);

	const pause = useCallback(() => {
		clearResources();
		setStatus("paused");
	}, [clearResources]);

	const resume = useCallback(() => {
		setStatus("running");
		startTimer();
		gps.startTracking();
		flushTimer.current = setInterval(flushPoints, 15000);
	}, [startTimer, gps, flushPoints]);

	const getSnapshot = useCallback(() => {
		const now = Date.now();
		const finalDuration =
			accumulatedRef.current + Math.floor((now - startTime.current) / 1000);
		const distKm = parseFloat(distance.toFixed(2));
		const calories = Math.round(distKm * 70);
		return {
			startTime: new Date(runStartRef.current).toISOString(),
			endTime: new Date(now).toISOString(),
			duration: finalDuration,
			distance: distKm,
			avgPace: calcPace(distance, finalDuration),
			trackPoints: track.map((p) => ({
				lat: p.lat,
				lng: p.lng,
				timestamp: p.timestamp,
			})),
			calories,
			splits: splits.length > 0 ? splits : undefined,
		};
	}, [distance, track, splits]);

	const stop = useCallback(async () => {
		const runId = runIdRef.current;
		if (!runId) return;

		if (pointQueue.current.length > 0) {
			try {
				await fetch(`/api/runs/${runId}/points`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ points: pointQueue.current }),
				});
			} catch (e) {
				console.error("刷新剩余点失败", e);
			}
			pointQueue.current = [];
		}

		const snapshot = getSnapshot();
		try {
			await fetch(`/api/runs/${runId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: userIdRef.current, ...snapshot }),
			});
		} catch (e) {
			console.error("保存失败", e);
		}

		clearResources();
		accumulatedRef.current = 0;
		setStatus("finished");
		runIdRef.current = null;

		return { ...snapshot, runId };
	}, [getSnapshot, clearResources]);

	const pace = calcPace(distance, duration);
	const distKm = parseFloat(distance.toFixed(2));
	const calories = Math.round(distKm * 70);

	return {
		status,
		distance: distance.toFixed(2),
		duration: formatDuration(duration),
		pace,
		currentPace,
		splits,
		calories,
		track,
		start,
		pause,
		resume,
		stop,
		getSnapshot,
	};
}
