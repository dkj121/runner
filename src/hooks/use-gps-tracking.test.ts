import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useGpsTracking from "@/hooks/use-gps-tracking";

describe("useGpsTracking", () => {
	let positionListener: PositionCallback | undefined;
	let positionErrorListener: PositionErrorCallback | undefined;
	let originalGeolocation: PropertyDescriptor | undefined;
	let originalSecureContext: PropertyDescriptor | undefined;
	const watchPosition = vi.fn(
		(success: PositionCallback, error: PositionErrorCallback) => {
			positionListener = success;
			positionErrorListener = error;
			return 1;
		},
	);
	const clearWatch = vi.fn();

	beforeEach(() => {
		positionListener = undefined;
		positionErrorListener = undefined;
		watchPosition.mockClear();
		clearWatch.mockClear();
		originalGeolocation = Object.getOwnPropertyDescriptor(
			navigator,
			"geolocation",
		);
		originalSecureContext = Object.getOwnPropertyDescriptor(
			window,
			"isSecureContext",
		);
		Object.defineProperty(window, "isSecureContext", {
			configurable: true,
			value: true,
		});
		Object.defineProperty(navigator, "geolocation", {
			configurable: true,
			value: { watchPosition, clearWatch },
		});
	});

	afterEach(() => {
		if (originalGeolocation) {
			Object.defineProperty(navigator, "geolocation", originalGeolocation);
		} else {
			Reflect.deleteProperty(navigator, "geolocation");
		}
		if (originalSecureContext) {
			Object.defineProperty(window, "isSecureContext", originalSecureContext);
		} else {
			Reflect.deleteProperty(window, "isSecureContext");
		}
	});

	it("explains that Chrome requires HTTPS before requesting location", () => {
		Object.defineProperty(window, "isSecureContext", {
			configurable: true,
			value: false,
		});
		const { result } = renderHook(() => useGpsTracking({ onPoint: vi.fn() }));

		act(() => result.current.startTracking());

		expect(watchPosition).not.toHaveBeenCalled();
		expect(result.current.state.error).toContain("HTTPS");
	});

	it("always requests fresh high-accuracy positions", () => {
		const { result } = renderHook(() => useGpsTracking({ onPoint: vi.fn() }));
		act(() => result.current.startTracking());

		expect(watchPosition).toHaveBeenCalledWith(
			expect.any(Function),
			expect.any(Function),
			{ enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
		);
	});

	it("exposes every raw fix while leaving quality filtering to the tracker", () => {
		const onPoint = vi.fn();
		const { result } = renderHook(() => useGpsTracking({ onPoint }));
		act(() => result.current.startTracking());

		act(() => {
			positionListener?.(positionAt(32.041, 118.784, 1_000, 80));
			positionListener?.(positionAt(32.0411, 118.7841, 1_100, 5));
		});

		expect(onPoint).toHaveBeenCalledTimes(2);
		expect(result.current.state.currentPosition).toMatchObject({
			lat: 32.0411,
			lng: 118.7841,
			accuracy: 5,
		});
	});

	it("surfaces geolocation permission denial for retry", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { result } = renderHook(() => useGpsTracking({ onPoint: vi.fn() }));
		act(() => result.current.startTracking());
		act(() => {
			positionErrorListener?.({
				code: 1,
				message: "permission denied",
				PERMISSION_DENIED: 1,
				POSITION_UNAVAILABLE: 2,
				TIMEOUT: 3,
			});
		});

		expect(result.current.state.error).toBe(
			"定位权限被拒绝，请在系统设置中允许定位",
		);
		expect(warn).toHaveBeenCalledWith("[GPS]", {
			code: 1,
			message: "permission denied",
		});
		warn.mockRestore();
	});
});

function positionAt(
	lat: number,
	lng: number,
	timestamp: number,
	accuracy: number,
) {
	return {
		coords: {
			accuracy,
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
