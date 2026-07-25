"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Users, Activity, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
	{ href: "/dashboard", label: "首页", icon: House },
	{ href: "/playground/join", label: "约跑", icon: Users },
	{ href: "/run", label: "记录", icon: Activity },
	{ href: "/leaderboard", label: "排行", icon: Trophy },
	{ href: "/settings", label: "我的", icon: User },
] as const;

export function TabBar() {
	const pathname = usePathname();

	return (
		<nav className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit justify-center">
			<div className="flex items-center gap-1 rounded-full border border-border bg-[#1A1A1ACC] px-1.5 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.25)] backdrop-blur-xl">
				{tabs.map(({ href, label, icon: Icon }) => {
					const isActive =
						href === "/dashboard"
							? pathname === "/dashboard"
							: pathname.startsWith(href);
					return (
						<Link
							key={href}
							href={href}
							className={cn(
								"flex min-w-16 flex-col items-center gap-0.5 rounded-full px-3 py-1.5 transition-colors",
								isActive
									? "text-primary"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<Icon className="size-[22px]" />
							<span className="text-[10px] leading-none">{label}</span>
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
