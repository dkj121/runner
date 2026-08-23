import type { RunEvent, SequencedTrackPoint } from "@/lib/run-contract";
import { segmentDistance } from "@/lib/track-calc";
import {
	calculateActiveDuration,
	groupTrackSegments,
} from "@/lib/run-timeline";

export interface ConfirmedRunResult {
	distanceMeters: number;
	durationSeconds: number;
	paceSecondsPerKm: number | null;
	calories: number;
	trackSegments: SequencedTrackPoint[][];
	splits: { km: number; durationSeconds: number; paceSecondsPerKm: number }[];
}

export function calculateConfirmedRunResult(
	points: SequencedTrackPoint[],
	events: RunEvent[],
): ConfirmedRunResult {
	const trackSegments = groupTrackSegments(points);
	let distanceMeters = 0;
	let movementSeconds = 0;
	let nextSplitMeters = 1_000;
	let previousSplitSeconds = 0;
	const splits: ConfirmedRunResult["splits"] = [];

	for (const segment of trackSegments) {
		for (let index = 1; index < segment.length; index++) {
			const previous = segment[index - 1];
			const current = segment[index];
			distanceMeters += segmentDistance(previous, current);
			movementSeconds += (current.timestamp - previous.timestamp) / 1000;
			while (distanceMeters >= nextSplitMeters) {
				const splitDuration = Math.max(
					1,
					Math.round(movementSeconds - previousSplitSeconds),
				);
				splits.push({
					km: nextSplitMeters / 1_000,
					durationSeconds: splitDuration,
					paceSecondsPerKm: splitDuration,
				});
				previousSplitSeconds = movementSeconds;
				nextSplitMeters += 1_000;
			}
		}
	}

	const durationSeconds = calculateActiveDuration(events);
	const roundedDistance = Math.round(distanceMeters * 100) / 100;
	const paceSecondsPerKm =
		roundedDistance > 0
			? Math.round(durationSeconds / (roundedDistance / 1_000))
			: null;
	return {
		distanceMeters: roundedDistance,
		durationSeconds,
		paceSecondsPerKm,
		calories: Math.round((roundedDistance / 1_000) * 70),
		trackSegments,
		splits,
	};
}

export function distanceCorrectionPercent(
	previewDistanceMeters: number,
	confirmedDistanceMeters: number,
): number {
	if (previewDistanceMeters <= 0) return 0;
	return (
		Math.round(
			(Math.abs(confirmedDistanceMeters - previewDistanceMeters) /
				previewDistanceMeters) *
				10_000,
		) / 100
	);
}
