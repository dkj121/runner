"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import type { TrackObservation } from "@/lib/run-contract";

interface UseGpsTrackingOptions {
	onPoint: (point: TrackObservation) => void;
}

const ERROR_MESSAGES: Record<number, string> = {
	1: "定位权限被拒绝，请在系统设置中允许定位",
	2: "定位不可用，请检查GPS信号",
	3: "定位超时，请重试",
};

const INSECURE_CONTEXT_MESSAGE =
	"Chrome 要求通过 HTTPS 访问后才能使用定位，请改用 HTTPS 测试地址";

export default function useGpsTracking({ onPoint }: UseGpsTrackingOptions) {
	const watchIdRef = useRef<number | null>(null);
	const onPointRef = useRef(onPoint);
	const [state, setState] = useState({
		isTracking: false,
		currentPosition: null as TrackObservation | null,
		accuracy: null as number | null,
		error: null as string | null,
	});

	onPointRef.current = onPoint;

	const startTracking = useCallback(() => {
		if (window.isSecureContext === false) {
			setState((previous) => ({
				...previous,
				isTracking: false,
				error: INSECURE_CONTEXT_MESSAGE,
			}));
			return;
		}
		if (!navigator.geolocation) {
			setState((prev) => ({ ...prev, error: "浏览器不支持定位功能" }));
			return;
		}
		if (watchIdRef.current !== null) {
			navigator.geolocation.clearWatch(watchIdRef.current);
			watchIdRef.current = null;
		}

		setState((prev) => ({ ...prev, error: null, isTracking: true }));

		watchIdRef.current = navigator.geolocation.watchPosition(
			(pos) => {
				const point: TrackObservation = {
					lat: pos.coords.latitude,
					lng: pos.coords.longitude,
					timestamp: pos.timestamp,
					accuracy: pos.coords.accuracy,
					altitude: pos.coords.altitude,
				};

				setState((prev) => ({
					...prev,
					currentPosition: point,
					accuracy: point.accuracy,
				}));
				onPointRef.current(point);
			},
			(err) => {
				console.warn("[GPS]", { code: err.code, message: err.message });
				setState((prev) => ({
					...prev,
					error: ERROR_MESSAGES[err.code] ?? "定位失败",
				}));
			},
			{ enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
		);
	}, []);

	const stopTracking = useCallback(() => {
		if (watchIdRef.current !== null) {
			navigator.geolocation.clearWatch(watchIdRef.current);
			watchIdRef.current = null;
		}
		setState((prev) => ({ ...prev, isTracking: false }));
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
