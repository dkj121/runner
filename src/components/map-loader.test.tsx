import React from "react";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RunMap from "@/components/map-loader";

const sdkHarness = vi.hoisted(() => ({
	resolve: undefined as ((sdk: unknown) => void) | undefined,
}));

vi.mock("@/lib/amap-sdk", () => ({
	loadAMapSDK: () =>
		new Promise((resolve) => {
			sdkHarness.resolve = resolve;
		}),
}));

describe("RunMap", () => {
	beforeEach(() => {
		document.documentElement.style.setProperty("--run-track-map", "#22c55e");
		document.documentElement.style.setProperty("--run-position-map", "#3b82f6");
		document.documentElement.style.setProperty("--run-accuracy-map", "#60a5fa");
	});

	it("draws a restored track that arrives before the SDK is ready", async () => {
		const harness = createSdkHarness();
		const { rerender } = render(<RunMap track={[]} />);
		rerender(
			<RunMap
				finished
				track={[
					{ lat: 32.041, lng: 118.784, segmentIndex: 0 },
					{ lat: 32.0412, lng: 118.7842, segmentIndex: 0 },
				]}
			/>,
		);
		await act(async () => sdkHarness.resolve?.(harness.sdk));

		await waitFor(() => expect(harness.sdk.Polyline).toHaveBeenCalled());
		expect(harness.sdk.Map).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ zoom: 18 }),
		);
		expect(harness.sdk.Polyline).toHaveBeenCalledWith(
			expect.objectContaining({ strokeColor: "#22c55e" }),
		);
		expect(harness.map.setFitView).toHaveBeenCalled();
	});

	it("uses a compact height while recording on short mobile screens", () => {
		const { container } = render(<RunMap track={[]} compact />);

		expect(container.firstElementChild?.className).toContain(
			"h-[clamp(11rem,30dvh,15rem)]",
		);
		expect(container.firstElementChild?.className).toContain("min-h-0");
	});

	it("moves the position marker and accuracy circle without accepting a route point", async () => {
		const harness = createSdkHarness();
		const { rerender } = render(<RunMap track={[]} currentPosition={null} />);
		await act(async () => sdkHarness.resolve?.(harness.sdk));

		rerender(
			<RunMap
				track={[]}
				currentPosition={{
					lat: 32.041,
					lng: 118.784,
					timestamp: 1_000,
					accuracy: 80,
					altitude: null,
				}}
			/>,
		);

		await waitFor(() =>
			expect(harness.positionMarker.setPosition).toHaveBeenCalled(),
		);
		expect(harness.accuracyCircle.setRadius).toHaveBeenCalledWith(80);
		expect(harness.sdk.Polyline).not.toHaveBeenCalled();
	});

	it("stops following after a gesture and resumes on demand", async () => {
		const harness = createSdkHarness();
		render(
			<RunMap
				currentPosition={{
					lat: 32.041,
					lng: 118.784,
					timestamp: 1_000,
					accuracy: 5,
					altitude: null,
				}}
			/>,
		);
		await act(async () => sdkHarness.resolve?.(harness.sdk));
		act(() => harness.mapEvents.get("dragstart")?.());

		fireEvent.click(screen.getByRole("button", { name: "回到当前位置" }));
		expect(harness.map.setCenter).toHaveBeenCalled();
	});
});

function createSdkHarness() {
	const mapEvents = new Map<string, () => void>();
	const map = {
		add: vi.fn(),
		destroy: vi.fn(),
		setCenter: vi.fn(),
		setFitView: vi.fn(),
		on: vi.fn((event: string, listener: () => void) => {
			mapEvents.set(event, listener);
		}),
	};
	const positionMarker = {
		setPosition: vi.fn(),
		hide: vi.fn(),
		show: vi.fn(),
	};
	const accuracyCircle = {
		setCenter: vi.fn(),
		setRadius: vi.fn(),
		hide: vi.fn(),
		show: vi.fn(),
	};
	const sdk = {
		Map: vi.fn(function () {
			return map;
		}),
		Polyline: vi.fn(function () {
			return { setPath: vi.fn() };
		}),
		Marker: vi.fn(function () {
			return positionMarker;
		}),
		Circle: vi.fn(function () {
			return accuracyCircle;
		}),
	};
	return { sdk, map, mapEvents, positionMarker, accuracyCircle };
}
