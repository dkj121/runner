import { Suspense } from "react";
import {
	getUserSchedule,
	listMyPlayGrounds,
} from "@/lib/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";

async function ScheduleContent() {
	const playgrounds = await listMyPlayGrounds().catch(() => []);
	const userSchedule = await getUserSchedule().catch(() => null);

	return (
		<div className="flex flex-col gap-6">
			{/* PlayGround schedules */}
			<div>
				<h2 className="mb-3 font-heading text-base font-semibold text-foreground">
					社区日程
				</h2>
				<div className="flex flex-col gap-2.5">
					{playgrounds.length === 0 && (
						<p className="py-8 text-center text-sm text-muted-foreground">
							还没有加入任何域，去发现或创建一个
						</p>
					)}
					{playgrounds.map((pg) => (
						<Link key={pg.id} href={`/playground/${pg.id}`}>
							<Card className="border-border bg-card transition-colors hover:bg-card/80">
								<CardContent className="flex items-center gap-3.5 p-4">
									<div className="h-10 w-1 shrink-0 rounded-full bg-primary" />
									<div className="flex-1">
										<p className="text-sm font-semibold text-foreground">
											{pg.name}
										</p>
										<p className="text-[12px] text-muted-foreground">
											查看日程安排
										</p>
									</div>
									<ChevronRight className="size-4 text-muted-foreground" />
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			</div>

			<Separator className="bg-border" />

			{/* Personal schedule */}
			<div>
				<h2 className="mb-3 font-heading text-base font-semibold text-foreground">
					我的日程
				</h2>
				{!userSchedule || userSchedule.spotDates.length === 0 ? (
					<Card className="border-border bg-card">
						<CardContent className="flex flex-col items-center gap-3 py-12">
							<Calendar className="size-10 text-muted-foreground/30" />
							<p className="text-sm text-muted-foreground">暂无个人日程</p>
							<p className="text-[12px] text-muted-foreground">
								从社区日程导入或创建新的跑步计划
							</p>
						</CardContent>
					</Card>
				) : (
					<div className="flex flex-col gap-2">
						{userSchedule.spotDates.map((spot) => (
							<Card key={spot.id} className="border-border bg-card">
								<CardContent className="flex items-center gap-3 p-4">
									<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
										<Clock className="size-4 text-primary" />
									</div>
									<div className="flex-1">
										<p className="text-sm font-semibold text-foreground">
											{spot.weekDay}
										</p>
										<p className="text-[12px] text-muted-foreground">
											{new Date(spot.date).toLocaleDateString("zh-CN")} ·{" "}
											{new Date(spot.time).toLocaleTimeString("zh-CN", {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</p>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>

			{/* Create schedule CTA */}
			<Link href="/playground/create">
				<Button variant="outline" className="w-full gap-2 border-border">
					<Calendar className="size-4" />
					创建新域并设置日程
				</Button>
			</Link>
		</div>
	);
}

function ScheduleSkeleton() {
	return (
		<div className="flex flex-col gap-4">
			{Array.from({ length: 3 }).map((_, i) => (
				<Skeleton key={i} className="h-16 w-full bg-card" />
			))}
		</div>
	);
}

export default function SchedulePage() {
	return (
		<div className="flex flex-col gap-6 px-5 py-6">
			<h1 className="font-heading text-xl font-semibold text-foreground">
				日程
			</h1>
			<Suspense fallback={<ScheduleSkeleton />}>
				<ScheduleContent />
			</Suspense>
		</div>
	);
}
