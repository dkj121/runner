"use client";

import { Map, Heart, Pause, Play, Square, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BottomNav } from "@/components/bottom-nav";
import useRunTracker from "@/hooks/use-run-tracker";
import { useSession } from "@/lib/auth-client";

export default function RunPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "1";
  const tracker = useRunTracker(userId);

  const isRunning = tracker.status === "running";
  const isPaused = tracker.status === "paused";
  const isActive = isRunning || isPaused;

  if (tracker.status === "idle") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5">
          <Map className="h-16 w-16 text-muted-foreground/30" />
          <button
            type="button"
            onClick={() => tracker.start()}
            className="flex h-22 w-22 items-center justify-center rounded-full bg-gradient-to-b from-primary to-orange-600 text-lg font-bold text-white shadow-[0_4px_32px_hsl(22_100%_56%/0.375)]"
          >
            开始
          </button>
        </div>
        <BottomNav active="/run" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
      <div className="flex flex-1 flex-col gap-5 px-5 pb-4 pt-4">
        <Card className="flex h-60 items-center justify-center border border-border">
          <div className="flex flex-col items-center gap-1">
            <Map className="h-10 w-10 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">
              {isPaused ? "已暂停" : `${tracker.track.length} 个轨迹点`}
            </span>
          </div>
        </Card>

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
            <span className="text-[11px] text-muted-foreground">配速</span>
          </Card>
          <Card size="sm" className="flex-1 items-center py-3.5">
            <div className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5 fill-current text-[#FF4444]" />
              <span className="text-xl font-semibold text-[#FF4444]">--</span>
            </div>
            <span className="text-[11px] text-muted-foreground">心率 bpm</span>
          </Card>
          <Card size="sm" className="flex-1 items-center py-3.5">
            <span className="text-xl font-semibold text-foreground">--</span>
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
            onClick={() => tracker.stop()}
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

      <BottomNav active="/run" />
    </div>
  );
}
