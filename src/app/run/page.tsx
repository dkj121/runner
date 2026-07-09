"use client";

import { Map, Heart, Pause, Square, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BottomNav } from "@/components/bottom-nav";

export default function RunPage() {
	return (
		<div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
			<div className="flex flex-1 flex-col gap-5 px-5 pb-4 pt-4">
				<Card className="flex h-60 items-center justify-center border border-border">
					<div className="flex flex-col items-center gap-1">
						<Map className="h-10 w-10 text-muted-foreground/50" />
						<span className="text-xs text-muted-foreground">实时轨迹地图</span>
					</div>
				</Card>

				<div className="flex flex-col items-center gap-1">
					<div className="flex items-end gap-2">
						<span className="font-mono text-5xl font-bold tracking-wider text-primary">
							31:24
						</span>
						<span className="mb-1 text-base text-muted-foreground">
							/ 45:00
						</span>
					</div>
					<span className="text-3xl font-semibold text-foreground">
						5.47 公里
					</span>
				</div>

				<div className="flex gap-3">
					<Card size="sm" className="flex-1 items-center py-3.5">
						<span className="text-xl font-semibold text-foreground">
							5&apos;43&quot;
						</span>
						<span className="text-[11px] text-muted-foreground">配速</span>
					</Card>
					<Card size="sm" className="flex-1 items-center py-3.5">
						<div className="flex items-center gap-1">
							<Heart className="h-3.5 w-3.5 fill-current text-[#FF4444]" />
							<span className="text-xl font-semibold text-[#FF4444]">158</span>
						</div>
						<span className="text-[11px] text-muted-foreground">心率 bpm</span>
					</Card>
					<Card size="sm" className="flex-1 items-center py-3.5">
						<span className="text-xl font-semibold text-foreground">312</span>
						<span className="text-[11px] text-muted-foreground">卡路里</span>
					</Card>
				</div>

				<div className="flex items-center justify-center gap-4">
					<button
						type="button"
						className="flex h-18 w-18 items-center justify-center rounded-full border border-border bg-card"
					>
						<Pause className="h-7 w-7 text-primary" />
					</button>
					<button
						type="button"
						className="flex h-22 w-22 items-center justify-center rounded-full bg-liner-to-b from-primary to-orange-600 shadow-[0_4px_32px_hsl(22_100%_56%/0.375)]"
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
						<Avatar className="size-10 bg-liner-to-br from-primary to-orange-600">
							<AvatarFallback className="bg-transparent text-xs font-semibold text-white">
								D
							</AvatarFallback>
						</Avatar>
						<Avatar className="size-10 bg-[#3B82F6]">
							<AvatarFallback className="bg-transparent text-xs font-semibold text-white">
								小
							</AvatarFallback>
						</Avatar>
						<Avatar className="size-10 bg-[#EF4444]">
							<AvatarFallback className="bg-transparent text-xs font-semibold text-white">
								小
							</AvatarFallback>
						</Avatar>
						<Avatar className="size-10 bg-[#22C55E]">
							<AvatarFallback className="bg-transparent text-xs font-semibold text-white">
								阿
							</AvatarFallback>
						</Avatar>
					</div>
				</div>
			</div>

			<BottomNav active="/run" />
		</div>
	);
}
