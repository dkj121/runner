import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RunPage from "@/app/(dashboard)/run/page";

const trackerHarness = vi.hoisted(() => ({ status: "running" }));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
	useSession: () => ({ data: { user: { id: "user-1" } } }),
}));

vi.mock("@/components/map-loader", () => ({
	default: ({ compact }: { compact?: boolean }) => (
		<div data-testid="run-map" data-compact={compact ? "true" : "false"} />
	),
}));

vi.mock("@/hooks/use-run-tracker", () => ({
	default: () => ({
		status: trackerHarness.status,
		track: [],
		gpsState: { error: null, accuracy: 5, currentPosition: null },
		durationFormatted: "00:10",
		distanceKilometersFormatted: "0.01",
		paceFormatted: "10:00",
		currentPaceFormatted: "--",
		calories: 1,
		pause: vi.fn(),
		resume: vi.fn(),
		stop: vi.fn(),
		retryGps: vi.fn(),
		start: vi.fn(),
		startAnyway: vi.fn(),
		isStarting: false,
		startError: null,
	}),
}));

describe("RunPage controls lock", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		sessionStorage.clear();
		trackerHarness.status = "running";
	});

	it("removes manual GPS sampling choices from the start screen", () => {
		trackerHarness.status = "idle";
		render(<RunPage />);

		expect(screen.queryByText("采样密度")).toBeNull();
		expect(screen.getByRole("button", { name: "开始跑步" })).toBeTruthy();
		expect(screen.getByText(/自动获取高精度定位/)).toBeTruthy();
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("covers global navigation and requires a long press to unlock", () => {
		render(<RunPage />);
		fireEvent.click(screen.getByRole("button", { name: "锁定跑步控制" }));

		const overlay = screen.getByTestId("run-lock-overlay");
		expect(overlay.className).toContain("fixed");
		expect(overlay.className).toContain("inset-0");
		expect(overlay.className).toContain("z-[60]");

		const unlockButton = screen.getByRole("button", {
			name: "解除跑步控制锁定",
		});
		expect(unlockButton.className).toContain("h-18");
		fireEvent.pointerDown(unlockButton);
		fireEvent.pointerUp(unlockButton);
		expect(screen.getByTestId("run-lock-overlay")).toBeTruthy();

		fireEvent.pointerDown(unlockButton);
		act(() => vi.advanceTimersByTime(1_500));
		expect(screen.queryByTestId("run-lock-overlay")).toBeNull();
	});

	it("uses the compact map layout while recording", () => {
		const { container } = render(<RunPage />);

		expect(
			container
				.querySelector('[data-testid="run-map"]')
				?.getAttribute("data-compact"),
		).toBe("true");
	});
});
