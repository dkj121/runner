"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPlayGround } from "@/lib/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, LinkIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function CreatePlayGroundPage() {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const [name, setName] = useState("");
	const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
	const [description, setDescription] = useState("");
	const [inviteCode, setInviteCode] = useState<string | null>(null);

	async function handleCreate() {
		if (!name.trim()) return;
		setPending(true);
		try {
			const result = await createPlayGround({
				name: name.trim(),
				visibility,
				description: description.trim() || undefined,
			});
			setInviteCode(result.inviteCode);
			toast.success("域创建成功");
			router.push(`/playground/${result.playground.id}`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "创建失败");
		} finally {
			setPending(false);
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
					创建约跑
				</h1>
			</div>

			<Card className="border-border bg-card">
				<CardContent className="flex flex-col gap-4 p-5">
					{/* Name */}
					<div className="flex flex-col gap-1.5">
						<Label
							htmlFor="name"
							className="text-[12px] font-semibold text-muted-foreground"
						>
							域名称
						</Label>
						<Input
							id="name"
							placeholder="输入域名称"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="border-border bg-background"
						/>
					</div>

					{/* Visibility */}
					<div className="flex flex-col gap-1.5">
						<Label className="text-[12px] font-semibold text-muted-foreground">
							可见性
						</Label>
						<Select
							value={visibility}
							onValueChange={(v) => setVisibility(v as "PUBLIC" | "PRIVATE")}
						>
							<SelectTrigger className="border-border bg-background">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="PUBLIC">公开 — 任何人可发现</SelectItem>
								<SelectItem value="PRIVATE">私有 — 仅通过邀请码加入</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Description */}
					<div className="flex flex-col gap-1.5">
						<Label
							htmlFor="desc"
							className="text-[12px] font-semibold text-muted-foreground"
						>
							描述（可选）
						</Label>
						<Textarea
							id="desc"
							placeholder="介绍一下你的域..."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={3}
							className="resize-none border-border bg-background"
						/>
					</div>

					{/* Submit */}
					<Button
						onClick={handleCreate}
						disabled={pending || !name.trim()}
						className="w-full gap-2 bg-primary font-heading font-semibold text-primary-foreground hover:bg-primary/90"
						size="lg"
					>
						{pending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<LinkIcon className="size-4" />
						)}
						{pending ? "创建中..." : "生成邀请码并创建"}
					</Button>
				</CardContent>
			</Card>

			{inviteCode && (
				<Card className="border-border bg-card">
					<CardContent className="flex flex-col items-center gap-3 p-5">
						<span className="text-[12px] text-muted-foreground">邀请码</span>
						<span className="font-heading font-mono text-[28px] font-bold tracking-[4px] text-primary">
							{inviteCode}
						</span>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
