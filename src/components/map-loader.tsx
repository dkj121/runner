"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { loadAMapSDK, type AMapSDK } from "@/lib/amap-sdk";
import { wgs84ToGcj02, wgs84ToGcj02Point } from "@/lib/coord-transform";

interface RunMapProps {
	center?: [number, number];
	track?: { lat: number; lng: number }[];
	finished?: boolean;
}

export default function RunMap({
	center: initialCenter,
	track,
	finished,
}: RunMapProps) {
	const containerRef = useRef<HTMLDivElement>(null!);
	const mapRef = useRef<AMap.Map | null>(null);
	const sdkRef = useRef<AMapSDK | null>(null);
	const polylineRef = useRef<AMap.Polyline | null>(null);
	const glowRef = useRef<AMap.Polyline | null>(null);
	const markerRef = useRef<AMap.Marker | null>(null);
	const startMarkerRef = useRef<AMap.Marker | null>(null);
	const endMarkerRef = useRef<AMap.Marker | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// AMap renders in GCJ-02 while GPS/storage stays WGS-84 — convert once per
	// track change instead of on every render.
	const gcjTrack = useMemo(
		() => (track ?? []).map((p) => wgs84ToGcj02Point(p)),
		[track],
	);

	useEffect(() => {
		let cancelled = false;

		// load SDK and get GPS position in parallel
		const sdkLoad = loadAMapSDK();
		const gpsPos = new Promise<[number, number]>((resolve) => {
			navigator.geolocation.getCurrentPosition(
				(pos) => {
					const { lat, lng } = wgs84ToGcj02(
						pos.coords.latitude,
						pos.coords.longitude,
					);
					resolve([lng, lat]);
				},
				() => resolve(initialCenter ?? [116.397, 39.908]),
				{ enableHighAccuracy: true, timeout: 5000 },
			);
		});

		// show map as soon as SDK is ready, with whatever center we have
		Promise.all([sdkLoad, gpsPos])
			.then(([AMap, center]) => {
				if (cancelled) return;
				sdkRef.current = AMap;
				const [lng, lat] = center;

				const map = new AMap.Map(containerRef.current, {
					zoom: 16,
					center,
				});
				mapRef.current = map;

				// glow trail (semi-transparent wide line behind the solid one)
				const glow = new AMap.Polyline({
					path: [
						[lng, lat],
						[lng, lat],
					],
					strokeColor: "#22c55e",
					strokeWeight: 10,
					strokeOpacity: 0.25,
					strokeStyle: "solid",
				});
				map.add(glow);
				glowRef.current = glow;

				const polyline = new AMap.Polyline({
					path: [
						[lng, lat],
						[lng, lat],
					],
					strokeColor: "#22c55e",
					strokeWeight: 6,
					strokeStyle: "solid",
				});
				map.add(polyline);
				polylineRef.current = polyline;

				const marker = new AMap.Marker({
					position: [lng, lat],
					content: `<div style="
          width: 14px; height: 14px;
          background: #3b82f6;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 0 4px rgba(0,0,0,.3);
        "></div>`,
					anchor: "center",
				});
				map.add(marker);
				markerRef.current = marker;
				setLoaded(true);
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : String(err));
			});

		return () => {
			cancelled = true;
			mapRef.current?.destroy();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (gcjTrack.length === 0) return;
		const latest = gcjTrack[gcjTrack.length - 1];
		const pos = [latest.lng, latest.lat] as [number, number];
		markerRef.current?.setPosition(pos);
		if (gcjTrack.length >= 2) {
			const path = gcjTrack.map((p) => [p.lng, p.lat] as [number, number]);
			polylineRef.current?.setPath(path);
			glowRef.current?.setPath(path);
		}
		mapRef.current?.setCenter(pos);
	}, [gcjTrack]);

	useEffect(() => {
		const AMap = sdkRef.current;
		const map = mapRef.current;
		if (!AMap || !map) return;

		if (finished && gcjTrack.length >= 2) {
			markerRef.current?.hide();

			const startPos = [gcjTrack[0].lng, gcjTrack[0].lat] as [number, number];
			const endPos = [
				gcjTrack[gcjTrack.length - 1].lng,
				gcjTrack[gcjTrack.length - 1].lat,
			] as [number, number];

			if (!startMarkerRef.current) {
				startMarkerRef.current = new AMap.Marker({
					position: startPos,
					content: `<div style="
            width: 12px; height: 12px;
            background: #22c55e;
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 0 4px rgba(0,0,0,.3);
          "></div>`,
					anchor: "center",
				});
				map.add(startMarkerRef.current);
			} else {
				startMarkerRef.current.setPosition(startPos);
				startMarkerRef.current.show();
			}

			if (!endMarkerRef.current) {
				endMarkerRef.current = new AMap.Marker({
					position: endPos,
					content: `<div style="
            width: 12px; height: 12px;
            background: #ef4444;
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 0 4px rgba(0,0,0,.3);
          "></div>`,
					anchor: "center",
				});
				map.add(endMarkerRef.current);
			} else {
				endMarkerRef.current.setPosition(endPos);
				endMarkerRef.current.show();
			}
		} else {
			markerRef.current?.show();
			startMarkerRef.current?.hide();
			endMarkerRef.current?.hide();
		}
	}, [finished, gcjTrack]);

	return (
		<div className="relative h-[55dvh] min-h-64 w-full shrink-0 overflow-hidden rounded-b-xl">
			<div ref={containerRef} className="h-full w-full" />
			{error ? (
				<div className="absolute inset-0 flex items-center justify-center bg-card px-6">
					<div className="text-center text-sm">
						<p className="text-destructive">地图加载失败</p>
						<p className="mt-1 text-muted-foreground">{error}</p>
					</div>
				</div>
			) : (
				!loaded && (
					<div className="absolute inset-0 flex animate-pulse items-center justify-center bg-card">
						<div className="text-center text-sm text-muted-foreground">
							<svg
								className="mx-auto mb-2 size-8"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={1.5}
									d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
								/>
							</svg>
							加载地图中...
						</div>
					</div>
				)
			)}
		</div>
	);
}
