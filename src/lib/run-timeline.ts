import type { RunEvent, RunEventType } from "@/lib/run-contract";

const ALLOWED_NEXT_EVENT: Record<RunEventType, RunEventType[]> = {
	START: ["PAUSE", "STOP"],
	PAUSE: ["RESUME", "STOP"],
	RESUME: ["PAUSE", "STOP"],
	STOP: [],
};

function isRunEvent(value: unknown): value is RunEvent {
	if (typeof value !== "object" || value === null) return false;
	const event = value as Partial<RunEvent>;
	return (
		Number.isInteger(event.sequence) &&
		event.sequence! >= 0 &&
		Number.isFinite(event.timestamp) &&
		event.timestamp! >= 0 &&
		typeof event.type === "string" &&
		["START", "PAUSE", "RESUME", "STOP"].includes(event.type)
	);
}

export function validateRunEvents(
	existing: RunEvent[],
	submitted: unknown[],
	minimumSequenceExclusive = existing.at(-1)?.sequence ?? -1,
): { accepted: RunEvent[]; rejected: number } {
	const existingSequences = new Set(existing.map((event) => event.sequence));
	const candidates = submitted
		.filter(isRunEvent)
		.sort((left, right) => left.sequence - right.sequence);
	let rejected = submitted.length - candidates.length;
	let previous = existing.at(-1);
	const accepted: RunEvent[] = [];

	for (const event of candidates) {
		if (existingSequences.has(event.sequence)) continue;
		const validType = previous
			? ALLOWED_NEXT_EVENT[previous.type].includes(event.type)
			: event.type === "START";
		if (
			!validType ||
			event.sequence <= minimumSequenceExclusive ||
			(previous &&
				(event.sequence <= previous.sequence ||
					event.timestamp <= previous.timestamp))
		) {
			rejected++;
			continue;
		}
		accepted.push(event);
		existingSequences.add(event.sequence);
		previous = event;
	}

	if (rejected > 0) return { accepted: [], rejected };
	return { accepted, rejected: 0 };
}

export function calculateActiveDuration(
	events: RunEvent[],
	now = Date.now(),
): number {
	let activeStartedAt: number | null = null;
	let durationMilliseconds = 0;
	for (const event of events) {
		if (event.type === "START" || event.type === "RESUME") {
			activeStartedAt = event.timestamp;
		} else if (activeStartedAt !== null) {
			durationMilliseconds += event.timestamp - activeStartedAt;
			activeStartedAt = null;
		}
	}
	if (activeStartedAt !== null) durationMilliseconds += now - activeStartedAt;
	return Math.floor(durationMilliseconds / 1000);
}

export function groupTrackSegments<
	TrackPoint extends { segmentIndex?: number; sequence?: number },
>(points: TrackPoint[]): TrackPoint[][] {
	const segments = new Map<number, TrackPoint[]>();
	for (const point of points) {
		const segmentIndex = point.segmentIndex ?? 0;
		const segment = segments.get(segmentIndex) ?? [];
		segment.push(point);
		segments.set(segmentIndex, segment);
	}
	return [...segments.entries()]
		.sort(([left], [right]) => left - right)
		.map(([, segment]) =>
			segment.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
		);
}
