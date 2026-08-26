import type { SequencedTrackPoint, TrackObservation } from "@/lib/run-contract";
import { segmentDistance } from "@/lib/track-calc";

export const TRACK_POINT_QUALITY = {
	maxAccuracyMeters: 30,
	minMovementMeters: 5,
	maxSpeedMetersPerSecond: 8,
	calibrationFixes: 3,
	calibrationSpreadMeters: 15,
} as const;

export function isStableCalibration(
	points: TrackObservation[],
): points is [TrackObservation, TrackObservation, TrackObservation] {
	if (
		points.length < TRACK_POINT_QUALITY.calibrationFixes ||
		points.some(
			(point) => point.accuracy > TRACK_POINT_QUALITY.maxAccuracyMeters,
		)
	) {
		return false;
	}

	const recent = points.slice(-TRACK_POINT_QUALITY.calibrationFixes);
	for (let left = 0; left < recent.length; left += 1) {
		for (let right = left + 1; right < recent.length; right += 1) {
			if (
				segmentDistance(recent[left], recent[right]) >
				TRACK_POINT_QUALITY.calibrationSpreadMeters
			) {
				return false;
			}
		}
	}
	return true;
}

export function calibrationPoint(points: TrackObservation[]): TrackObservation {
	const recent = points.slice(-TRACK_POINT_QUALITY.calibrationFixes);
	const weights = recent.map((point) => 1 / Math.max(point.accuracy, 1));
	const weightTotal = weights.reduce((total, weight) => total + weight, 0);
	return {
		lat:
			recent.reduce(
				(total, point, index) => total + point.lat * weights[index],
				0,
			) / weightTotal,
		lng:
			recent.reduce(
				(total, point, index) => total + point.lng * weights[index],
				0,
			) / weightTotal,
		accuracy: Math.min(...recent.map((point) => point.accuracy)),
		altitude: recent.at(-1)?.altitude ?? null,
		timestamp: recent.at(-1)?.timestamp ?? Date.now(),
	};
}

export interface TrackPointValidationResult {
	accepted: SequencedTrackPoint[];
	rejected: number;
}

export function isTrackObservationEligible(
	value: unknown,
): value is TrackObservation {
	if (typeof value !== "object" || value === null) return false;
	const point = value as Partial<TrackObservation>;
	return (
		Number.isFinite(point.timestamp) &&
		point.timestamp! >= 0 &&
		Number.isFinite(point.lat) &&
		point.lat! >= -90 &&
		point.lat! <= 90 &&
		Number.isFinite(point.lng) &&
		point.lng! >= -180 &&
		point.lng! <= 180 &&
		Number.isFinite(point.accuracy) &&
		point.accuracy! >= 0 &&
		point.accuracy! <= TRACK_POINT_QUALITY.maxAccuracyMeters &&
		(point.altitude === null || Number.isFinite(point.altitude))
	);
}

function isLegalPoint(value: unknown): value is SequencedTrackPoint {
	if (!isTrackObservationEligible(value)) return false;
	const point = value as Partial<SequencedTrackPoint>;
	return (
		Number.isInteger(point.sequence) &&
		point.sequence! >= 0 &&
		Number.isInteger(point.segmentIndex) &&
		point.segmentIndex! >= 0
	);
}

export function isValidNextTrackPoint(
	previous: SequencedTrackPoint | null | undefined,
	point: SequencedTrackPoint,
): boolean {
	if (!isLegalPoint(point)) return false;
	if (!previous) return true;
	if (
		point.sequence <= previous.sequence ||
		point.timestamp <= previous.timestamp ||
		point.segmentIndex < previous.segmentIndex ||
		point.segmentIndex > previous.segmentIndex + 1
	) {
		return false;
	}
	if (point.segmentIndex !== previous.segmentIndex) return true;

	const distanceMeters = segmentDistance(previous, point);
	const elapsedSeconds = (point.timestamp - previous.timestamp) / 1000;
	const minimumReliableMovementMeters = Math.max(
		TRACK_POINT_QUALITY.minMovementMeters,
		(previous.accuracy + point.accuracy) * 0.5,
	);
	return (
		distanceMeters >= minimumReliableMovementMeters &&
		distanceMeters / elapsedSeconds <=
			TRACK_POINT_QUALITY.maxSpeedMetersPerSecond
	);
}

export function validateTrackPoints(
	existing: SequencedTrackPoint[],
	submitted: unknown[],
	options: { minimumSequenceExclusive?: number; maxSegmentIndex?: number } = {},
): TrackPointValidationResult {
	const accepted: SequencedTrackPoint[] = [];
	const existingSequences = new Set(existing.map((point) => point.sequence));
	let previous = existing.at(-1);
	let rejected = 0;

	const candidates = submitted
		.filter(isLegalPoint)
		.sort((left, right) => left.sequence - right.sequence);
	rejected += submitted.length - candidates.length;

	for (const point of candidates) {
		if (existingSequences.has(point.sequence)) continue;
		if (
			point.sequence < 0 ||
			point.sequence <= (options.minimumSequenceExclusive ?? -1) ||
			point.segmentIndex > (options.maxSegmentIndex ?? point.segmentIndex) ||
			(previous &&
				(point.sequence <= previous.sequence ||
					point.timestamp <= previous.timestamp))
		) {
			rejected++;
			continue;
		}

		if (!isValidNextTrackPoint(previous, point)) {
			rejected++;
			continue;
		}

		accepted.push(point);
		existingSequences.add(point.sequence);
		previous = point;
	}

	return { accepted, rejected };
}
