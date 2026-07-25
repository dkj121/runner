import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
	User,
	Settings2,
	Headphones,
	Radio,
	Link2,
	Watch,
	LogOut,
	ChevronRight,
} from "lucide-react";

export default async function SettingsPage() {
	const session = await auth.api.getSession({ headers: await headers() });
	const user = session?.user;
	if (!user) return null;

	return (
		<div className="flex flex-col gap-6 px-5 py-6">
			{/* Profile Card */}
			<Card className="border-border bg-card">
				<CardContent className="flex items-center gap-4 p-5">
					<Avatar className="size-14 ring-2 ring-primary/20">
						<AvatarFallback className="bg-primary font-heading text-xl font-semibold text-primary-foreground">
							{(user.name ?? "R")[0].toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="flex flex-col gap-0.5">
						<p className="font-heading text-lg font-semibold text-foreground">
							{user.name}
						</p>
						<p className="text-sm text-muted-foreground">{user.email}</p>
					</div>
					<ChevronRight className="ml-auto size-4 text-muted-foreground" />
				</CardContent>
			</Card>

			{/* Running Presets */}
			<div>
				<h2 className="mb-3 flex items-center gap-2 font-heading text-base font-semibold text-foreground">
					<Settings2 className="size-4 text-primary" />
					跑步预设
				</h2>
				<div className="flex flex-col gap-0.5">
					{[
						{ label: "音频提示", desc: "配速提醒、里程播报", icon: Headphones },
						{ label: "语音播报", desc: "实时跑步数据语音播报", icon: Radio },
					].map(({ label, desc, icon: Icon }) => (
						<Card key={label} className="border-border bg-card">
							<CardContent className="flex items-center gap-3 px-4 py-3.5">
								<Icon className="size-5 text-primary" />
								<div className="flex-1">
									<p className="text-sm font-medium text-foreground">{label}</p>
									<p className="text-[11px] text-muted-foreground">{desc}</p>
								</div>
								<Switch />
							</CardContent>
						</Card>
					))}
				</div>
			</div>

			{/* Third-party integrations */}
			<div>
				<h2 className="mb-3 flex items-center gap-2 font-heading text-base font-semibold text-foreground">
					<Link2 className="size-4 text-primary" />
					第三方关联
				</h2>
				<div className="flex flex-col gap-0.5">
					<Card className="border-border bg-card">
						<CardContent className="flex items-center gap-3 px-4 py-3.5">
							<div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/15">
								<span className="text-sm font-bold text-emerald-400">微</span>
							</div>
							<div className="flex-1">
								<p className="text-sm font-medium text-foreground">微信运动</p>
								<p className="text-[11px] text-muted-foreground">
									未绑定 · 同步步数与跑步数据
								</p>
							</div>
							<Button variant="outline" size="sm" className="border-border">
								绑定
							</Button>
						</CardContent>
					</Card>
					<Card className="border-border bg-card">
						<CardContent className="flex items-center gap-3 px-4 py-3.5">
							<Watch className="size-5 text-primary" />
							<div className="flex-1">
								<p className="text-sm font-medium text-foreground">运动设备</p>
								<p className="text-[11px] text-muted-foreground">
									Apple Watch · Garmin · 小米手环
								</p>
							</div>
							<ChevronRight className="size-4 text-muted-foreground" />
						</CardContent>
					</Card>
				</div>
			</div>

			<Separator className="bg-border" />

			{/* Logout */}
			<form
				action={async () => {
					"use server";
					const { auth: serverAuth } = await import("@/lib/auth");
					await serverAuth.api.signOut({
						headers: await headers(),
					});
				}}
			>
				<Button
					variant="outline"
					className="w-full gap-2 border-red-500/30 font-heading font-semibold text-red-400 hover:bg-red-500/10"
				>
					<LogOut className="size-4" />
					退出登录
				</Button>
			</form>
		</div>
	);
}
