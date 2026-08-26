"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
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
import { authClient, signUp } from "@/lib/auth-client";

export default function RegisterPage() {
	const router = useRouter();
	const [step, setStep] = useState<"details" | "otp">("details");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [otp, setOtp] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isResending, setIsResending] = useState(false);

	async function register(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		if (password !== confirmPassword) return setError("两次输入的密码不一致。");
		if (password.length < 8) return setError("密码至少需要 8 位。");
		setIsSubmitting(true);
		try {
			const response = await signUp.email({
				name: name.trim(),
				email: email.trim(),
				password,
			});
			if (response.error)
				return setError(response.error.message ?? "注册失败，请稍后重试。");
			setStep("otp");
			toast.success("验证码已发送到你的邮箱");
		} catch {
			setError("网络连接失败，请检查网络后重试。");
		} finally {
			setIsSubmitting(false);
		}
	}

	async function verify(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setIsSubmitting(true);
		try {
			const response = await authClient.emailOtp.verifyEmail({
				email: email.trim(),
				otp,
			});
			if (response.error)
				return setError(response.error.message ?? "验证码无效或已过期。");
			toast.success("邮箱验证成功");
			router.replace("/dashboard");
			router.refresh();
		} catch {
			setError("网络连接失败，请检查网络后重试。");
		} finally {
			setIsSubmitting(false);
		}
	}

	async function resend() {
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
				<CardTitle className="text-xl">
					{step === "details" ? "创建账号" : "验证邮箱"}
				</CardTitle>
				<CardDescription>
					{step === "details"
						? "注册后即可同步你的 Runner 数据。"
						: `输入发送至 ${email} 的 6 位验证码。`}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{step === "details" ? (
					<form className="space-y-4" onSubmit={register}>
						<label className="block space-y-2">
							<span className="text-sm font-medium">昵称</span>
							<Input
								value={name}
								onChange={(event) => setName(event.target.value)}
								required
								minLength={2}
								autoComplete="name"
								placeholder="你的昵称"
							/>
						</label>
						<label className="block space-y-2">
							<span className="text-sm font-medium">邮箱</span>
							<Input
								type="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								required
								autoComplete="email"
								placeholder="you@example.com"
							/>
						</label>
						<label className="block space-y-2">
							<span className="text-sm font-medium">密码</span>
							<Input
								type="password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								required
								minLength={8}
								autoComplete="new-password"
								placeholder="至少 8 位"
							/>
						</label>
						<label className="block space-y-2">
							<span className="text-sm font-medium">确认密码</span>
							<Input
								type="password"
								value={confirmPassword}
								onChange={(event) => setConfirmPassword(event.target.value)}
								required
								minLength={8}
								autoComplete="new-password"
								placeholder="再次输入密码"
							/>
						</label>
						{error ? (
							<p
								role="alert"
								className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
							>
								{error}
							</p>
						) : null}
						<Button type="submit" className="w-full" disabled={isSubmitting}>
							{isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
							注册并发送验证码
						</Button>
					</form>
				) : (
					<form className="space-y-4" onSubmit={verify}>
						<label className="block space-y-2">
							<span className="text-sm font-medium">验证码</span>
							<Input
								value={otp}
								onChange={(event) =>
									setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
								}
								required
								minLength={6}
								inputMode="numeric"
								autoComplete="one-time-code"
								placeholder="000000"
								className="h-12 text-center font-mono text-xl tracking-[0.45em]"
							/>
						</label>
						{error ? (
							<p
								role="alert"
								className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
							>
								{error}
							</p>
						) : null}
						<Button
							type="submit"
							className="w-full"
							disabled={isSubmitting || otp.length !== 6}
						>
							{isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
							验证并进入 Runner
						</Button>
						<div className="flex justify-between">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setStep("details")}
							>
								修改邮箱
							</Button>
							<Button
								type="button"
								variant="ghost"
								onClick={resend}
								disabled={isResending}
							>
								{isResending ? <Loader2Icon className="animate-spin" /> : null}
								重新发送
							</Button>
						</div>
					</form>
				)}
				<p className="mt-5 text-center text-sm text-muted-foreground">
					已经有账号？{" "}
					<Link
						href="/login"
						className="font-medium text-primary hover:underline"
					>
						去登录
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}
