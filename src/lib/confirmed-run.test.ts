import { describe, expect, it } from "vitest";
import {
	calculateConfirmedRunResult,
	distanceCorrectionPercent,
} from "@/lib/confirmed-run";

describe("Confirmed Run Result", () => {
	it("derives canonical measurements from server events and segments", () => {
		const result = calculateConfirmedRunResult(
			[
				{
					sequence: 1,
					segmentIndex: 0,
					lat: 0,
					lng: 0,
					timestamp: 1_000,
					accuracy: 5,
					altitude: null,
				},
				{
					sequence: 2,
					segmentIndex: 0,
					lat: 0,
					lng: 0.009,
					timestamp: 601_000,
					accuracy: 5,
					altitude: null,
				},
			],
			[
				{ type: "START", sequence: 0, timestamp: 1_000 },
				{ type: "STOP", sequence: 3, timestamp: 601_000 },
			],
		);
		expect(result.distanceMeters).toBeCloseTo(1_000.75, 0);
		expect(result.durationSeconds).toBe(600);
		expect(result.paceSecondsPerKm).toBe(600);
		expect(result.calories).toBe(70);
		expect(result.splits).toHaveLength(1);
	});

	it("reports material preview correction as a percentage", () => {
		expect(distanceCorrectionPercent(1_000, 1_100)).toBe(10);
	});

	it("interpolates kilometer boundaries and includes the final partial split", () => {
		const result = calculateConfirmedRunResult(
			[
				{
					sequence: 1,
					segmentIndex: 0,
					lat: 0,
					lng: 0,
					timestamp: 1_000,
					accuracy: 5,
					altitude: null,
				},
				{
					sequence: 2,
					segmentIndex: 0,
					lat: 0,
					lng: 0.01349,
					timestamp: 901_000,
					accuracy: 5,
					altitude: null,
				},
			],
			[
				{ type: "START", sequence: 0, timestamp: 1_000 },
				{ type: "STOP", sequence: 3, timestamp: 901_000 },
			],
		);

		expect(result.splits).toHaveLength(2);
		expect(result.splits[0]).toMatchObject({
			km: 1,
			distanceMeters: 1_000,
			isPartial: false,
		});
		expect(result.splits[0].durationSeconds).toBeCloseTo(600, -1);
		expect(result.splits[1]).toMatchObject({ km: 2, isPartial: true });
		expect(result.splits[1].distanceMeters).toBeGreaterThan(490);
		expect(result.splits[1].paceSecondsPerKm).toBeCloseTo(600, -1);
	});
});
