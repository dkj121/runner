import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useRunTracker from "@/hooks/use-run-tracker";

type Density = "high" | "medium" | "low";

describe("useRunTracker sampling density", () => {
	let positionListener: PositionCallback | undefined;
	let originalGeolocation: PropertyDescriptor | undefined;

	beforeEach(() => {
		vi.useFakeTimers();
		positionListener = undefined;
		originalGeolocation = Object.getOwnPropertyDescriptor(
			navigator,
			"geolocation",
		);
		Object.defineProperty(navigator, "geolocation", {
			configurable: true,
			value: {
				watchPosition: vi.fn((success: PositionCallback) => {
					positionListener = success;
					return 1;
				}),
				clearWatch: vi.fn(),
			},
		});
		vi.stubGlobal(
			"fetch",
			vi
				.fn<typeof fetch>()
				.mockResolvedValue(
					new Response(JSON.stringify({ runId: "run-1" }), { status: 200 }),
				),
		);
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.unstubAllGlobals();
		vi.useRealTimers();
		if (originalGeolocation) {
			Object.defineProperty(navigator, "geolocation", originalGeolocation);
		} else {
			Reflect.deleteProperty(navigator, "geolocation");
		}
	});

	it.each([
		{ initial: "low", selected: "high", interval: 1_000 },
		{ initial: "high", selected: "medium", interval: 5_000 },
		{ initial: "high", selected: "low", interval: 10_000 },
	] as const)(
		"uses the $selected density selected before the run starts",
		async ({ initial, selected, interval }) => {
			const { result, rerender } = renderHook(
				({ density }: { density: Density }) =>
					useRunTracker("user-1", { samplingDensity: density }),
				{ initialProps: { density: initial } as { density: Density } },
			);

			rerender({ density: selected });
			await act(async () => {
				await result.current.start();
			});

			act(() => {
				positionListener?.(positionAt(32.041, 118.784, 1_000));
			});
			await act(async () => {
				await vi.advanceTimersByTimeAsync(interval - 1);
				positionListener?.(positionAt(32.042, 118.785, 2_000));
			});
			expect(result.current.track).toHaveLength(1);

			await act(async () => {
				await vi.advanceTimersByTimeAsync(1);
				positionListener?.(positionAt(32.043, 118.786, 6_000));
			});
			expect(result.current.track).toHaveLength(2);
		},
	);
});

function positionAt(lat: number, lng: number, timestamp: number) {
	return {
		coords: {
			accuracy: 5,
			altitude: null,
			altitudeAccuracy: null,
			heading: null,
			latitude: lat,
			longitude: lng,
			speed: null,
			toJSON: () => ({}),
		},
		timestamp,
		toJSON: () => ({}),
	} satisfies GeolocationPosition;
}
