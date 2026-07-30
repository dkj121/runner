"use client";

import { useState, useEffect, useRef } from "react";
import { loadAMapSDK, type AMapSDK } from "@/lib/amap-sdk";

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

	useEffect(() => {
		let cancelled = false;

		// load SDK and get GPS position in parallel
		const sdkLoad = loadAMapSDK();
		const gpsPos = new Promise<[number, number]>((resolve) => {
			navigator.geolocation.getCurrentPosition(
				(pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
				() => resolve(initialCenter ?? [116.397, 39.908]),
				{ enableHighAccuracy: true, timeout: 5000 },
			);
		});

		// show map as soon as SDK is ready, with whatever center we have
		Promise.all([sdkLoad, gpsPos]).then(([AMap, center]) => {
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
		});

		return () => {
			cancelled = true;
			mapRef.current?.destroy();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!track || track.length === 0) return;
		const latest = track[track.length - 1];
		const pos = [latest.lng, latest.lat] as [number, number];
		markerRef.current?.setPosition(pos);
		if (track.length >= 2) {
			const path = track.map((p) => [p.lng, p.lat] as [number, number]);
			polylineRef.current?.setPath(path);
			glowRef.current?.setPath(path);
		}
		mapRef.current?.setCenter(pos);
	}, [track]);

	useEffect(() => {
		const AMap = sdkRef.current;
		const map = mapRef.current;
		if (!AMap || !map) return;

		if (finished && track && track.length >= 2) {
			markerRef.current?.hide();

			const startPos = [track[0].lng, track[0].lat] as [number, number];
			const endPos = [
				track[track.length - 1].lng,
				track[track.length - 1].lat,
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
	}, [finished, track]);

	return (
		<div className="relative h-[55dvh] min-h-64 w-full shrink-0 overflow-hidden rounded-b-xl">
			<div ref={containerRef} className="h-full w-full" />
			{!loaded && (
				<div className="absolute inset-0 flex animate-pulse items-center justify-center bg-gray-100">
					<div className="text-center text-sm text-gray-400">
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
			)}
		</div>
	);
}
