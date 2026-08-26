"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Map, Heart, Pause, Play, Square, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import useRunTracker from "@/hooks/use-run-tracker";
import { useSession } from "@/lib/auth-client";
import RunMap from "@/components/map-loader";

const RUN_LOCK_STORAGE_KEY = "runner:run-controls-locked";
const UNLOCK_HOLD_MS = 1_500;

export default function RunPage() {
	const router = useRouter();
	const { data: session } = useSession();
	const userId = session?.user?.id;
	const tracker = useRunTracker(userId);

	const isPaused = tracker.status === "paused";
	const [locked, setLocked] = useState(false);
	const [unlocking, setUnlocking] = useState(false);
	const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hasActiveControls =
		tracker.status === "running" || tracker.status === "paused";

	useEffect(() => {
		if (!hasActiveControls) {
			if (
				tracker.status === "idle" ||
				tracker.status === "finished" ||
				tracker.status === "pending_completion"
			) {
				sessionStorage.removeItem(RUN_LOCK_STORAGE_KEY);
				setLocked(false);
			}
			return;
		}
		setLocked(sessionStorage.getItem(RUN_LOCK_STORAGE_KEY) === "true");
	}, [hasActiveControls, tracker.status]);

	useEffect(() => {
		if (!locked) return;
		const lockHistory = () => {
			window.history.pushState({ runControlsLocked: true }, "");
		};
		lockHistory();
		window.addEventListener("popstate", lockHistory);
		return () => window.removeEventListener("popstate", lockHistory);
	}, [locked]);

	useEffect(
		() => () => {
			if (unlockTimerRef.current !== null) {
				clearTimeout(unlockTimerRef.current);
			}
		},
		[],
	);

	const lockControls = () => {
		sessionStorage.setItem(RUN_LOCK_STORAGE_KEY, "true");
		setLocked(true);
	};

	const cancelUnlock = () => {
		if (unlockTimerRef.current !== null) {
			clearTimeout(unlockTimerRef.current);
			unlockTimerRef.current = null;
		}
		setUnlocking(false);
	};

	const beginUnlock = () => {
		if (unlockTimerRef.current !== null) return;
		setUnlocking(true);
		unlockTimerRef.current = setTimeout(() => {
			unlockTimerRef.current = null;
			setUnlocking(false);
			sessionStorage.removeItem(RUN_LOCK_STORAGE_KEY);
			setLocked(false);
		}, UNLOCK_HOLD_MS);
	};

	const handleStop = async () => {
		const result = await tracker.stop();
		if (result) {
			router.push(`/summary?runId=${result.runId}`);
		}
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
				<p className="max-w-64 text-center text-sm text-muted-foreground">
					开始后将自动获取高精度定位，并过滤漂移和静止噪声。
				</p>
				<button
					type="button"
					aria-label="开始跑步"
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

	if (tracker.status === "locating") {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
				<Map className="size-14 animate-pulse text-primary" />
				<div>
					<h1 className="text-xl font-semibold text-foreground">
						正在获取 GPS
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						正在校准稳定起点，准备好后会自动开始计时。
					</p>
				</div>
				{tracker.gpsState.error || tracker.startError ? (
					<p role="alert" className="text-sm text-destructive">
						{tracker.gpsState.error ?? tracker.startError}
					</p>
				) : null}
				<div className="flex gap-3">
					{tracker.gpsState.error ? (
						<button
							type="button"
							onClick={tracker.retryGps}
							className="rounded-lg border border-border px-4 py-2.5 text-sm text-foreground"
						>
							重试定位
						</button>
					) : null}
				</div>
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
		<div className="flex flex-1 flex-col gap-3 px-4 pt-3 pb-4">
			{locked ? (
				<div
					data-testid="run-lock-overlay"
					className="fixed inset-0 z-[60] touch-none bg-background/25 backdrop-blur-[2px]"
					onContextMenu={(event) => event.preventDefault()}
				>
					<div className="mx-auto flex h-full max-w-md flex-col items-end justify-end gap-2 px-5 pb-28">
						<span className="mr-1 text-xs font-medium text-foreground/80">
							长按解锁
						</span>
						<button
							type="button"
							aria-label="解除跑步控制锁定"
							onPointerDown={beginUnlock}
							onPointerUp={cancelUnlock}
							onPointerCancel={cancelUnlock}
							onPointerLeave={cancelUnlock}
							className="relative flex h-18 w-18 touch-none items-center justify-center overflow-hidden rounded-full border border-primary bg-card shadow-lg"
						>
							<span
								aria-hidden="true"
								className={`absolute inset-0 origin-bottom bg-primary/20 transition-transform duration-[1500ms] ease-linear ${
									unlocking ? "scale-y-100" : "scale-y-0 duration-0"
								}`}
							/>
							<Lock className="relative h-6 w-6 text-primary" />
						</button>
					</div>
				</div>
			) : null}
			<RunMap compact track={tracker.track} />
			<p className="-mt-1 text-center text-xs text-muted-foreground">
				{tracker.track.length >= 2 ? "轨迹记录中" : "正在等待稳定轨迹"}
			</p>

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
					{tracker.durationFormatted}
				</span>
				<span className="text-3xl font-semibold text-foreground">
					{tracker.distanceKilometersFormatted} 公里
				</span>
			</div>

			<div className="flex gap-3">
				<Card size="sm" className="flex-1 items-center py-3.5">
					<span className="text-xl font-semibold text-foreground">
						{tracker.paceFormatted}
					</span>
					<span className="text-[11px] text-muted-foreground">
						平均配速 /km
					</span>
				</Card>
				<Card size="sm" className="flex-1 items-center py-3.5">
					<span className="text-xl font-semibold text-primary">
						{tracker.currentPaceFormatted}
					</span>
					<span className="text-[11px] text-muted-foreground">
						即时配速 /km
					</span>
				</Card>
				<Card size="sm" className="flex-1 items-center py-3.5">
					<div className="flex items-center gap-1">
						<Heart className="h-3.5 w-3.5 fill-current text-destructive" />
						<span className="text-xl font-semibold text-destructive">--</span>
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
				<button
					type="button"
					aria-label={isPaused ? "继续跑步" : "暂停跑步"}
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
					aria-label="停止跑步"
					onClick={handleStop}
					className={`flex h-22 w-22 items-center justify-center rounded-full bg-gradient-to-b from-primary to-orange-600 shadow-[0_4px_32px_hsl(22_100%_56%/0.375)] transition-opacity ${
						locked ? "pointer-events-none opacity-0" : ""
					}`}
				>
					<Square className="h-8 w-8 text-white" />
				</button>
				<button
					type="button"
					aria-label="锁定跑步控制"
					onClick={lockControls}
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
