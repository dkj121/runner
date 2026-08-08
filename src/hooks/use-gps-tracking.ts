"use client";

import { useRef, useCallback, useEffect, useState } from "react";

type SamplingDensity = "high" | "medium" | "low";

interface GpsPoint {
	lat: number;
	lng: number;
	timestamp: number;
}

interface UseGpsTrackingOptions {
	samplingDensity?: SamplingDensity;
	onPoint: (p: GpsPoint) => void;
}

const DENSITY_INTERVAL: Record<SamplingDensity, number> = {
	high: 1000,
	medium: 5000,
	low: 10000,
};

const ERROR_MESSAGES: Record<number, string> = {
	1: "定位权限被拒绝，请在系统设置中允许定位",
	2: "定位不可用，请检查GPS信号",
	3: "定位超时，请重试",
};

export default function useGpsTracking({
	samplingDensity = "high",
	onPoint,
}: UseGpsTrackingOptions) {
	const watchIdRef = useRef<number | null>(null);
	const onPointRef = useRef(onPoint);
	const intervalRef = useRef(DENSITY_INTERVAL[samplingDensity]);
	const lastEmitRef = useRef(0);
	const [state, setState] = useState({
		isTracking: false,
		currentPosition: null as { lat: number; lng: number } | null,
		error: null as string | null,
	});

	onPointRef.current = onPoint;

	const startTracking = useCallback(() => {
		if (!navigator.geolocation) {
			setState((prev) => ({ ...prev, error: "浏览器不支持定位功能" }));
			return;
		}

		setState((prev) => ({ ...prev, error: null, isTracking: true }));
		lastEmitRef.current = 0;

		watchIdRef.current = navigator.geolocation.watchPosition(
			(pos) => {
				const minInterval = intervalRef.current;
				const now = Date.now();
				if (minInterval > 0 && now - lastEmitRef.current < minInterval) return;
				lastEmitRef.current = now;

				const point: GpsPoint = {
					lat: pos.coords.latitude,
					lng: pos.coords.longitude,
					timestamp: pos.timestamp,
				};

				onPointRef.current(point);
				setState((prev) => ({
					...prev,
					currentPosition: { lat: point.lat, lng: point.lng },
				}));
			},
			(err) => {
				console.error("[GPS]", err);
				setState((prev) => ({
					...prev,
					error: ERROR_MESSAGES[err.code] ?? "定位失败",
				}));
			},
			{ enableHighAccuracy: true, maximumAge: 1000 },
		);
	}, []);

	const stopTracking = useCallback(() => {
		if (watchIdRef.current !== null) {
			navigator.geolocation.clearWatch(watchIdRef.current);
			watchIdRef.current = null;
		}
		setState({ isTracking: false, currentPosition: null, error: null });
	}, []);

	useEffect(() => {
		return () => {
			if (watchIdRef.current !== null) {
				navigator.geolocation.clearWatch(watchIdRef.current);
			}
		};
	}, []);

	return { startTracking, stopTracking, state };
}
