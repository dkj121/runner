import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal } from "lucide-react";
import { getPlayGroundLeaderboard, getPlayGroundMembers } from "@/lib/actions";

async function LeaderboardContent({ playgroundId }: { playgroundId: string }) {
	const leaderboard = await getPlayGroundLeaderboard(playgroundId).catch(
		() => [],
	);

	if (leaderboard.length === 0) {
		return (
			<div className="flex flex-col items-center gap-4 py-16">
				<Trophy className="size-12 text-muted-foreground/30" />
				<p className="text-sm text-muted-foreground">暂无跑步记录</p>
			</div>
		);
	}

	const podiumColors = [
		"bg-amber-500 text-amber-950", // gold
		"bg-slate-400 text-slate-950", // silver
		"bg-orange-600 text-orange-50", // bronze
	];

	return (
		<div className="flex flex-col gap-6">
			{/* Podium — top 3 */}
			<div className="flex items-end justify-center gap-3 pt-4">
				{leaderboard.slice(0, 3).map((user, i) => {
					const heights = ["h-24", "h-32", "h-20"];
					const order = [1, 0, 2]; // 2nd, 1st, 3rd visual order
					const idx = order[i];
					const entry = leaderboard[idx];
					return (
						<div
							key={entry.userId}
							className="flex flex-col items-center gap-2"
						>
							<Avatar className="size-10 ring-2 ring-border">
								<AvatarFallback className="bg-card text-xs font-semibold">
									{entry.name[0]}
								</AvatarFallback>
							</Avatar>
							<span className="line-clamp-1 max-w-[60px] text-center text-[11px] text-muted-foreground">
								{entry.name}
							</span>
							<div
								className={`flex w-16 ${heights[idx]} flex-col items-center justify-end rounded-t-lg ${podiumColors[idx]} pb-2`}
							>
								<span className="text-lg font-bold">{idx + 1}</span>
								<span className="text-[10px]">
									{entry.totalDistance.toFixed(1)}km
								</span>
							</div>
						</div>
					);
				})}
			</div>

			{/* Full table */}
			<Table>
				<TableHeader>
					<TableRow className="border-border hover:bg-transparent">
						<TableHead className="w-12 text-muted-foreground">#</TableHead>
						<TableHead className="text-muted-foreground">跑者</TableHead>
						<TableHead className="text-right text-muted-foreground">
							距离
						</TableHead>
						<TableHead className="text-right text-muted-foreground">
							时间
						</TableHead>
						<TableHead className="text-right text-muted-foreground">
							次数
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{leaderboard.map((entry, i) => (
						<TableRow
							key={entry.userId}
							className="border-border data-[state=selected]:bg-primary/5"
						>
							<TableCell>
								{i < 3 ? (
									<Medal
										className={`size-4 ${
											i === 0
												? "text-amber-500"
												: i === 1
													? "text-slate-400"
													: "text-orange-600"
										}`}
									/>
								) : (
									<span className="text-sm text-muted-foreground">{i + 1}</span>
								)}
							</TableCell>
							<TableCell>
								<div className="flex items-center gap-2">
									<Avatar className="size-7">
										<AvatarFallback className="bg-card text-[10px]">
											{entry.name[0]}
										</AvatarFallback>
									</Avatar>
									<span className="text-sm text-foreground">{entry.name}</span>
								</div>
							</TableCell>
							<TableCell className="text-right font-mono text-sm tabular-nums">
								{entry.totalDistance.toFixed(1)} km
							</TableCell>
							<TableCell className="text-right font-mono text-sm text-muted-foreground tabular-nums">
								{Math.floor(entry.totalTime / 60)}:
								{(entry.totalTime % 60).toString().padStart(2, "0")}
							</TableCell>
							<TableCell className="text-right font-mono text-sm text-muted-foreground tabular-nums">
								{entry.runCount}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

function LeaderboardSkeleton() {
	return (
		<div className="flex flex-col gap-4">
			<Skeleton className="h-40 w-full bg-card" />
			{Array.from({ length: 5 }).map((_, i) => (
				<Skeleton key={i} className="h-14 w-full bg-card" />
			))}
		</div>
	);
}

export default async function LeaderboardPage({
	searchParams,
}: {
	searchParams: Promise<{ playgroundId?: string }>;
}) {
	const { playgroundId } = await searchParams;

	return (
		<div className="flex flex-col gap-6 px-5 py-6">
			<h1 className="font-heading text-xl font-semibold text-foreground">
				排行榜
			</h1>

			{playgroundId ? (
				<Suspense fallback={<LeaderboardSkeleton />}>
					<LeaderboardContent playgroundId={playgroundId} />
				</Suspense>
			) : (
				<div className="flex flex-col items-center gap-4 py-16">
					<Trophy className="size-12 text-muted-foreground/30" />
					<p className="text-sm text-muted-foreground">
						从域详情页面进入排行榜
					</p>
				</div>
			)}
		</div>
	);
}
