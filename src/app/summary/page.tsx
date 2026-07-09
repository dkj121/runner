"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { BottomNav } from "@/components/bottom-nav";

const paceData = [
	{ km: "1", pace: "5'50\"", barH: 56, barColor: "bg-primary" },
	{ km: "2", pace: "6'20\"", barH: 64, barColor: "bg-orange-500" },
	{ km: "3", pace: "6'35\"", barH: 68, barColor: "bg-orange-500" },
	{ km: "4", pace: "6'10\"", barH: 60, barColor: "bg-primary" },
	{ km: "5", pace: "6'42\"", barH: 72, barColor: "bg-orange-500" },
	{ km: "6", pace: "5'45\"", barH: 52, barColor: "bg-primary" },
];

const splitData = [
	{ km: "1", pace: "5'50\"", heart: "142", elevation: "+12m" },
	{ km: "2", pace: "6'20\"", heart: "155", elevation: "+8m" },
	{ km: "3", pace: "6'35\"", heart: "160", elevation: "-3m" },
	{ km: "4", pace: "6'10\"", heart: "158", elevation: "+5m" },
	{ km: "5", pace: "6'42\"", heart: "165", elevation: "+15m" },
	{ km: "6", pace: "5'45\"", heart: "170", elevation: "-10m" },
];

export default function SummaryPage() {
	return (
		<div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
			<div className="flex flex-1 flex-col gap-5 px-5 pb-4 pt-4">
				<div className="flex items-center gap-3">
					<Link href="/run">
						<ArrowLeft className="h-5 w-5 text-foreground" />
					</Link>
					<h1 className="font-heading text-xl font-semibold text-foreground">
						跑步汇总
					</h1>
				</div>

				<Card className="items-center gap-2 border border-[var(--color-primary)/20] py-6 shadow-[0_0_40px_hsl(22_100%_56%/0.08)]">
					<div className="font-mono text-5xl font-bold tracking-tighter text-primary">
						5.23
					</div>
					<div className="text-sm text-muted-foreground">公里</div>
					<div className="text-[13px] text-muted-foreground">
						2024年6月5日 19:32 — 20:09
					</div>
				</Card>

				<div className="flex gap-2.5">
					{[
						{ value: "32:37", label: "用时" },
						{ value: "6'14\"", label: "配速", accent: true },
						{ value: "344", label: "卡路里" },
						{ value: "173", label: "步频" },
					].map((d) => (
						<Card
							key={d.label}
							size="sm"
							className="flex-1 items-center gap-0.5 py-3"
						>
							<span
								className={`text-lg font-semibold ${
									d.accent ? "text-primary" : "text-foreground"
								}`}
							>
								{d.value}
							</span>
							<span className="text-[11px] text-muted-foreground">
								{d.label}
							</span>
						</Card>
					))}
				</div>

				<Card className="gap-3 p-4">
					<div className="flex items-center justify-between">
						<span className="font-heading text-[15px] font-semibold text-foreground">
							配速分析
						</span>
						<span className="text-xs text-muted-foreground">每公里 ▼</span>
					</div>
					<div className="flex items-end justify-between gap-3">
						{paceData.map((d) => (
							<div
								key={d.km}
								className="flex flex-1 flex-col items-center gap-1"
							>
								<span className="text-[9px] text-muted-foreground">
									{d.pace}
								</span>
								<div
									className={`w-7 rounded-md ${d.barColor}`}
									style={{ height: d.barH * 0.8 }}
								/>
								<span className="text-[10px] text-muted-foreground">
									{d.km}
								</span>
							</div>
						))}
					</div>
				</Card>

				<div>
					<h2 className="mb-2 font-heading text-[15px] font-semibold text-foreground">
						分段详情
					</h2>
					<div className="overflow-hidden rounded-xl border border-border bg-card">
						<div className="flex gap-2 px-3.5 py-2.5">
							{["公里", "配速", "心率", "海拔"].map((h) => (
								<div
									key={h}
									className="flex-1 text-center text-[11px] font-semibold text-muted-foreground"
								>
									{h}
								</div>
							))}
						</div>
						{splitData.map((row, i) => (
							<div
								key={row.km}
								className={`flex gap-2 px-3.5 py-2.5 ${
									i < splitData.length - 1 ? "border-t border-border" : ""
								}`}
							>
								<div className="flex-1 text-center text-[13px] text-foreground">
									{row.km}
								</div>
								<div className="flex-1 text-center text-[13px] text-foreground">
									{row.pace}
								</div>
								<div className="flex-1 text-center text-[13px] text-foreground">
									{row.heart}
								</div>
								<div className="flex-1 text-center text-[13px] text-foreground">
									{row.elevation}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			<BottomNav active="/records" />
		</div>
	);
}
