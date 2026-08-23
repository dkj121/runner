"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Map, Heart, Pause, Play, Square, Lock, Unlock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import useRunTracker from "@/hooks/use-run-tracker";
import { useSession } from "@/lib/auth-client";
import RunMap from "@/components/map-loader";

type Density = "high" | "medium" | "low";

const DENSITY_LABEL: Record<Density, string> = {
	high: "密集（1s）",
	medium: "适中（5s）",
	low: "经济（10s）",
};

export default function RunPage() {
	const router = useRouter();
	const { data: session } = useSession();
	const userId = session?.user?.id;
	const [density, setDensity] = useState<Density>("high");
	const tracker = useRunTracker(userId, { samplingDensity: density });

	const isPaused = tracker.status === "paused";
	const [locked, setLocked] = useState(false);
	const [unlockHint, setUnlockHint] = useState(false);

	const handleStop = async () => {
		const result = await tracker.stop();
		if (result) {
			router.push(`/summary?runId=${result.runId}`);
		}
	};

	const handleUnlock = () => {
		setUnlockHint(true);
		setTimeout(() => {
			setLocked(false);
			setUnlockHint(false);
		}, 400);
	};

	const handleRetryCompletion = async () => {
		const result = await tracker.retryCompletion();
		if (result) router.push(`/summary?runId=${result.runId}`);
	};

	const handleAbandon = async () => {
		if (!window.confirm("确认放弃这次未保存的跑步吗？此操作无法撤销。")) return;
		await tracker.abandon();
	};

	if (tracker.status === "idle") {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-6 px-5">
				<Map className="h-16 w-16 text-muted-foreground/30" />
				<div className="flex flex-col items-center gap-3">
					<p className="text-sm text-muted-foreground">采样密度</p>
					<div className="flex gap-2">
						{(["high", "medium", "low"] as Density[]).map((d) => (
							<button
								key={d}
								type="button"
								onClick={() => setDensity(d)}
								className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
									density === d
										? "border-primary bg-primary/10 text-primary"
										: "border-border text-muted-foreground"
								}`}
							>
								{DENSITY_LABEL[d]}
							</button>
						))}
					</div>
				</div>
				<button
					type="button"
					onClick={() => tracker.start()}
					disabled={tracker.isStarting}
					className="flex h-22 w-22 items-center justify-center rounded-full bg-gradient-to-b from-primary to-orange-600 text-lg font-bold text-white shadow-[0_4px_32px_hsl(22_100%_56%/0.375)] disabled:cursor-wait disabled:opacity-60"
				>
					{tracker.isStarting ? "启动中" : "开始"}
				</button>
				{tracker.startError && (
					<p role="alert" className="text-center text-sm text-destructive">
						{tracker.startError}
					</p>
				)}
			</div>
		);
	}

	if (tracker.status === "finished") {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 px-5">
				<div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-b from-primary to-orange-600 shadow-[0_4px_32px_hsl(22_100%_56%/0.375)]">
					<Square className="size-8 text-white" />
				</div>
				<p className="text-lg font-semibold text-foreground">跑步已完成</p>
				<p className="text-sm text-muted-foreground">正在生成汇总...</p>
			</div>
		);
	}

	if (tracker.status === "pending_completion") {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
				<Square className="size-12 text-primary" />
				<div>
					<h1 className="text-xl font-semibold text-foreground">跑步待完成</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						轨迹已冻结，不会继续记录移动。
					</p>
				</div>
				{tracker.completionError && (
					<p role="alert" className="text-sm text-destructive">
						{tracker.completionError}
					</p>
				)}
				<div className="flex gap-3">
					<button
						type="button"
						onClick={handleRetryCompletion}
						className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white"
					>
						重试保存
					</button>
					<button
						type="button"
						onClick={handleAbandon}
						className="rounded-lg border border-destructive/50 px-5 py-2.5 text-sm text-destructive"
					>
						放弃
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col gap-5 px-5 pt-4 pb-4">
			<RunMap track={tracker.track} />

			{tracker.gpsState?.error && (
				<div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
					<span className="flex-1 text-sm text-destructive">
						{tracker.gpsState.error}
					</span>
					<button
						type="button"
						onClick={tracker.retryGps}
						className="rounded-md border border-destructive/50 px-3 py-1 text-xs text-destructive"
					>
						重试
					</button>
				</div>
			)}

			<div className="flex flex-col items-center gap-1">
				<span className="font-mono text-5xl font-bold tracking-wider text-primary">
					{tracker.duration}
				</span>
				<span className="text-3xl font-semibold text-foreground">
					{tracker.distance} 公里
				</span>
			</div>

			<div className="flex gap-3">
				<Card size="sm" className="flex-1 items-center py-3.5">
					<span className="text-xl font-semibold text-foreground">
						{tracker.pace}
					</span>
					<span className="text-[11px] text-muted-foreground">平均配速</span>
				</Card>
				<Card size="sm" className="flex-1 items-center py-3.5">
					<span className="text-xl font-semibold text-primary">
						{tracker.currentPace}
					</span>
					<span className="text-[11px] text-muted-foreground">即时配速</span>
				</Card>
				<Card size="sm" className="flex-1 items-center py-3.5">
					<div className="flex items-center gap-1">
						<Heart className="h-3.5 w-3.5 fill-current text-[#FF4444]" />
						<span className="text-xl font-semibold text-[#FF4444]">--</span>
					</div>
					<span className="text-[11px] text-muted-foreground">心率 bpm</span>
				</Card>
				<Card size="sm" className="flex-1 items-center py-3.5">
					<span className="text-xl font-semibold text-foreground">
						{tracker.calories}
					</span>
					<span className="text-[11px] text-muted-foreground">卡路里</span>
				</Card>
			</div>

			<div className="relative flex items-center justify-center gap-4">
				{locked && (
					<div
						className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center rounded-full"
						onClick={handleUnlock}
					>
						{unlockHint ? (
							<span className="rounded-full bg-background/80 px-6 py-2 text-sm text-muted-foreground backdrop-blur-sm">
								已解锁
							</span>
						) : (
							<div className="flex flex-col items-center gap-1">
								<Unlock className="h-6 w-6 text-muted-foreground/50" />
								<span className="text-xs text-muted-foreground/50">
									轻触解锁
								</span>
							</div>
						)}
					</div>
				)}
				<button
					type="button"
					onClick={isPaused ? tracker.resume : tracker.pause}
					className={`flex h-18 w-18 items-center justify-center rounded-full border bg-card transition-opacity ${
						locked ? "pointer-events-none opacity-0" : "border-border"
					}`}
				>
					{isPaused ? (
						<Play className="h-7 w-7 text-primary" />
					) : (
						<Pause className="h-7 w-7 text-primary" />
					)}
				</button>
				<button
					type="button"
					onClick={handleStop}
					className={`flex h-22 w-22 items-center justify-center rounded-full bg-gradient-to-b from-primary to-orange-600 shadow-[0_4px_32px_hsl(22_100%_56%/0.375)] transition-opacity ${
						locked ? "pointer-events-none opacity-0" : ""
					}`}
				>
					<Square className="h-8 w-8 text-white" />
				</button>
				<button
					type="button"
					onClick={() => setLocked(true)}
					className={`flex h-18 w-18 items-center justify-center rounded-full border bg-card transition-opacity ${
						locked ? "pointer-events-none opacity-0" : "border-border"
					}`}
				>
					<Lock className="h-6 w-6 text-muted-foreground" />
				</button>
			</div>

			<div>
				<p className="mb-2.5 text-[11px] font-semibold text-muted-foreground">
					一起跑的伙伴
				</p>
				<div className="flex items-center gap-2">
					<Avatar className="size-10 bg-gradient-to-br from-primary to-orange-600">
						<AvatarFallback className="bg-transparent text-xs font-semibold text-white">
							你
						</AvatarFallback>
					</Avatar>
				</div>
			</div>
		</div>
	);
}
