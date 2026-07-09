"use client";

import {
	Home,
	Activity,
	ChartNoAxesColumn,
	Trophy,
	User,
} from "lucide-react";
import Link from "next/link";

const tabs = [
	{ icon: Home, label: "首页", href: "/" },
	{ icon: Activity, label: "跑步", href: "/run" },
	{ icon: ChartNoAxesColumn, label: "记录", href: "/records" },
	{ icon: Trophy, label: "排行", href: "/rank" },
	{ icon: User, label: "我的", href: "/profile" },
] as const;

export function BottomNav({ active }: { active: string }) {
	return (
		<nav className="mx-4 mb-4 flex items-center justify-between rounded-full border border-border bg-card/90 px-6 py-3 shadow-lg backdrop-blur-sm">
			{tabs.map((tab) => (
				<Link
					key={tab.label}
					href={tab.href}
					className={`flex flex-col items-center gap-0.5 ${
						tab.href === active ? "text-primary" : "text-muted-foreground"
					}`}
				>
					<tab.icon className="h-5 w-5" />
					<span className="text-[10px]">{tab.label}</span>
				</Link>
			))}
		</nav>
	);
}
