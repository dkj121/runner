import { describe, expect, it } from "vitest";
import type { RunEvent, SequencedTrackPoint } from "@/lib/run-contract";
import {
	calculateActiveDuration,
	groupTrackSegments,
	validateRunEvents,
} from "@/lib/run-timeline";

const events: RunEvent[] = [
	{ type: "START", sequence: 0, timestamp: 1_000 },
	{ type: "PAUSE", sequence: 3, timestamp: 4_000 },
	{ type: "RESUME", sequence: 4, timestamp: 10_000 },
	{ type: "STOP", sequence: 7, timestamp: 12_000 },
];

describe("Run timeline", () => {
	it("sums only event-defined active intervals", () => {
		expect(calculateActiveDuration(events)).toBe(5);
	});

	it("rejects conflicting event order without accepting a partial batch", () => {
		const result = validateRunEvents(
			[events[0]],
			[
				{ type: "RESUME", sequence: 1, timestamp: 2_000 },
				{ type: "PAUSE", sequence: 2, timestamp: 3_000 },
			],
		);
		expect(result).toEqual({ accepted: [], rejected: 1 });
	});

	it("groups points into ordered pause-safe segments", () => {
		const points = [
			{ sequence: 5, segmentIndex: 1 },
			{ sequence: 2, segmentIndex: 0 },
			{ sequence: 1, segmentIndex: 0 },
		] as SequencedTrackPoint[];
		expect(
			groupTrackSegments(points).map((segment) =>
				segment.map(({ sequence }) => sequence),
			),
		).toEqual([[1, 2], [5]]);
	});
});
