"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formData, setFormData] = useState({
		name: "",
		description: "",
		visibility: "PUBLIC" as "PUBLIC" | "PRIVATE",
	});
	const [generatedCode, setGeneratedCode] = useState<string | null>(null);

	const handleSubmit = async () => {
		if (!formData.name.trim()) {
			toast.error("请输入域名称");
			return;
		}

		setIsSubmitting(true);

		try {
			// Create playground
			const createResponse = await fetch("/api/playgrounds", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: formData.name.trim(),
					description: formData.description.trim() || undefined,
					visibility: formData.visibility,
				}),
			});

			if (!createResponse.ok) {
				const error = await createResponse.json();
				throw new Error(error.error || "创建失败");
			}

			const playground = await createResponse.json();

			// Generate invite code
			const codeResponse = await fetch(
				`/api/playgrounds/${playground.id}/invite-codes`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
				},
			);

			if (codeResponse.ok) {
				const codeData = await codeResponse.json();
				setGeneratedCode(codeData.code);
			}

			toast.success("域创建成功");
			router.push(`/playground/${playground.id}`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "创建失败");
			setIsSubmitting(false);
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
					创建约跑
				</h1>
			</div>

			{/* Form */}
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
							value={formData.name}
							onChange={(e) =>
								setFormData((prev) => ({ ...prev, name: e.target.value }))
							}
							disabled={isSubmitting}
							className="border-border bg-background"
						/>
					</div>

					{/* Visibility */}
					<div className="flex flex-col gap-1.5">
						<Label className="text-[12px] font-semibold text-muted-foreground">
							可见性
						</Label>
						<Select
							value={formData.visibility}
							onValueChange={(value: "PUBLIC" | "PRIVATE") =>
								setFormData((prev) => ({ ...prev, visibility: value }))
							}
							disabled={isSubmitting}
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
							htmlFor="description"
							className="text-[12px] font-semibold text-muted-foreground"
						>
							描述（可选）
						</Label>
						<Textarea
							id="description"
							placeholder="介绍一下你的域..."
							value={formData.description}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									description: e.target.value,
								}))
							}
							disabled={isSubmitting}
							rows={3}
							className="resize-none border-border bg-background"
						/>
					</div>

					{/* Submit */}
					<Button
						onClick={handleSubmit}
						disabled={isSubmitting || !formData.name.trim()}
						className="w-full gap-2 bg-primary font-heading font-semibold text-primary-foreground hover:bg-primary/90"
						size="lg"
					>
						{isSubmitting ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								创建中...
							</>
						) : (
							<>
								<LinkIcon className="size-4" />
								生成邀请码并创建
							</>
						)}
					</Button>
				</CardContent>
			</Card>

			{/* Generated Invite Code */}
			{generatedCode && (
				<Card className="border-border bg-card">
					<CardContent className="flex flex-col items-center gap-3 p-5">
						<span className="text-[12px] text-muted-foreground">邀请码</span>
						<span className="font-mono text-[28px] font-bold tracking-[4px] text-primary">
							{generatedCode}
						</span>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
