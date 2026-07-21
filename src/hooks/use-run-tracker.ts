"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { segmentDistance, formatDuration, calcPace } from "@/lib/track-calc";
import { startWatching, stopWatching } from "@/lib/gps-tracker";

interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

export default function useRunTracker(userId?: string) {
  const [status, setStatus] = useState<"idle" | "running" | "paused">("idle");
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const watchId = useRef<number | null>(null);
  const lastPoint = useRef<TrackPoint | null>(null);
  const runStartRef = useRef<number>(0);
  const startTime = useRef<number>(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const accumulatedRef = useRef(0);

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

  const clearResources = useCallback(() => {
    if (watchId.current !== null) {
      stopWatching(watchId.current);
      watchId.current = null;
    }
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
    if (flushTimer.current !== null) {
      clearInterval(flushTimer.current);
      flushTimer.current = null;
    }
  }, []);

  const beginWatching = useCallback(() => {
    startTime.current = Date.now();
    timer.current = setInterval(() => {
      setDuration(
        () =>
          accumulatedRef.current +
          Math.floor((Date.now() - startTime.current) / 1000),
      );
    }, 1000);

    watchId.current = startWatching(
      (pos) => {
        const point: TrackPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: pos.timestamp,
        };
        setTrack((prev) => [...prev, point]);
        pointQueue.current.push(point);

        const prev = lastPoint.current;
        if (prev) {
          const dist = segmentDistance(prev, point);
          if (dist > 5) {
            setDistance((d) => d + dist / 1000);
          }
        }
        lastPoint.current = point;
      },
      (err) => console.error(err),
    );
  }, []);

  const start = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;

    accumulatedRef.current = 0;
    runStartRef.current = Date.now();
    setStatus("running");
    setDistance(0);
    setDuration(0);
    setTrack([]);
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
    beginWatching();
  }, [beginWatching, flushPoints]);

  const pause = useCallback(() => {
    accumulatedRef.current += Math.floor(
      (Date.now() - startTime.current) / 1000,
    );
    clearResources();
    setStatus("paused");
  }, [clearResources]);

  const resume = useCallback(() => {
    setStatus("running");
    beginWatching();
    flushTimer.current = setInterval(flushPoints, 15000);
  }, [beginWatching, flushPoints]);

  const getSnapshot = useCallback(() => {
    const now = Date.now();
    const finalDuration =
      accumulatedRef.current + Math.floor((now - startTime.current) / 1000);
    return {
      startTime: new Date(runStartRef.current).toISOString(),
      endTime: new Date(now).toISOString(),
      duration: finalDuration,
      distance: parseFloat(distance.toFixed(2)),
      avgPace: calcPace(distance, finalDuration),
      points: track.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        timestamp: p.timestamp,
      })),
    };
  }, [distance, track]);

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
    setStatus("idle");
    runIdRef.current = null;
  }, [getSnapshot, clearResources]);

  const pace = calcPace(distance, duration);

  return {
    status,
    distance: distance.toFixed(2),
    duration: formatDuration(duration),
    pace,
    track,
    start,
    pause,
    resume,
    stop,
    getSnapshot,
  };
}
