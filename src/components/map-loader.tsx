"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { loadAMapSDK, type AMapSDK } from "@/lib/amap-sdk";
import { wgs84ToGcj02Point } from "@/lib/coord-transform";
import type { TrackObservation } from "@/lib/run-contract";
import { groupTrackSegments } from "@/lib/run-timeline";
import { cn } from "@/lib/utils";

interface RunMapProps {
	center?: [number, number];
	currentPosition?: TrackObservation | null;
	track?: { lat: number; lng: number; segmentIndex?: number }[];
	finished?: boolean;
	compact?: boolean;
}

type CameraMode = "following" | "free" | "overview";

const DEFAULT_CENTER: [number, number] = [116.397, 39.908];

export default function RunMap({
	center: initialCenter,
	currentPosition,
	track = [],
	finished = false,
	compact = false,
}: RunMapProps) {
	const containerRef = useRef<HTMLDivElement>(null!);
	const mapRef = useRef<AMap.Map | null>(null);
	const sdkRef = useRef<AMapSDK | null>(null);
	const polylineRefs = useRef<(AMap.Polyline | null)[]>([]);
	const glowRefs = useRef<(AMap.Polyline | null)[]>([]);
	const markerRef = useRef<AMap.Marker | null>(null);
	const accuracyCircleRef = useRef<AMap.Circle | null>(null);
	const startMarkerRef = useRef<AMap.Marker | null>(null);
	const endMarkerRef = useRef<AMap.Marker | null>(null);
	const cameraModeRef = useRef<CameraMode>("following");
	const colorsRef = useRef({ track: "", position: "", accuracy: "" });
	const [cameraMode, setCameraMode] = useState<CameraMode>("following");
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const gcjSegments = useMemo(
		() =>
			groupTrackSegments(track).map((segment) =>
				segment.map((point) => wgs84ToGcj02Point(point)),
			),
		[track],
	);
	const gcjTrack = useMemo(() => gcjSegments.flat(), [gcjSegments]);
	const gcjCurrentPosition = useMemo(
		() => (currentPosition ? wgs84ToGcj02Point(currentPosition) : null),
		[currentPosition],
	);

	useEffect(() => {
		let cancelled = false;
		void loadAMapSDK()
			.then((AMap) => {
				if (cancelled) return;
				sdkRef.current = AMap;
				const latestTrackPoint = gcjTrack.at(-1);
				const center = gcjCurrentPosition
					? [gcjCurrentPosition.lng, gcjCurrentPosition.lat]
					: latestTrackPoint
						? [latestTrackPoint.lng, latestTrackPoint.lat]
						: (initialCenter ?? DEFAULT_CENTER);
				const rootStyle = getComputedStyle(document.documentElement);
				colorsRef.current = {
					track: rootStyle.getPropertyValue("--run-track-map").trim(),
					position: rootStyle.getPropertyValue("--run-position-map").trim(),
					accuracy: rootStyle.getPropertyValue("--run-accuracy-map").trim(),
				};

				const map = new AMap.Map(containerRef.current, {
					zoom: 18,
					center: center as [number, number],
				});
				mapRef.current = map;

				const marker = new AMap.Marker({
					position: center as [number, number],
					content: `<div style="width:14px;height:14px;background:${colorsRef.current.position};border:2px solid var(--primary-foreground);border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,.3)"></div>`,
					anchor: "center",
				});
				const accuracyCircle = new AMap.Circle({
					center: center as [number, number],
					radius: currentPosition?.accuracy ?? 0,
					strokeColor: colorsRef.current.accuracy,
					strokeOpacity: 0.65,
					strokeWeight: 1,
					fillColor: colorsRef.current.accuracy,
					fillOpacity: 0.12,
				});
				map.add([accuracyCircle, marker]);
				markerRef.current = marker;
				accuracyCircleRef.current = accuracyCircle;
				if (!gcjCurrentPosition && !latestTrackPoint) marker.hide();
				if (!gcjCurrentPosition) accuracyCircle.hide();

				const enterFreeMode = () => {
					if (cameraModeRef.current === "overview") return;
					cameraModeRef.current = "free";
					setCameraMode("free");
				};
				map.on("dragstart", enterFreeMode);
				map.on("zoomstart", enterFreeMode);
				setLoaded(true);
			})
			.catch((sdkError: unknown) => {
				if (cancelled) return;
				setError(
					sdkError instanceof Error ? sdkError.message : String(sdkError),
				);
			});

		return () => {
			cancelled = true;
			mapRef.current?.destroy();
			mapRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		const marker = markerRef.current;
		const accuracyCircle = accuracyCircleRef.current;
		const map = mapRef.current;
		if (!loaded || !marker || !accuracyCircle || !map) return;

		const displayPoint = gcjCurrentPosition ?? gcjTrack.at(-1);
		if (!displayPoint) {
			marker.hide();
			accuracyCircle.hide();
			return;
		}
		const position = [displayPoint.lng, displayPoint.lat] as [number, number];
		marker.setPosition(position);
		marker.show();
		if (gcjCurrentPosition && currentPosition) {
			accuracyCircle.setCenter(position);
			accuracyCircle.setRadius(currentPosition.accuracy);
			accuracyCircle.show();
		} else {
			accuracyCircle.hide();
		}
		if (cameraModeRef.current === "following") map.setCenter(position);
	}, [currentPosition, gcjCurrentPosition, gcjTrack, loaded]);

	useEffect(() => {
		const AMap = sdkRef.current;
		const map = mapRef.current;
		if (!loaded || !AMap || !map) return;

		const frame = requestAnimationFrame(() => {
			for (const [index, segment] of gcjSegments.entries()) {
				if (segment.length < 2) continue;
				const path = segment.map(
					(point) => [point.lng, point.lat] as [number, number],
				);
				if (!polylineRefs.current[index]) {
					const glow = new AMap.Polyline({
						path,
						strokeColor: colorsRef.current.track,
						strokeWeight: 10,
						strokeOpacity: 0.25,
						strokeStyle: "solid",
					});
					const polyline = new AMap.Polyline({
						path,
						strokeColor: colorsRef.current.track,
						strokeWeight: 6,
						strokeStyle: "solid",
					});
					map.add([glow, polyline]);
					glowRefs.current[index] = glow;
					polylineRefs.current[index] = polyline;
				} else {
					polylineRefs.current[index]?.setPath(path);
					glowRefs.current[index]?.setPath(path);
				}
			}

			const startPoint = gcjTrack.at(0);
			if (startPoint) {
				const startPosition = [startPoint.lng, startPoint.lat] as [
					number,
					number,
				];
				if (!startMarkerRef.current) {
					startMarkerRef.current = new AMap.Marker({
						position: startPosition,
						content: `<div style="width:12px;height:12px;background:${colorsRef.current.track};border:2px solid var(--primary-foreground);border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,.3)"></div>`,
						anchor: "center",
					});
					map.add(startMarkerRef.current);
				} else {
					startMarkerRef.current.setPosition(startPosition);
					startMarkerRef.current.show();
				}
			} else {
				startMarkerRef.current?.hide();
			}

			if (finished && gcjTrack.length >= 2) {
				cameraModeRef.current = "overview";
				setCameraMode("overview");
				const routeOverlays = polylineRefs.current.filter(
					(polyline): polyline is AMap.Polyline => polyline !== null,
				);
				if (routeOverlays.length > 0) map.setFitView(routeOverlays);
			}
		});

		return () => cancelAnimationFrame(frame);
	}, [finished, gcjSegments, gcjTrack, loaded]);

	useEffect(() => {
		const AMap = sdkRef.current;
		const map = mapRef.current;
		if (!loaded || !AMap || !map) return;
		const endPoint = gcjTrack.at(-1);

		if (finished && endPoint && gcjTrack.length >= 2) {
			markerRef.current?.hide();
			accuracyCircleRef.current?.hide();
			const endPosition = [endPoint.lng, endPoint.lat] as [number, number];
			if (!endMarkerRef.current) {
				endMarkerRef.current = new AMap.Marker({
					position: endPosition,
					content: `<div style="width:12px;height:12px;background:var(--run-stop);border:2px solid var(--primary-foreground);border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,.3)"></div>`,
					anchor: "center",
				});
				map.add(endMarkerRef.current);
			} else {
				endMarkerRef.current.setPosition(endPosition);
				endMarkerRef.current.show();
			}
		} else {
			endMarkerRef.current?.hide();
		}
	}, [finished, gcjTrack, loaded]);

	const resumeFollowing = () => {
		const position = gcjCurrentPosition ?? gcjTrack.at(-1);
		if (!position) return;
		cameraModeRef.current = "following";
		setCameraMode("following");
		mapRef.current?.setCenter([position.lng, position.lat]);
	};

	return (
		<div
			className={cn(
				"relative w-full shrink-0 overflow-hidden",
				compact
					? "h-[clamp(11rem,30dvh,15rem)] min-h-0 rounded-xl"
					: "h-[55dvh] min-h-64 rounded-b-xl",
			)}
		>
			<div ref={containerRef} className="h-full w-full" />
			{cameraMode === "free" && !error ? (
				<button
					type="button"
					onClick={resumeFollowing}
					className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-2 text-xs font-medium text-foreground shadow-lg"
				>
					<LocateFixed className="size-4 text-primary" />
					回到当前位置
				</button>
			) : null}
			{error ? (
				<div className="absolute inset-0 flex items-center justify-center bg-card px-6">
					<div className="text-center text-sm">
						<p className="text-destructive">地图加载失败，跑步仍会继续记录</p>
						<p className="mt-1 text-muted-foreground">{error}</p>
					</div>
				</div>
			) : (
				!loaded && (
					<div className="absolute inset-0 flex animate-pulse items-center justify-center bg-card">
						<div className="text-center text-sm text-muted-foreground">
							<MapPlaceholder />
							加载地图中...
						</div>
					</div>
				)
			)}
		</div>
	);
}

function MapPlaceholder() {
	return (
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
	);
}
