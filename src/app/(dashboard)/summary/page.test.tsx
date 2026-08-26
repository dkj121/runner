import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SummaryPage from "@/app/(dashboard)/summary/page";

const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
	useRouter: () => routerMock,
	useSearchParams: () => new URLSearchParams("runId=run-1"),
}));
vi.mock("@/lib/auth-client", () => ({
	useSession: () => ({ data: { user: { id: "user-1" } } }),
}));
vi.mock("@/components/map-loader", () => ({
	default: ({ compact }: { compact?: boolean }) => (
		<div data-compact={compact ? "true" : "false"}>分段轨迹地图</div>
	),
}));

describe("Completed Run summary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("confirm", vi.fn());
		vi.stubGlobal(
			"fetch",
			vi.fn<typeof fetch>().mockResolvedValue(
				new Response(
					JSON.stringify({
						distanceMeters: 5_230,
						durationSeconds: 1_861,
						paceSecondsPerKm: 356,
						previewDistanceMeters: 5_000,
						calories: 366,
						startTime: "2026-08-23T10:00:00.000Z",
						endTime: "2026-08-23T10:31:01.000Z",
						splits: [
							{ km: 1, durationSeconds: 356, paceSecondsPerKm: 356 },
							{
								km: 2,
								distanceMeters: 230,
								durationSeconds: 90,
								paceSecondsPerKm: 391,
								isPartial: true,
							},
						],
						trackPoints: {
							segments: [
								[
									{ lat: 32.041, lng: 118.784, segmentIndex: 0 },
									{ lat: 32.042, lng: 118.785, segmentIndex: 0 },
								],
							],
						},
					}),
					{ status: 200 },
				),
			),
		);
	});

	it("renders canonical measurements and confirms permanent deletion", async () => {
		const fetchMock = vi.mocked(fetch);
		render(<SummaryPage />);

		expect(await screen.findByText("5.23")).toBeTruthy();
		expect(screen.getAllByText("5'56\"")).toHaveLength(3);
		expect(screen.getByText("配速分析")).toBeTruthy();
		expect(screen.getByText("分段详情")).toBeTruthy();
		expect(screen.getByText("最后")).toBeTruthy();
		expect(screen.getByText("0.23 km")).toBeTruthy();
		const map = await screen.findByText("分段轨迹地图");
		expect(map.getAttribute("data-compact")).toBe("true");
		expect(
			screen.getByText("分段详情").compareDocumentPosition(map) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();

		vi.mocked(confirm).mockReturnValueOnce(false);
		fireEvent.click(screen.getByRole("button", { name: "删除本次跑步" }));
		expect(fetchMock).toHaveBeenCalledTimes(1);

		vi.mocked(confirm).mockReturnValueOnce(true);
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ deleted: true }), { status: 200 }),
		);
		fireEvent.click(screen.getByRole("button", { name: "删除本次跑步" }));

		await waitFor(() =>
			expect(routerMock.replace).toHaveBeenCalledWith("/run"),
		);
		expect(fetchMock).toHaveBeenLastCalledWith("/api/runs/run-1", {
			method: "DELETE",
		});
	});
});
