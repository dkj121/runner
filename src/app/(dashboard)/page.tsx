import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { listMyPlayGrounds } from "@/lib/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Play, ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";

export default async function DashboardHome() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const user = session?.user;
	if (!user) return null; // layout handles redirect

	const playgrounds = await listMyPlayGrounds().catch(() => []);

	const greeting = () => {
		const hour = new Date().getHours();
		if (hour < 6) return "夜深了";
		if (hour < 12) return "上午好";
		if (hour < 14) return "中午好";
		if (hour < 18) return "下午好";
		return "晚上好";
	};

	return (
		<div className="flex flex-col gap-6 px-5 py-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex flex-col gap-0.5">
					<span className="text-[13px] text-muted-foreground">
						{greeting()}
					</span>
					<h1 className="font-heading text-[22px] font-semibold text-foreground">
						{user.name ?? "跑者"}
					</h1>
				</div>
				<Avatar className="size-11 ring-2 ring-primary/30">
					<AvatarFallback className="bg-primary font-heading text-[18px] font-semibold text-primary-foreground">
						{(user.name ?? "R")[0].toUpperCase()}
					</AvatarFallback>
				</Avatar>
			</div>

			{/* Stats Row — placeholder until Part 2 */}
			<div className="grid grid-cols-3 gap-3">
				{[
					{ label: "本月里程", value: "--", unit: "公里" },
					{ label: "本月时长", value: "--", unit: "小时" },
					{ label: "本月次数", value: "--", unit: "次" },
				].map((stat) => (
					<Card key={stat.label} className="border-border bg-card">
						<CardContent className="flex flex-col gap-1 p-4">
							<span className="text-[11px] text-muted-foreground">
								{stat.label}
							</span>
							<span className="font-heading text-2xl font-bold text-primary">
								{stat.value}
							</span>
							<span className="text-[11px] text-muted-foreground">
								{stat.unit}
							</span>
						</CardContent>
					</Card>
				))}
			</div>

			{/* Quick Start — two-path CTA */}
			<div className="grid grid-cols-2 gap-3">
				<Link href="/run">
					<Card className="border-border bg-card transition-colors hover:bg-card/80">
						<CardContent className="flex items-center gap-3 p-4">
							<div className="flex size-10 items-center justify-center rounded-xl bg-primary/15">
								<Play className="size-5 text-primary" />
							</div>
							<div>
								<p className="text-sm font-semibold text-foreground">
									个人跑步
								</p>
								<p className="text-[11px] text-muted-foreground">即刻出发</p>
							</div>
						</CardContent>
					</Card>
				</Link>
				<Link href="/playground/create">
					<Card className="border-border bg-card transition-colors hover:bg-card/80">
						<CardContent className="flex items-center gap-3 p-4">
							<div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/15">
								<Play className="size-5 text-blue-400" />
							</div>
							<div>
								<p className="text-sm font-semibold text-foreground">约跑</p>
								<p className="text-[11px] text-muted-foreground">组队出发</p>
							</div>
						</CardContent>
					</Card>
				</Link>
			</div>

			{/* My PlayGrounds */}
			{playgrounds.length > 0 && (
				<>
					<Separator className="bg-border" />
					<div>
						<div className="mb-3 flex items-center justify-between">
							<h2 className="font-heading text-base font-semibold text-foreground">
								我的域
							</h2>
							<Link
								href="/playground/create"
								className="text-[13px] text-primary"
							>
								新建
							</Link>
						</div>
						<div className="flex flex-col gap-2.5">
							{playgrounds.map((pg) => (
								<Link key={pg.id} href={`/playground/${pg.id}`}>
									<Card className="border-border bg-card transition-colors hover:bg-card/80">
										<CardContent className="flex items-center gap-3 p-4">
											<div className="flex size-11 items-center justify-center rounded-xl bg-primary/15">
												<MapPin className="size-5 text-primary" />
											</div>
											<div className="flex-1">
												<p className="text-sm font-semibold text-foreground">
													{pg.name}
												</p>
												<p className="text-[12px] text-muted-foreground">
													{pg._count.users} 人 ·{" "}
													{pg.visibility === "PUBLIC" ? "公开" : "私有"}
												</p>
											</div>
											<Badge
												variant="secondary"
												className={
													pg.visibility === "PUBLIC"
														? "bg-emerald-500/15 text-emerald-400"
														: "bg-muted text-muted-foreground"
												}
											>
												{pg.visibility === "PUBLIC" ? "公开" : "私有"}
											</Badge>
											<ChevronRight className="size-4 text-muted-foreground" />
										</CardContent>
									</Card>
								</Link>
							))}
						</div>
					</div>
				</>
			)}

			{/* Schedule card — placeholder */}
			<Separator className="bg-border" />
			<div>
				<div className="mb-3 flex items-center justify-between">
					<h2 className="font-heading text-base font-semibold text-foreground">
						今日日程
					</h2>
					<Link href="/schedule" className="text-[13px] text-primary">
						查看全部
					</Link>
				</div>
				<Card className="border-border bg-card">
					<CardContent className="flex items-center gap-3.5 p-4">
						<div className="h-10 w-1 shrink-0 rounded-full bg-primary" />
						<div className="flex-1">
							<p className="text-sm font-semibold text-foreground">
								暂无今日日程
							</p>
							<p className="text-[12px] text-muted-foreground">
								去社区发现或创建新的跑步日程
							</p>
						</div>
						<Link href="/schedule">
							<Button variant="ghost" size="icon">
								<ChevronRight className="size-4" />
							</Button>
						</Link>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
