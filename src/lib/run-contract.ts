export const RUN_EVENT_TYPES = ["START", "PAUSE", "RESUME", "STOP"] as const;

export type RunEventType = (typeof RUN_EVENT_TYPES)[number];

export interface SequencedRunItem {
	sequence: number;
	timestamp: number;
}

export interface RunEvent extends SequencedRunItem {
	type: RunEventType;
}

export interface TrackObservation {
	lat: number;
	lng: number;
	accuracy: number;
	altitude: number | null;
	timestamp: number;
}

export interface SequencedTrackPoint
	extends SequencedRunItem, TrackObservation {
	segmentIndex: number;
}

export type RunTimelineItem = RunEvent | SequencedTrackPoint;
