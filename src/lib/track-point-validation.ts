import type { SequencedTrackPoint } from "@/lib/run-contract";
import { segmentDistance } from "@/lib/track-calc";

const MAX_ACCURACY_METERS = 50;
const MIN_MOVEMENT_METERS = 5;
const MAX_SPEED_METERS_PER_SECOND = 12;

export interface TrackPointValidationResult {
	accepted: SequencedTrackPoint[];
	rejected: number;
}

function isLegalPoint(value: unknown): value is SequencedTrackPoint {
	if (typeof value !== "object" || value === null) return false;
	const point = value as Partial<SequencedTrackPoint>;
	return (
		Number.isInteger(point.sequence) &&
		Number.isInteger(point.segmentIndex) &&
		point.segmentIndex! >= 0 &&
		Number.isFinite(point.timestamp) &&
		Number.isFinite(point.lat) &&
		point.lat! >= -90 &&
		point.lat! <= 90 &&
		Number.isFinite(point.lng) &&
		point.lng! >= -180 &&
		point.lng! <= 180 &&
		Number.isFinite(point.accuracy) &&
		point.accuracy! >= 0 &&
		point.accuracy! <= MAX_ACCURACY_METERS &&
		(point.altitude === null || Number.isFinite(point.altitude))
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

		if (previous) {
			if (
				point.segmentIndex < previous.segmentIndex ||
				point.segmentIndex > previous.segmentIndex + 1
			) {
				rejected++;
				continue;
			}
			if (point.segmentIndex !== previous.segmentIndex) {
				accepted.push(point);
				existingSequences.add(point.sequence);
				previous = point;
				continue;
			}
			const distanceMeters = segmentDistance(previous, point);
			const elapsedSeconds = (point.timestamp - previous.timestamp) / 1000;
			if (
				distanceMeters < MIN_MOVEMENT_METERS ||
				distanceMeters / elapsedSeconds > MAX_SPEED_METERS_PER_SECOND
			) {
				rejected++;
				continue;
			}
		}

		accepted.push(point);
		existingSequences.add(point.sequence);
		previous = point;
	}

	return { accepted, rejected };
}
