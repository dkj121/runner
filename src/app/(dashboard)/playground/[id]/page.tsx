import { notFound } from "next/navigation";
import {
	getPlayGround,
	getPlayGroundMembers,
	getPlayGroundLeaderboard,
	generateInviteCode,
	deletePlayGround,
	leavePlayGround,
} from "@/lib/actions";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	ArrowLeft,
	Target,
	Volume2,
	Radio,
	Share2,
	Music,
	MapPin,
	ChevronRight,
	Play,
	Trash2,
	LogOut,
	Copy,
	Trophy,
} from "lucide-react";
import Link from "next/link";
import { CopyButton } from "./copy-button";

export default async function PlayGroundDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	const userId = session?.user?.id;

	const pg = await getPlayGround(id).catch(() => null);
	if (!pg) notFound();

	const members = await getPlayGroundMembers(id).catch(() => []);
	const isOwner = members.some(
		(m) => m.userId === userId && m.role === "OWNER",
	);
	const isMember = members.some((m) => m.userId === userId);

	const activeCode = pg.inviteCodes[0]?.code ?? null;

	const settingsItems = [
		{
			icon: Target,
			label: "跑步目标设置",
			desc: "距离、配速、时长",
		},
		{
			icon: Volume2,
			label: "音频设置",
			desc: "麦克风、音量、共享音乐",
		},
		{
			icon: Radio,
			label: "语音播报",
			desc: "配速提醒、里程播报",
		},
		{
			icon: Share2,
			label: "实时共享",
			desc: "位置、心率、配速信息共享",
		},
		{ icon: Music, label: "共享音乐", desc: "域成员同步播放列表" },
		{ icon: MapPin, label: "集合地点", desc: pg.locationAddr ?? "未设置" },
	];

	return (
		<div className="flex flex-col gap-6 px-5 py-6">
			{/* Nav */}
			<div className="flex items-center gap-3">
				<Link href="/dashboard">
					<Button variant="ghost" size="icon" className="size-9">
						<ArrowLeft className="size-5" />
					</Button>
				</Link>
				<h1 className="font-heading text-xl font-semibold text-foreground">
					域设置
				</h1>
			</div>

			{/* Domain Info */}
			<Card className="border-border bg-card">
				<CardContent className="flex items-center gap-3.5 p-[18px]">
					<div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 ring-2 ring-primary/20">
						<span className="font-heading text-lg font-bold text-primary">
							{pg.name[0]}
						</span>
					</div>
					<div className="flex flex-col gap-0.5">
						<p className="font-heading text-base font-semibold text-foreground">
							{pg.name}
						</p>
						<p className="text-[12px] text-muted-foreground">
							{activeCode ? `邀请码: ${activeCode}` : "无活跃邀请码"} ·{" "}
							{pg._count.users} 名成员
						</p>
					</div>
				</CardContent>
			</Card>

			{/* Settings List */}
			<div className="flex flex-col gap-0.5">
				{settingsItems.map(({ icon: Icon, label, desc }) => (
					<Card
						key={label}
						className="border-border bg-card transition-colors hover:bg-card/80"
					>
						<CardContent className="flex items-center gap-3 px-4 py-3.5">
							<Icon className="size-5 text-primary" />
							<div className="flex-1">
								<p className="text-sm font-medium text-foreground">{label}</p>
								<p className="text-[11px] text-muted-foreground">{desc}</p>
							</div>
							<ChevronRight className="size-4 text-muted-foreground" />
						</CardContent>
					</Card>
				))}
			</div>

			{/* Members */}
			<Separator className="bg-border" />
			<div>
				<h2 className="mb-3 font-heading text-base font-semibold text-foreground">
					成员 ({members.length})
				</h2>
				<div className="flex flex-col gap-2">
					{members.map(({ user, role }) => (
						<div
							key={user.id}
							className="flex items-center gap-3 rounded-xl bg-card px-4 py-2.5"
						>
							<Avatar className="size-9">
								<AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
									{(user.name ?? "?")[0].toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<span className="flex-1 text-sm text-foreground">
								{user.name}
							</span>
							<Badge
								variant="secondary"
								className={
									role === "OWNER"
										? "bg-primary/15 text-primary"
										: "bg-muted text-muted-foreground"
								}
							>
								{role === "OWNER" ? "域主" : "成员"}
							</Badge>
						</div>
					))}
				</div>
			</div>

			{/* Actions */}
			<div className="flex flex-col gap-2.5">
				{isMember ? (
					<>
						<Link href="/run">
							<Button className="w-full gap-2 bg-primary font-heading font-semibold text-primary-foreground hover:bg-primary/90">
								<Play className="size-4" />
								开始跑步
							</Button>
						</Link>
						{activeCode && <CopyButton code={activeCode} />}
					</>
				) : (
					<Link href="/playground/join">
						<Button className="w-full gap-2 bg-primary font-heading font-semibold text-primary-foreground">
							<LogOut className="size-4" />
							加入此域
						</Button>
					</Link>
				)}
				<Link href={`/leaderboard?playgroundId=${pg.id}`}>
					<Button
						variant="outline"
						className="w-full gap-2 border-border font-heading font-semibold"
					>
						<Trophy className="size-4" />
						查看排行榜
					</Button>
				</Link>
			</div>

			{/* Danger Zone — Owner only */}
			{isOwner && (
				<div className="flex flex-col gap-2">
					<Separator className="bg-border" />
					<p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
						危险操作
					</p>
					<form
						action={async () => {
							"use server";
							await deletePlayGround(id);
						}}
					>
						<Button
							variant="outline"
							className="w-full gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
						>
							<Trash2 className="size-4" />
							删除域
						</Button>
					</form>
					{!isOwner && (
						<form
							action={async () => {
								"use server";
								await leavePlayGround(id);
							}}
						>
							<Button variant="outline" className="w-full gap-2 border-border">
								<LogOut className="size-4" />
								退出域
							</Button>
						</form>
					)}
				</div>
			)}
		</div>
	);
}
