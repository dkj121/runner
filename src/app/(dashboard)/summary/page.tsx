"use client";

import React, { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MapIcon, Trash2 } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";
import { formatDuration, formatPaceSeconds } from "@/lib/track-calc";

const RunMap = lazy(() => import("@/components/map-loader"));

interface SplitRow {
	km: number;
	distanceMeters: number;
	paceSecondsPerKm: number;
	durationSeconds: number;
	isPartial: boolean;
	barHeight: number;
}

interface RunData {
	id: string;
	distanceMeters: number;
	durationSeconds: number;
	paceSecondsPerKm: number | null;
	calories: number;
	startTime: string;
	endTime: string;
	splits: SplitRow[] | null;
	trackPoints?: { lat: number; lng: number; segmentIndex?: number }[];
	correctionPercent?: number;
}

function formatDate(iso: string) {
	const d = new Date(iso);
	const y = d.getFullYear();
	const m = d.getMonth() + 1;
	const day = d.getDate();
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${y}年${m}月${day}日 ${hh}:${mm}`;
}

function formatRunPeriod(startIso: string, endIso: string) {
	const start = new Date(startIso);
	const end = new Date(endIso);
	if (start.toDateString() !== end.toDateString()) {
		return `${formatDate(startIso)} — ${formatDate(endIso)}`;
	}
	const endTime = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
	return `${formatDate(startIso)} — ${endTime}`;
}

export default function SummaryPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { data: session } = useSession();
	const userId = session?.user?.id;
	const runId = searchParams.get("runId");

	const [data, setData] = useState<RunData | null>(null);
	const [loading, setLoading] = useState(true);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	useEffect(() => {
		if (!runId) {
			// No runId — fetch latest
			fetch(`/api/runs?userId=${userId}&take=1`)
				.then((r) => r.json())
				.then((res) => {
					if (res.records?.length > 0) {
						loadRun(res.records[0].id);
					} else {
						setLoading(false);
					}
				})
				.catch(() => setLoading(false));
		} else {
			loadRun(runId);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [runId]);

	const loadRun = async (id: string) => {
		try {
			const res = await fetch(`/api/runs/${id}`);
			const record = await res.json();
			const rawSplits = record.splits as
				| {
						km: number;
						distanceMeters?: number;
						paceSecondsPerKm: number;
						durationSeconds: number;
						isPartial?: boolean;
				  }[]
				| null;
			const fastestSplitPace = rawSplits?.length
				? Math.min(...rawSplits.map((split) => split.paceSecondsPerKm))
				: null;
			const slowestSplitPace = rawSplits?.length
				? Math.max(...rawSplits.map((split) => split.paceSecondsPerKm))
				: null;
			const splits: SplitRow[] | null =
				rawSplits && fastestSplitPace && slowestSplitPace
					? rawSplits.map((split) => ({
							km: split.km,
							distanceMeters: split.distanceMeters ?? 1_000,
							paceSecondsPerKm: split.paceSecondsPerKm,
							durationSeconds: split.durationSeconds,
							isPartial: split.isPartial ?? false,
							barHeight:
								fastestSplitPace === slowestSplitPace
									? 64
									: Math.round(
											48 +
												((slowestSplitPace - split.paceSecondsPerKm) /
													(slowestSplitPace - fastestSplitPace)) *
													32,
										),
						}))
					: null;

			const storedTrack = record.trackPoints as
				| {
						lat: number;
						lng: number;
						timestamp: number;
						segmentIndex?: number;
				  }[]
				| { segments: { lat: number; lng: number; segmentIndex?: number }[][] }
				| null;
			const rawTrack = Array.isArray(storedTrack)
				? storedTrack
				: (storedTrack?.segments.flat() ?? null);
			const correctionPercent =
				record.previewDistanceMeters > 0
					? (Math.abs(record.distanceMeters - record.previewDistanceMeters) /
							record.previewDistanceMeters) *
						100
					: 0;

			setData({
				id: typeof record.id === "string" ? record.id : id,
				distanceMeters: record.distanceMeters,
				durationSeconds: record.durationSeconds,
				paceSecondsPerKm: record.paceSecondsPerKm,
				calories: record.calories || 0,
				startTime: record.startTime,
				endTime: record.endTime,
				splits,
				trackPoints: rawTrack?.map((p) => ({
					lat: p.lat,
					lng: p.lng,
					segmentIndex: p.segmentIndex,
				})),
				correctionPercent,
			});
		} catch (e) {
			console.error("加载跑步记录失败", e);
		}
		setLoading(false);
	};

	const deleteRun = async () => {
		if (!data || !window.confirm("确认永久删除这次跑步及其轨迹数据吗？")) {
			return;
		}
		setDeleting(true);
		setDeleteError(null);
		try {
			const response = await fetch(`/api/runs/${data.id}`, {
				method: "DELETE",
			});
			if (!response.ok) throw new Error("删除失败，请稍后重试");
			router.replace("/run");
		} catch (error) {
			setDeleteError(error instanceof Error ? error.message : "删除失败");
			setDeleting(false);
		}
	};

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!data) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center">
				<p className="text-muted-foreground">暂无跑步记录</p>
				<Link
					href="/run"
					className="rounded-lg bg-primary px-4 py-2 text-sm text-white"
				>
					去跑步
				</Link>
			</div>
		);
	}
	const trackSection =
		data.trackPoints && data.trackPoints.length >= 2 ? (
			<section className="space-y-2">
				<h2 className="font-heading text-[15px] font-semibold text-foreground">
					运动轨迹
				</h2>
				<div className="overflow-hidden rounded-xl border border-border">
					<Suspense
						fallback={
							<div className="flex h-52 items-center justify-center gap-2 bg-card text-sm text-muted-foreground">
								<Loader2 className="size-4 animate-spin" />
								加载地图...
							</div>
						}
					>
						<RunMap compact track={data.trackPoints} finished />
					</Suspense>
				</div>
			</section>
		) : (
			<section className="space-y-2">
				<h2 className="font-heading text-[15px] font-semibold text-foreground">
					运动轨迹
				</h2>
				<div className="flex h-32 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm text-muted-foreground">
					<MapIcon className="size-4" />
					无轨迹数据
				</div>
			</section>
		);

	return (
		<div className="flex flex-1 flex-col gap-4 px-4 pt-3 pb-6">
			<div className="flex items-center gap-3">
				<button
					type="button"
					aria-label="返回跑步页"
					onClick={() => router.push("/run")}
					className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
				>
					<ArrowLeft className="h-5 w-5 text-foreground" />
				</button>
				<h1 className="font-heading text-xl font-semibold text-foreground">
					跑步汇总
				</h1>
			</div>

			<Card className="items-center gap-2 border border-primary/20 py-6">
				<div className="font-mono text-5xl font-bold tracking-[-0.03em] text-primary">
					{(data.distanceMeters / 1_000).toFixed(2)}
				</div>
				<div className="text-sm text-muted-foreground">公里</div>
				<div className="text-center text-xs text-muted-foreground">
					{formatRunPeriod(data.startTime, data.endTime)}
				</div>
			</Card>

			<div className="grid grid-cols-3 gap-2.5">
				{[
					{ label: "用时", value: formatDuration(data.durationSeconds) },
					{
						label: "配速 /km",
						value: formatPaceSeconds(data.paceSecondsPerKm),
						accent: true,
					},
					{ label: "估算千卡", value: String(data.calories) },
				].map((metric) => (
					<Card
						key={metric.label}
						size="sm"
						className="items-center gap-0.5 py-3"
					>
						<span
							className={`text-lg font-semibold ${metric.accent ? "text-primary" : "text-foreground"}`}
						>
							{metric.value}
						</span>
						<span className="text-[11px] text-muted-foreground">
							{metric.label}
						</span>
					</Card>
				))}
			</div>
			{(data.correctionPercent ?? 0) > 5 && (
				<p className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
					服务端已根据有效轨迹修正距离，调整幅度为
					{data.correctionPercent!.toFixed(1)}%。
				</p>
			)}

			{data.splits && data.splits.length > 0 && (
				<>
					<Card className="gap-3 p-4">
						<div className="flex items-center justify-between">
							<h2 className="font-heading text-[15px] font-semibold text-foreground">
								配速分析
							</h2>
							<span className="text-xs text-muted-foreground">每公里</span>
						</div>
						<div className="overflow-x-auto pb-1">
							<div className="flex min-w-max items-end gap-3">
								{data.splits.map((split) => (
									<div
										key={`chart-${split.km}-${split.distanceMeters}`}
										className="flex w-11 shrink-0 flex-col items-center gap-1"
									>
										<span className="text-[9px] text-muted-foreground">
											{formatPaceSeconds(split.paceSecondsPerKm)}
										</span>
										<div
											className="w-7 rounded-md bg-primary"
											style={{ height: split.barHeight }}
										/>
										<span className="text-[10px] text-muted-foreground">
											{split.isPartial ? "尾" : split.km}
										</span>
									</div>
								))}
							</div>
						</div>
					</Card>

					<section className="space-y-2">
						<h2 className="font-heading text-[15px] font-semibold text-foreground">
							分段详情
						</h2>
						<div className="overflow-hidden rounded-xl border border-border bg-card">
							<div className="grid grid-cols-3 px-4 py-2.5 text-center text-[11px] font-semibold text-muted-foreground">
								<span>公里</span>
								<span>配速</span>
								<span>用时</span>
							</div>
							{data.splits.map((split) => (
								<div
									key={`row-${split.km}-${split.distanceMeters}`}
									className="grid grid-cols-3 items-center border-t border-border px-4 py-2.5 text-center text-[13px] text-foreground"
								>
									<div>
										<p>{split.isPartial ? "最后" : split.km}</p>
										{split.isPartial ? (
											<p className="text-[10px] text-muted-foreground">
												{(split.distanceMeters / 1_000).toFixed(2)} km
											</p>
										) : null}
									</div>
									<span>{formatPaceSeconds(split.paceSecondsPerKm)}</span>
									<span>{formatDuration(split.durationSeconds)}</span>
								</div>
							))}
						</div>
					</section>
				</>
			)}

			{trackSection}

			<div className="space-y-2 pt-1">
				<Link
					href="/run"
					className="block w-full rounded-lg bg-primary py-3 text-center text-sm font-semibold text-primary-foreground"
				>
					返回跑步页
				</Link>
				<button
					type="button"
					onClick={deleteRun}
					disabled={deleting}
					className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
				>
					{deleting ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Trash2 className="size-4" />
					)}
					{deleting ? "删除中..." : "删除本次跑步"}
				</button>
			</div>
			{deleteError && (
				<p className="text-center text-sm text-destructive">{deleteError}</p>
			)}
		</div>
	);
}
