"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon, LockKeyholeIcon, MailIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { resendOtp } from "@/lib/actions";
import { signIn } from "@/lib/auth-client";

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [needsVerification, setNeedsVerification] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isResending, setIsResending] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setNeedsVerification(false);
		setIsSubmitting(true);
		try {
			const response = await signIn.email({
				email: email.trim(),
				password,
				rememberMe: true,
			});
			if (response.error) {
				const unverified = response.error.code === "EMAIL_NOT_VERIFIED";
				setNeedsVerification(unverified);
				setError(
					unverified
						? "请先完成邮箱验证。"
						: "邮箱或密码不正确。请检查后重试。",
				);
				return;
			}
			const next = new URLSearchParams(window.location.search).get("next");
			router.replace(
				next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard",
			);
			router.refresh();
		} catch {
			setError("网络连接失败，请检查网络后重试。");
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleResend() {
		setIsResending(true);
		try {
			const result = await resendOtp(email, "email-verification");
			if (result.success) toast.success("验证码已重新发送");
			else toast.error(result.error);
		} catch {
			toast.error("网络连接失败，请稍后重试。");
		} finally {
			setIsResending(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">欢迎回来</CardTitle>
				<CardDescription>使用邮箱和密码登录 Runner。</CardDescription>
			</CardHeader>
			<CardContent>
				<form className="space-y-4" onSubmit={handleSubmit}>
					<label className="block space-y-2">
						<span className="text-sm font-medium">邮箱</span>
						<div className="relative">
							<MailIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								type="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								required
								autoComplete="email"
								placeholder="you@example.com"
								className="pl-9"
							/>
						</div>
					</label>
					<label className="block space-y-2">
						<span className="flex items-center justify-between text-sm font-medium">
							密码
							<Link
								href="/forgot-password"
								className="text-primary hover:underline"
							>
								忘记密码？
							</Link>
						</span>
						<div className="relative">
							<LockKeyholeIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								type="password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								required
								minLength={8}
								autoComplete="current-password"
								placeholder="至少 8 位"
								className="pl-9"
							/>
						</div>
					</label>
					{error ? (
						<p
							role="alert"
							className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
						>
							{error}
						</p>
					) : null}
					{needsVerification ? (
						<Button
							type="button"
							variant="outline"
							className="w-full"
							onClick={handleResend}
							disabled={isResending}
						>
							{isResending ? <Loader2Icon className="animate-spin" /> : null}
							重新发送验证邮件
						</Button>
					) : null}
					<Button type="submit" className="w-full" disabled={isSubmitting}>
						{isSubmitting ? <Loader2Icon className="animate-spin" /> : null}登录
					</Button>
				</form>
				<p className="mt-5 text-center text-sm text-muted-foreground">
					还没有账号？{" "}
					<Link
						href="/register"
						className="font-medium text-primary hover:underline"
					>
						去注册
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}
