import { describe, expect, it } from "vitest";
import type { SequencedTrackPoint } from "@/lib/run-contract";
import { calcDistance } from "@/lib/track-calc";
import {
	calibrationPoint,
	isStableCalibration,
	validateTrackPoints,
} from "@/lib/track-point-validation";

function point(
	sequence: number,
	lng: number,
	timestamp: number,
	overrides: Partial<SequencedTrackPoint> = {},
): SequencedTrackPoint {
	return {
		sequence,
		segmentIndex: 0,
		lat: 0,
		lng,
		timestamp,
		accuracy: 5,
		altitude: null,
		...overrides,
	};
}

describe("validateTrackPoints", () => {
	it("accepts the first legal point and orders a submitted batch by sequence", () => {
		const result = validateTrackPoints(
			[],
			[point(1, 0.0001, 2_500), point(0, 0, 1_000)],
		);

		expect(result.accepted.map(({ sequence }) => sequence)).toEqual([0, 1]);
		expect(result.rejected).toBe(0);
	});

	it("rejects illegal, inaccurate, stationary, regressing, and impossible points", () => {
		const existing = [point(0, 0, 1_000)];
		const result = validateTrackPoints(existing, [
			point(1, 0.0001, 2_000, { accuracy: 16 }),
			point(2, 181, 3_000),
			point(3, 0.00001, 4_000),
			point(4, 0.0002, 1_000),
			point(5, 0.001, 2_000),
		]);

		expect(result.accepted).toEqual([]);
		expect(result.rejected).toBe(5);
	});

	it("ignores an accepted sequence replay without duplicating it", () => {
		const existing = [point(0, 0, 1_000), point(1, 0.0001, 2_000)];
		const result = validateTrackPoints(existing, [
			point(1, 0.0001, 2_000),
			point(2, 0.0002, 3_500),
		]);

		expect(result.accepted.map(({ sequence }) => sequence)).toEqual([2]);
		expect(result.rejected).toBe(0);
	});

	it("rejects points ahead of the event-defined segment", () => {
		const result = validateTrackPoints(
			[],
			[point(2, 0, 2_000, { segmentIndex: 1 })],
			{
				minimumSequenceExclusive: 0,
				maxSegmentIndex: 0,
			},
		);
		expect(result).toEqual({ accepted: [], rejected: 1 });
	});

	it("rejects short stationary drift inside the reported accuracy radius", () => {
		const metersToDegrees = 1 / 111_194.9;
		const observations = [
			point(0, 0, 1_000, { accuracy: 25.3 }),
			point(1, 6.9 * metersToDegrees, 3_400, {
				lat: -18.2 * metersToDegrees,
				accuracy: 30,
			}),
			point(2, -2.7 * metersToDegrees, 7_000, {
				lat: 12.9 * metersToDegrees,
				accuracy: 25,
			}),
		];

		const result = validateTrackPoints([], observations);

		expect(result.accepted).toHaveLength(1);
		expect(calcDistance(result.accepted)).toBe(0);
	});

	it("requires three close fixes before selecting a calibration point", () => {
		const stable = [
			point(0, 0, 1_000, { accuracy: 12 }),
			point(1, 0.00002, 2_000, { accuracy: 10 }),
			point(2, 0.00001, 3_000, { accuracy: 11 }),
		];

		expect(isStableCalibration(stable)).toBe(true);
		expect(calibrationPoint(stable).accuracy).toBe(10);
		expect(
			isStableCalibration([
				...stable.slice(0, 2),
				point(2, 0.001, 3_000, { accuracy: 10 }),
			]),
		).toBe(false);
	});
});
