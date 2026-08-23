export const RUN_EVENT_TYPES = ["START", "PAUSE", "RESUME", "STOP"] as const;

export type RunEventType = (typeof RUN_EVENT_TYPES)[number];

export interface SequencedRunItem {
	sequence: number;
	timestamp: number;
}

export interface RunEvent extends SequencedRunItem {
	type: RunEventType;
}

export interface SequencedTrackPoint extends SequencedRunItem {
	segmentIndex: number;
	lat: number;
	lng: number;
	accuracy: number;
	altitude: number | null;
}

export type RunTimelineItem = RunEvent | SequencedTrackPoint;

export interface LegacyRunMeasurements {
	duration: number;
	distance: number;
}

export interface CanonicalRunMeasurements {
	durationSeconds: number;
	distanceMeters: number;
}

export function canonicalizeLegacyRunMeasurements({
	duration,
	distance,
}: LegacyRunMeasurements): CanonicalRunMeasurements {
	return {
		durationSeconds: duration,
		distanceMeters: Math.round(distance * 1000),
	};
}
