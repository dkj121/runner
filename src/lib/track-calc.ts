const EARTH_RADIUS = 6_371_000;

/* AMap GeometryUtil 优先，不可用时用 haversine */
let geoDistance:
	| ((lat1: number, lng1: number, lat2: number, lng2: number) => number)
	| null = null;
let amapLoaded = false;

function ensureAMap(): void {
	if (amapLoaded) return;
	amapLoaded = true;
	import("./amap-sdk")
		.then((mod) => mod.loadAMapSDK())
		.then((AMap) => {
			if (AMap?.GeometryUtil?.distance) {
				geoDistance = (lat1, lng1, lat2, lng2) =>
					AMap.GeometryUtil.distance([lng1, lat1], [lng2, lat2]);
			}
		})
		.catch(() => {});
}

/**
 * haversine 公式计算两点间距离（米）
 * 作为 AMap GeometryUtil.distance 的纯 JS 回退方案
 */
export function haversineDistance(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* AMap GeometryUtil 不可用时退化为 haversine */
export function segmentDistance(
	p1: { lat: number; lng: number },
	p2: { lat: number; lng: number },
): number {
	if (geoDistance) return geoDistance(p1.lat, p1.lng, p2.lat, p2.lng);
	ensureAMap();
	return haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
}

export function calcDistance(track: { lat: number; lng: number }[]): number {
	if (track.length < 2) return 0;
	let total = 0;
	for (let i = 1; i < track.length; i++) {
		const d = segmentDistance(track[i - 1], track[i]);
		if (d > 5) total += d;
	}
	return total / 1000;
}

export function formatDuration(s: number): string {
	const m = Math.floor(s / 60);
	const sec = s % 60;
	return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function calcPace(distanceKm: number, durationSec: number): string {
	if (distanceKm <= 0) return "--";
	const secPerKm = Math.round(durationSec / distanceKm);
	const m = Math.floor(secPerKm / 60);
	const s = secPerKm % 60;
	return `${m}:${String(s).padStart(2, "0")} /km`;
}
