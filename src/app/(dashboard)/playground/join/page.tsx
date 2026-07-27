"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { joinPlayGroundByInvite, listPublicPlayGrounds } from "@/lib/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, ArrowLeft, LogIn, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function JoinPlayGroundPage() {
	const router = useRouter();
	const [code, setCode] = useState("");
	const [joining, setJoining] = useState(false);
	const [publicList, setPublicList] = useState<
		Awaited<ReturnType<typeof listPublicPlayGrounds>>
	>([]);

	useEffect(() => {
		listPublicPlayGrounds().then(setPublicList).catch(console.error);
	}, []);

	async function handleJoinCode() {
		if (!code.trim()) return;
		setJoining(true);
		try {
			const pg = await joinPlayGroundByInvite(code.trim().toUpperCase());
			toast.success(`已加入 ${pg.name}`);
			router.push(`/playground/${pg.id}`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "加入失败");
		} finally {
			setJoining(false);
		}
	}

	async function handleJoinPublic(playGroundId: string, name: string) {
		try {
			// Direct join for public domains — we still need the inviteCode mechanism
			// For public domains, the server action uses the playground's active invite code
			await joinPlayGroundByInvite(playGroundId);
			toast.success(`已加入 ${name}`);
			router.push(`/playground/${playGroundId}`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "加入失败");
		}
	}

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
					加入约跑
				</h1>
			</div>

			{/* Invite Code Section */}
			<Card className="border-border bg-card">
				<CardContent className="flex flex-col items-center gap-4 px-5 py-8">
					<div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15">
						<UserPlus className="size-6 text-primary" />
					</div>
					<p className="text-sm text-muted-foreground">
						输入域主分享的邀请码加入约跑
					</p>
					<Input
						placeholder="输入邀请码"
						value={code}
						onChange={(e) => setCode(e.target.value.toUpperCase())}
						className="w-64 border-border bg-background text-center font-mono text-xl font-semibold tracking-[3px]"
						maxLength={8}
					/>
					<Button
						onClick={handleJoinCode}
						disabled={joining || !code.trim()}
						className="w-48 gap-2 bg-primary font-heading font-semibold text-primary-foreground"
					>
						{joining ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<LogIn className="size-4" />
						)}
						加入域
					</Button>
				</CardContent>
			</Card>

			{/* Public Domains */}
			<div className="flex items-center gap-3">
				<Separator className="flex-1 bg-border" />
				<span className="shrink-0 text-[12px] text-muted-foreground">
					可加入的公开域
				</span>
				<Separator className="flex-1 bg-border" />
			</div>

			<div className="flex flex-col gap-2.5">
				{publicList.length === 0 && (
					<p className="py-8 text-center text-sm text-muted-foreground">
						暂无公开域
					</p>
				)}
				{publicList.map((pg) => (
					<Card
						key={pg.id}
						className="border-border bg-card transition-colors hover:bg-card/80"
					>
						<CardContent className="flex items-center gap-3 p-4">
							<div className="flex size-10 items-center justify-center rounded-xl bg-primary/15">
								<span className="font-heading text-sm font-bold text-primary">
									{pg.name[0]}
								</span>
							</div>
							<div className="flex-1">
								<p className="text-sm font-semibold text-foreground">
									{pg.name}
								</p>
								<p className="text-[12px] text-muted-foreground">
									{pg._count.users} 人
								</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								className="size-9 text-primary"
								onClick={() => handleJoinPublic(pg.id, pg.name)}
							>
								<ArrowRight className="size-4" />
							</Button>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
