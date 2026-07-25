"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

interface SplitRow {
	km: number;
	pace: string;
	barH: number;
	barColor: string;
}

interface RunData {
	id: string;
	distance: number;
	duration: number;
	avgPace: string;
	calories: number;
	startTime: string;
	endTime: string;
	splits: SplitRow[] | null;
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

function formatDuration(s: number): string {
	const m = Math.floor(s / 60);
	const sec = s % 60;
	return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatPace(pace: string): string {
	// "5:30 /km" → "5'30""
	const match = pace.match(/(\d+):(\d+)/);
	if (!match) return pace;
	return `${match[1]}'${match[2]}"`;
}

function paceToBarH(pace: string): number {
	// faster pace → taller bar, clamp between 40-100
	const match = pace.match(/(\d+):(\d+)/);
	if (!match) return 60;
	const totalSec = parseInt(match[1]) * 60 + parseInt(match[2]);
	return Math.max(40, Math.min(100, 160 - totalSec));
}

export default function SummaryPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { data: session } = useSession();
	const userId = session?.user?.id ?? "cmrz1m86b0000lcsnkhekg50y";
	const runId = searchParams.get("runId");

	const [data, setData] = useState<RunData | null>(null);
	const [loading, setLoading] = useState(true);

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
				| { km: number; pace: string; duration: number }[]
				| null;
			const splits: SplitRow[] | null = rawSplits
				? rawSplits.map((s) => ({
						km: s.km,
						pace: formatPace(s.pace),
						barH: paceToBarH(s.pace),
						barColor:
							paceToBarH(s.pace) >= 70 ? "bg-primary" : "bg-orange-500",
					}))
				: null;

			setData({
				id: record.id,
				distance: record.distance,
				duration: record.duration,
				avgPace: formatPace(record.avgPace || "--"),
				calories: record.calories || 0,
				startTime: record.startTime,
				endTime: record.endTime,
				splits,
			});
		} catch (e) {
			console.error("加载跑步记录失败", e);
		}
		setLoading(false);
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

	const statCards = [
		{ value: formatDuration(data.duration), label: "用时" },
		{ value: data.avgPace, label: "配速", accent: true },
		{ value: String(data.calories), label: "卡路里" },
		{ value: "--", label: "步频" },
	];

	return (
		<div className="flex flex-1 flex-col gap-5 px-5 pb-4 pt-4">
			<div className="flex items-center gap-3">
				<button type="button" onClick={() => router.push("/run")}>
					<ArrowLeft className="h-5 w-5 text-foreground" />
				</button>
				<h1 className="font-heading text-xl font-semibold text-foreground">
					跑步汇总
				</h1>
			</div>

			<Card className="items-center gap-2 border border-[var(--color-primary)/20] py-6 shadow-[0_0_40px_hsl(22_100%_56%/0.08)]">
				<div className="font-mono text-5xl font-bold tracking-tighter text-primary">
					{data.distance}
				</div>
				<div className="text-sm text-muted-foreground">公里</div>
				<div className="text-[13px] text-muted-foreground">
					{formatDate(data.startTime)} — {formatDate(data.endTime)}
				</div>
			</Card>

			<div className="flex gap-2.5">
				{statCards.map((d) => (
					<Card
						key={d.label}
						size="sm"
						className="flex-1 items-center gap-0.5 py-3"
					>
						<span
							className={`text-lg font-semibold ${
								d.accent ? "text-primary" : "text-foreground"
							}`}
						>
							{d.value}
						</span>
						<span className="text-[11px] text-muted-foreground">
							{d.label}
						</span>
					</Card>
				))}
			</div>

			{data.splits && data.splits.length > 0 && (
				<>
					<Card className="gap-3 p-4">
						<div className="flex items-center justify-between">
							<span className="font-heading text-[15px] font-semibold text-foreground">
								配速分析
							</span>
							<span className="text-xs text-muted-foreground">每公里</span>
						</div>
						<div className="flex items-end justify-between gap-3">
							{data.splits.map((d) => (
								<div
									key={d.km}
									className="flex flex-1 flex-col items-center gap-1"
								>
									<span className="text-[9px] text-muted-foreground">
										{d.pace}
									</span>
									<div
										className={`w-7 rounded-md ${d.barColor}`}
										style={{ height: d.barH * 0.8 }}
									/>
									<span className="text-[10px] text-muted-foreground">
										{d.km}
									</span>
								</div>
							))}
						</div>
					</Card>

					<div>
						<h2 className="mb-2 font-heading text-[15px] font-semibold text-foreground">
							分段详情
						</h2>
						<div className="overflow-hidden rounded-xl border border-border bg-card">
							<div className="flex gap-2 px-3.5 py-2.5">
								{["公里", "配速", "用时"].map((h) => (
									<div
										key={h}
										className="flex-1 text-center text-[11px] font-semibold text-muted-foreground"
									>
										{h}
									</div>
								))}
							</div>
							{data.splits.map((row, i) => (
								<div
									key={row.km}
									className={`flex gap-2 px-3.5 py-2.5 ${
										i < data.splits!.length - 1
											? "border-t border-border"
											: ""
									}`}
								>
									<div className="flex-1 text-center text-[13px] text-foreground">
										{row.km}
									</div>
									<div className="flex-1 text-center text-[13px] text-foreground">
										{row.pace}
									</div>
									<div className="flex-1 text-center text-[13px] text-foreground">
										--
									</div>
								</div>
							))}
						</div>
					</div>
				</>
			)}

			<div className="flex justify-center">
				<Link
					href="/run"
					className="w-full max-w-xs rounded-lg bg-primary py-3 text-center text-sm font-semibold text-white"
				>
					返回首页
				</Link>
			</div>
		</div>
	);
}
