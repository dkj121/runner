const EARTH_RADIUS = 6_371_000;

/**
 * haversine 公式计算两点间距离（米）
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

export function segmentDistance(
	p1: { lat: number; lng: number },
	p2: { lat: number; lng: number },
): number {
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
	const hours = Math.floor(s / 3600);
	const minutes = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
	}
	return `${String(minutes).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function calcPace(distanceKm: number, durationSec: number): string {
	if (distanceKm <= 0) return "--";
	const secPerKm = Math.round(durationSec / distanceKm);
	const m = Math.floor(secPerKm / 60);
	const s = secPerKm % 60;
	return `${m}:${String(s).padStart(2, "0")} /km`;
}
