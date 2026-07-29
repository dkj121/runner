"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Map, Heart, Pause, Play, Square, Lock } from "lucide-react";
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

	const handleStop = async () => {
		const result = await tracker.stop();
		if (result) {
			router.push(`/summary?runId=${result.runId}`);
		}
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
					className="flex h-22 w-22 items-center justify-center rounded-full bg-gradient-to-b from-primary to-orange-600 text-lg font-bold text-white shadow-[0_4px_32px_hsl(22_100%_56%/0.375)]"
				>
					开始
				</button>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col gap-5 px-5 pt-4 pb-4">
			<RunMap track={tracker.track} />

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

			<div className="flex items-center justify-center gap-4">
				<button
					type="button"
					onClick={isPaused ? tracker.resume : tracker.pause}
					className="flex h-18 w-18 items-center justify-center rounded-full border border-border bg-card"
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
					className="flex h-22 w-22 items-center justify-center rounded-full bg-gradient-to-b from-primary to-orange-600 shadow-[0_4px_32px_hsl(22_100%_56%/0.375)]"
				>
					<Square className="h-8 w-8 text-white" />
				</button>
				<button
					type="button"
					className="flex h-18 w-18 items-center justify-center rounded-full border border-border bg-card"
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
