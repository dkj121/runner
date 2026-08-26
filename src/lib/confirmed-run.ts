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
	splits: {
		km: number;
		distanceMeters: number;
		durationSeconds: number;
		paceSecondsPerKm: number;
		isPartial: boolean;
	}[];
}

const MIN_PARTIAL_SPLIT_METERS = 100;

export function calculateConfirmedRunResult(
	points: SequencedTrackPoint[],
	events: RunEvent[],
): ConfirmedRunResult {
	const trackSegments = groupTrackSegments(points);
	let distanceMeters = 0;
	let movementSeconds = 0;
	let nextSplitMeters = 1_000;
	let splitStartSeconds = 0;
	let splitStartMeters = 0;
	const splits: ConfirmedRunResult["splits"] = [];

	for (const segment of trackSegments) {
		for (let index = 1; index < segment.length; index++) {
			const previous = segment[index - 1];
			const current = segment[index];
			const segmentMeters = segmentDistance(previous, current);
			const segmentSeconds = Math.max(
				0,
				(current.timestamp - previous.timestamp) / 1_000,
			);
			const segmentStartMeters = distanceMeters;
			const segmentStartSeconds = movementSeconds;
			while (
				segmentMeters > 0 &&
				segmentStartMeters + segmentMeters >= nextSplitMeters
			) {
				const boundaryProgress =
					(nextSplitMeters - segmentStartMeters) / segmentMeters;
				const boundarySeconds =
					segmentStartSeconds + segmentSeconds * boundaryProgress;
				const splitDuration = Math.max(
					1,
					Math.round(boundarySeconds - splitStartSeconds),
				);
				splits.push({
					km: nextSplitMeters / 1_000,
					distanceMeters: 1_000,
					durationSeconds: splitDuration,
					paceSecondsPerKm: splitDuration,
					isPartial: false,
				});
				splitStartSeconds = boundarySeconds;
				splitStartMeters = nextSplitMeters;
				nextSplitMeters += 1_000;
			}
			distanceMeters += segmentMeters;
			movementSeconds += segmentSeconds;
		}
	}

	const partialDistanceMeters = distanceMeters - splitStartMeters;
	if (partialDistanceMeters >= MIN_PARTIAL_SPLIT_METERS) {
		const partialDurationSeconds = Math.max(
			1,
			Math.round(movementSeconds - splitStartSeconds),
		);
		splits.push({
			km: Math.floor(splitStartMeters / 1_000) + 1,
			distanceMeters: Math.round(partialDistanceMeters * 100) / 100,
			durationSeconds: partialDurationSeconds,
			paceSecondsPerKm: Math.round(
				partialDurationSeconds / (partialDistanceMeters / 1_000),
			),
			isPartial: true,
		});
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
