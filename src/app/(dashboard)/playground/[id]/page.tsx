"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	ArrowLeft,
	Loader2,
	Settings,
	LogOut,
	Trash2,
	Globe,
	Lock,
	Crown,
	User,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface PlaygroundData {
	id: string;
	name: string;
	description: string | null;
	visibility: "PUBLIC" | "PRIVATE";
	createdAt: string;
	updatedAt: string;
}

interface Member {
	id: string;
	userId: string;
	playGroundId: string;
	role: "OWNER" | "USER";
	joinedAt: string;
	user: {
		id: string;
		name: string;
		email: string;
		image: string | null;
	};
}

export default function PlayGroundDetailPage() {
	const router = useRouter();
	const params = useParams();
	const playgroundId = params.id as string;

	const [playground, setPlayground] = useState<PlaygroundData | null>(null);
	const [members, setMembers] = useState<Member[]>([]);
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isLeaving, setIsLeaving] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [showLeaveDialog, setShowLeaveDialog] = useState(false);

	const loadData = useCallback(async () => {
		try {
			// Get current user session
			const sessionResponse = await fetch("/api/auth/get-session");
			if (sessionResponse.ok) {
				const session = await sessionResponse.json();
				setCurrentUserId(session.user?.id || null);
			}

			// Get playground details
			const playgroundResponse = await fetch(
				`/api/playgrounds/${playgroundId}`,
			);
			if (!playgroundResponse.ok) {
				throw new Error("加载域信息失败");
			}
			const playgroundData = await playgroundResponse.json();
			setPlayground(playgroundData);

			// Get members
			const membersResponse = await fetch(
				`/api/playgrounds/${playgroundId}/members`,
			);
			if (!membersResponse.ok) {
				throw new Error("加载成员列表失败");
			}
			const membersData = await membersResponse.json();
			setMembers(membersData.members || []);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "加载失败");
			router.push("/dashboard");
		} finally {
			setIsLoading(false);
		}
	}, [playgroundId, router]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const handleDelete = async () => {
		setIsDeleting(true);

		try {
			const response = await fetch(`/api/playgrounds/${playgroundId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "删除失败");
			}

			toast.success("域已删除");
			router.push("/dashboard");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "删除失败");
			setIsDeleting(false);
			setShowDeleteDialog(false);
		}
	};

	const handleLeave = async () => {
		setIsLeaving(true);

		try {
			const response = await fetch(`/api/playgrounds/${playgroundId}/leave`, {
				method: "POST",
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "退出失败");
			}

			toast.success("已退出域");
			router.push("/dashboard");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "退出失败");
			setIsLeaving(false);
			setShowLeaveDialog(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!playground) {
		return null;
	}

	const currentMember = members.find((m) => m.userId === currentUserId);
	const isOwner = currentMember?.role === "OWNER";

	return (
		<div className="flex flex-col gap-6 px-5 py-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Link href="/dashboard">
						<Button variant="ghost" size="icon" className="size-9">
							<ArrowLeft className="size-5" />
						</Button>
					</Link>
					<div className="flex flex-col">
						<div className="flex items-center gap-2">
							<h1 className="font-heading text-xl font-semibold text-foreground">
								{playground.name}
							</h1>
							{playground.visibility === "PUBLIC" ? (
								<Globe className="size-4 text-primary" />
							) : (
								<Lock className="size-4 text-muted-foreground" />
							)}
						</div>
						{playground.description && (
							<span className="text-[12px] text-muted-foreground">
								{playground.description}
							</span>
						)}
					</div>
				</div>
				{isOwner && (
					<Link href={`/playground/${playgroundId}/settings`}>
						<Button variant="ghost" size="icon" className="size-9">
							<Settings className="size-5" />
						</Button>
					</Link>
				)}
			</div>

			{/* Members */}
			<div className="flex flex-col gap-3">
				<div className="px-1">
					<span className="text-[12px] font-semibold text-muted-foreground">
						成员 ({members.length})
					</span>
				</div>

				<Card className="border-border bg-card">
					<CardContent className="flex flex-col divide-y divide-border p-0">
						{members.map((member) => (
							<div
								key={member.id}
								className="flex items-center justify-between gap-4 p-4"
							>
								<div className="flex items-center gap-3">
									<div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
										<User className="size-5 text-primary" />
									</div>
									<div className="flex flex-col">
										<span className="font-semibold text-foreground">
											{member.user.name}
										</span>
										<span className="text-[12px] text-muted-foreground">
											{member.user.email}
										</span>
									</div>
								</div>
								{member.role === "OWNER" && (
									<div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1">
										<Crown className="size-3 text-primary" />
										<span className="text-[11px] font-semibold text-primary">
											域主
										</span>
									</div>
								)}
							</div>
						))}
					</CardContent>
				</Card>
			</div>

			{/* Actions */}
			<div className="flex flex-col gap-3">
				{isOwner ? (
					<Button
						onClick={() => setShowDeleteDialog(true)}
						variant="destructive"
						className="w-full gap-2"
						size="lg"
					>
						<Trash2 className="size-4" />
						删除域
					</Button>
				) : (
					<Button
						onClick={() => setShowLeaveDialog(true)}
						variant="outline"
						className="w-full gap-2"
						size="lg"
					>
						<LogOut className="size-4" />
						退出域
					</Button>
				)}
			</div>

			{/* Delete Dialog */}
			<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>确认删除</DialogTitle>
						<DialogDescription>
							确定要删除「{playground.name}
							」吗？此操作无法撤销，所有成员将被移除。
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowDeleteDialog(false)}
							disabled={isDeleting}
						>
							取消
						</Button>
						<Button
							variant="destructive"
							onClick={handleDelete}
							disabled={isDeleting}
							className="gap-2"
						>
							{isDeleting ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									删除中...
								</>
							) : (
								"确认删除"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Leave Dialog */}
			<Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>确认退出</DialogTitle>
						<DialogDescription>
							确定要退出「{playground.name}」吗？退出后需要重新加入才能访问。
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowLeaveDialog(false)}
							disabled={isLeaving}
						>
							取消
						</Button>
						<Button
							onClick={handleLeave}
							disabled={isLeaving}
							className="gap-2"
						>
							{isLeaving ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									退出中...
								</>
							) : (
								"确认退出"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
