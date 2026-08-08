"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, Globe, Lock, Users } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface PlaygroundItem {
	id: string;
	name: string;
	description: string | null;
	visibility: "PUBLIC" | "PRIVATE";
	_count: { members: number };
}

export default function JoinPlayGroundPage() {
	const router = useRouter();
	const [inviteCode, setInviteCode] = useState("");
	const [isJoining, setIsJoining] = useState(false);
	const [publicPlaygrounds, setPublicPlaygrounds] = useState<PlaygroundItem[]>(
		[],
	);
	const [isLoadingPublic, setIsLoadingPublic] = useState(true);

	useEffect(() => {
		loadPublicPlaygrounds();
	}, []);

	const loadPublicPlaygrounds = async () => {
		try {
			const response = await fetch(
				"/api/playgrounds?visibility=PUBLIC&take=20",
			);
			if (!response.ok) throw new Error("加载失败");

			const data = await response.json();
			setPublicPlaygrounds(data.playgrounds || []);
		} catch (error) {
			toast.error(
				"加载公开域失败" + (error instanceof Error ? `: ${error.message}` : ""),
			);
		} finally {
			setIsLoadingPublic(false);
		}
	};

	const handleJoinByCode = async () => {
		const code = inviteCode.trim();
		if (!code) {
			toast.error("请输入邀请码");
			return;
		}

		setIsJoining(true);

		try {
			// First, find which playground this code belongs to
			const playgrounds = await fetch("/api/playgrounds").then((r) => r.json());

			let targetPlaygroundId: string | null = null;

			for (const pg of playgrounds.playgrounds || []) {
				const joinResponse = await fetch(`/api/playgrounds/${pg.id}/join`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ inviteCode: code }),
				});

				if (joinResponse.ok) {
					targetPlaygroundId = pg.id;
					break;
				}
			}

			if (targetPlaygroundId) {
				toast.success("加入成功");
				router.push(`/playground/${targetPlaygroundId}`);
			} else {
				toast.error("邀请码无效或已过期");
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "加入失败");
		} finally {
			setIsJoining(false);
		}
	};

	const handleJoinPublic = async (playgroundId: string) => {
		try {
			const response = await fetch(`/api/playgrounds/${playgroundId}/join`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "加入失败");
			}

			toast.success("加入成功");
			router.push(`/playground/${playgroundId}`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "加入失败");
		}
	};

	return (
		<div className="flex flex-col gap-6 px-5 py-6">
			{/* Header */}
			<div className="flex items-center gap-3">
				<Link href="/dashboard">
					<Button variant="ghost" size="icon" className="size-9">
						<ArrowLeft className="size-5" />
					</Button>
				</Link>
				<h1 className="font-heading text-xl font-semibold text-foreground">
					加入域
				</h1>
			</div>

			{/* Join by Invite Code */}
			<Card className="border-border bg-card">
				<CardContent className="flex flex-col gap-4 p-5">
					<div className="flex items-center gap-2">
						<Lock className="size-4 text-muted-foreground" />
						<span className="text-[12px] font-semibold text-muted-foreground">
							通过邀请码加入
						</span>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label
							htmlFor="inviteCode"
							className="text-[12px] font-semibold text-muted-foreground"
						>
							邀请码
						</Label>
						<Input
							id="inviteCode"
							placeholder="输入6位邀请码"
							value={inviteCode}
							onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
							maxLength={6}
							disabled={isJoining}
							className="border-border bg-background text-center font-mono text-lg tracking-[4px]"
						/>
					</div>

					<Button
						onClick={handleJoinByCode}
						disabled={isJoining || !inviteCode.trim()}
						className="w-full gap-2 bg-primary font-heading font-semibold text-primary-foreground hover:bg-primary/90"
						size="lg"
					>
						{isJoining ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								加入中...
							</>
						) : (
							"加入域"
						)}
					</Button>
				</CardContent>
			</Card>

			<div className="flex items-center gap-3">
				<Separator className="flex-1" />
				<span className="text-[12px] text-muted-foreground">或</span>
				<Separator className="flex-1" />
			</div>

			{/* Public Playgrounds */}
			<div className="flex flex-col gap-3">
				<div className="flex items-center gap-2 px-1">
					<Globe className="size-4 text-muted-foreground" />
					<span className="text-[12px] font-semibold text-muted-foreground">
						公开域
					</span>
				</div>

				{isLoadingPublic ? (
					<Card className="border-border bg-card">
						<CardContent className="flex items-center justify-center p-8">
							<Loader2 className="size-6 animate-spin text-muted-foreground" />
						</CardContent>
					</Card>
				) : publicPlaygrounds.length === 0 ? (
					<Card className="border-border bg-card">
						<CardContent className="flex flex-col items-center gap-2 p-8">
							<Globe className="size-8 text-muted-foreground/50" />
							<span className="text-sm text-muted-foreground">暂无公开域</span>
						</CardContent>
					</Card>
				) : (
					<div className="flex flex-col gap-3">
						{publicPlaygrounds.map((playground) => (
							<Card
								key={playground.id}
								className="border-border bg-card transition-colors hover:bg-card/80"
							>
								<CardContent className="flex items-center justify-between gap-4 p-5">
									<div className="flex flex-1 flex-col gap-1">
										<div className="flex items-center gap-2">
											<span className="font-heading font-semibold text-foreground">
												{playground.name}
											</span>
											<Globe className="size-3.5 text-primary" />
										</div>
										{playground.description && (
											<span className="text-[12px] text-muted-foreground">
												{playground.description}
											</span>
										)}
										<div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
											<Users className="size-3" />
											<span>{playground._count.members} 成员</span>
										</div>
									</div>
									<Button
										onClick={() => handleJoinPublic(playground.id)}
										variant="outline"
										size="sm"
										className="shrink-0"
									>
										加入
									</Button>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
