import { describe, expect, it } from "vitest";
import {
	calcDistance,
	calcPace,
	formatDuration,
	haversineDistance,
} from "@/lib/track-calc";

describe("track calculations", () => {
	it("calculates the known distance for one degree of longitude at the equator", () => {
		expect(haversineDistance(0, 0, 0, 1)).toBeCloseTo(111_195, 0);
	});

	it("calculates total track distance in kilometers", () => {
		const distance = calcDistance([
			{ lat: 0, lng: 0 },
			{ lat: 0, lng: 0.0001 },
			{ lat: 0, lng: 0.0002 },
		]);

		expect(distance).toBeCloseTo(0.02224, 4);
	});

	it("formats duration and pace from worked examples", () => {
		expect(formatDuration(3_661)).toBe("1:01:01");
		expect(calcPace(5, 1_500)).toBe("5'00\"");
		expect(calcPace(0, 1_500)).toBe("--");
	});
});
