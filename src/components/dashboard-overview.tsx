"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
	ActivityIcon,
	Clock3Icon,
	FootprintsIcon,
	Loader2Icon,
	LogOutIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { signOut } from "@/lib/auth-client";

type DashboardUser = { name: string; email: string; image?: string | null };

export function DashboardOverview({ user }: { user: DashboardUser }) {
	const router = useRouter();
	const [isSigningOut, setIsSigningOut] = useState(false);

	async function handleSignOut() {
		setIsSigningOut(true);
		try {
			const response = await signOut();
			if (response.error) {
				toast.error("退出失败，请稍后重试。");
				return;
			}
			router.replace("/login");
			router.refresh();
		} catch {
			toast.error("网络连接失败，请稍后重试。");
		} finally {
			setIsSigningOut(false);
		}
	}

	return (
		<main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6">
			<header className="flex items-center justify-between gap-4 border-b border-border pb-6">
				<div className="flex min-w-0 items-center gap-3">
					<Avatar size="lg">
						<AvatarImage src={user.image ?? undefined} alt="" />
						<AvatarFallback className="bg-primary/15 font-semibold text-primary">
							{user.name.slice(0, 1).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
						<p className="truncate text-sm text-muted-foreground">欢迎回来</p>
						<h1 className="truncate text-xl font-semibold">{user.name}</h1>
					</div>
				</div>
				<Button
					variant="outline"
					onClick={handleSignOut}
					disabled={isSigningOut}
				>
					{isSigningOut ? (
						<Loader2Icon className="animate-spin" />
					) : (
						<LogOutIcon />
					)}
					<span className="hidden sm:inline">退出登录</span>
				</Button>
			</header>
			<section className="py-8">
				<div className="mb-5">
					<h2 className="text-2xl font-semibold">跑步概览</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						你的 Runner 账号已经准备就绪。
					</p>
				</div>
				<div className="grid gap-4 sm:grid-cols-3">
					<StatCard
						icon={FootprintsIcon}
						label="累计里程"
						value="0.0"
						unit="公里"
					/>
					<StatCard icon={Clock3Icon} label="累计时长" value="0" unit="小时" />
					<StatCard icon={ActivityIcon} label="跑步次数" value="0" unit="次" />
				</div>
			</section>
			<Card>
				<CardHeader>
					<CardTitle>开始第一段旅程</CardTitle>
					<CardDescription>
						定位与跑步记录功能将在下一阶段接入。
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button disabled>
						<ActivityIcon />
						开始跑步
					</Button>
				</CardContent>
			</Card>
		</main>
	);
}

function StatCard({
	icon: Icon,
	label,
	value,
	unit,
}: {
	icon: typeof ActivityIcon;
	label: string;
	value: string;
	unit: string;
}) {
	return (
		<Card>
			<CardContent className="flex items-center justify-between gap-4">
				<div>
					<p className="text-sm text-muted-foreground">{label}</p>
					<p className="mt-2 font-mono text-2xl font-semibold">
						{value}{" "}
						<span className="font-sans text-sm font-normal text-muted-foreground">
							{unit}
						</span>
					</p>
				</div>
				<div className="flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
					<Icon className="size-5" />
				</div>
			</CardContent>
		</Card>
	);
}
