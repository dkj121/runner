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
import { authClient } from "@/lib/auth-client";

type Step = "email" | "otp" | "password";

export default function ForgotPasswordPage() {
	const router = useRouter();
	const [step, setStep] = useState<Step>("email");
	const [email, setEmail] = useState("");
	const [otp, setOtp] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function submitEmail(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setIsSubmitting(true);
		try {
			const response = await authClient.emailOtp.requestPasswordReset({
				email: email.trim(),
			});
			if (response.error)
				return setError(response.error.message ?? "验证码发送失败。");
			setStep("otp");
			toast.success("验证码已发送");
		} catch {
			setError("网络连接失败，请检查网络后重试。");
		} finally {
			setIsSubmitting(false);
		}
	}

	async function checkOtp(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setIsSubmitting(true);
		try {
			const response = await authClient.emailOtp.checkVerificationOtp({
				email: email.trim(),
				type: "forget-password",
				otp,
			});
			if (response.error)
				return setError(response.error.message ?? "验证码无效或已过期。");
			setStep("password");
		} catch {
			setError("网络连接失败，请检查网络后重试。");
		} finally {
			setIsSubmitting(false);
		}
	}

	async function resetPassword(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		if (password !== confirmPassword) return setError("两次输入的密码不一致。");
		if (password.length < 8) return setError("密码至少需要 8 位。");
		setIsSubmitting(true);
		try {
			const response = await authClient.emailOtp.resetPassword({
				email: email.trim(),
				otp,
				password,
			});
			if (response.error)
				return setError(
					response.error.message ?? "密码重置失败，请重新获取验证码。",
				);
			toast.success("密码已重置，请重新登录");
			router.replace("/login");
		} catch {
			setError("网络连接失败，请检查网络后重试。");
		} finally {
			setIsSubmitting(false);
		}
	}

	const descriptions: Record<Step, string> = {
		email: "输入注册邮箱，我们会发送一封验证码邮件。",
		otp: `输入发送至 ${email} 的 6 位验证码。`,
		password: "设置一个至少 8 位的新密码。",
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">重置密码</CardTitle>
				<CardDescription>{descriptions[step]}</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="mb-5 grid grid-cols-3 gap-2" aria-label="重置密码进度">
					{["邮箱", "验证", "新密码"].map((label, index) => {
						const current = ["email", "otp", "password"].indexOf(step);
						return (
							<div key={label} className="space-y-2">
								<div
									className={
										index <= current
											? "h-1 rounded-full bg-primary"
											: "h-1 rounded-full bg-muted"
									}
								/>
								<span className="text-xs text-muted-foreground">{label}</span>
							</div>
						);
					})}
				</div>
				{step === "email" ? (
					<form className="space-y-4" onSubmit={submitEmail}>
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
						{error ? <ErrorMessage>{error}</ErrorMessage> : null}
						<SubmitButton loading={isSubmitting}>发送验证码</SubmitButton>
					</form>
				) : null}
				{step === "otp" ? (
					<form className="space-y-4" onSubmit={checkOtp}>
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
						{error ? <ErrorMessage>{error}</ErrorMessage> : null}
						<SubmitButton loading={isSubmitting} disabled={otp.length !== 6}>
							验证
						</SubmitButton>
						<Button
							type="button"
							variant="ghost"
							className="w-full"
							onClick={() => setStep("email")}
						>
							修改邮箱
						</Button>
					</form>
				) : null}
				{step === "password" ? (
					<form className="space-y-4" onSubmit={resetPassword}>
						<label className="block space-y-2">
							<span className="text-sm font-medium">新密码</span>
							<Input
								type="password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								required
								minLength={8}
								autoComplete="new-password"
							/>
						</label>
						<label className="block space-y-2">
							<span className="text-sm font-medium">确认新密码</span>
							<Input
								type="password"
								value={confirmPassword}
								onChange={(event) => setConfirmPassword(event.target.value)}
								required
								minLength={8}
								autoComplete="new-password"
							/>
						</label>
						{error ? <ErrorMessage>{error}</ErrorMessage> : null}
						<SubmitButton loading={isSubmitting}>保存新密码</SubmitButton>
					</form>
				) : null}
				<p className="mt-5 text-center text-sm">
					<Link href="/login" className="text-primary hover:underline">
						返回登录
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
	return (
		<p
			role="alert"
			className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
		>
			{children}
		</p>
	);
}

function SubmitButton({
	children,
	loading,
	disabled = false,
}: {
	children: React.ReactNode;
	loading: boolean;
	disabled?: boolean;
}) {
	return (
		<Button type="submit" className="w-full" disabled={loading || disabled}>
			{loading ? <Loader2Icon className="animate-spin" /> : null}
			{children}
		</Button>
	);
}
