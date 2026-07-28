"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	ActivityIcon,
	ArrowLeftIcon,
	ArrowRightIcon,
	Loader2Icon,
	LockKeyholeIcon,
	MailIcon,
	UserRoundIcon,
} from "lucide-react";

import { signIn, signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AuthMode = "login" | "register";

type AuthPanelProps = {
	mode: AuthMode;
};

export function AuthPanel({ mode }: AuthPanelProps) {
	const router = useRouter();
	const isRegister = mode === "register";
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setNotice(null);

		if (password.length < 8) {
			setError("密码至少需要 8 位。");
			return;
		}

		setIsSubmitting(true);
		try {
			const response = isRegister
				? await signUp.email({
						name: name.trim(),
						email: email.trim(),
						password,
					})
				: await signIn.email({
						email: email.trim(),
						password,
						rememberMe: true,
					});

			if (response.error) {
				setError(response.error.message ?? "请求失败，请稍后再试。");
				return;
			}

			setNotice(isRegister ? "注册成功，正在进入 Runner。" : "登录成功。");
			router.refresh();
			router.push("/");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<main className="flex min-h-screen items-center justify-center px-4 py-10">
			<div className="grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_420px]">
				<section className="space-y-6 text-center lg:text-left">
					<Button asChild variant="ghost" className="mx-auto w-fit lg:mx-0">
						<Link href="/">
							<ArrowLeftIcon data-icon="inline-start" />
							返回首页
						</Link>
					</Button>

					<div className="space-y-3">
						<div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-card text-primary lg:mx-0">
							<ActivityIcon className="size-6" />
						</div>
						<h1 className="text-4xl font-bold tracking-tight">Runner</h1>
						<p className="max-w-xl text-muted-foreground">
							用账号同步你的约跑计划、跑团关系和每一次奔跑记录。
						</p>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div className="rounded-xl border border-border bg-card/50 p-4">
							<div className="text-lg font-semibold">即时定位</div>
							<div className="mt-1 text-sm text-muted-foreground">
								快速找到同行伙伴。
							</div>
						</div>
						<div className="rounded-xl border border-border bg-card/50 p-4">
							<div className="text-lg font-semibold">跑团社交</div>
							<div className="mt-1 text-sm text-muted-foreground">
								创建跑团，约跑不落单。
							</div>
						</div>
						<div className="rounded-xl border border-border bg-card/50 p-4">
							<div className="text-lg font-semibold">数据分析</div>
							<div className="mt-1 text-sm text-muted-foreground">
								追踪每一次进步。
							</div>
						</div>
					</div>
				</section>

				<Card className="w-full text-left">
					<CardHeader>
						<CardTitle>{isRegister ? "创建账号" : "欢迎回来"}</CardTitle>
						<CardDescription>
							{isRegister
								? "注册后即可开始保存你的 Runner 数据。"
								: "使用邮箱和密码登录 Runner。"}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form className="space-y-4" onSubmit={handleSubmit}>
							{isRegister ? (
								<label className="block space-y-2">
									<span className="text-sm font-medium">昵称</span>
									<div className="relative">
										<UserRoundIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
										<Input
											value={name}
											onChange={(event) => setName(event.target.value)}
											required
											minLength={2}
											autoComplete="name"
											placeholder="你的昵称"
											className="pl-8"
										/>
									</div>
								</label>
							) : null}

							<label className="block space-y-2">
								<span className="text-sm font-medium">邮箱</span>
								<div className="relative">
									<MailIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										type="email"
										value={email}
										onChange={(event) => setEmail(event.target.value)}
										required
										autoComplete="email"
										placeholder="you@example.com"
										className="pl-8"
									/>
								</div>
							</label>

							<label className="block space-y-2">
								<span className="text-sm font-medium">密码</span>
								<div className="relative">
									<LockKeyholeIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										type="password"
										value={password}
										onChange={(event) => setPassword(event.target.value)}
										required
										minLength={8}
										autoComplete={
											isRegister ? "new-password" : "current-password"
										}
										placeholder="至少 8 位"
										className="pl-8"
									/>
								</div>
							</label>

							{error ? (
								<p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
									{error}
								</p>
							) : null}

							{notice ? (
								<p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
									{notice}
								</p>
							) : null}

							<Button type="submit" className="w-full" disabled={isSubmitting}>
								{isSubmitting ? (
									<Loader2Icon
										className="animate-spin"
										data-icon="inline-start"
									/>
								) : null}
								{isRegister ? "注册" : "登录"}
								{!isSubmitting ? (
									<ArrowRightIcon data-icon="inline-end" />
								) : null}
							</Button>
						</form>

						<div className="mt-4 text-center text-sm text-muted-foreground">
							{isRegister ? "已经有账号？" : "还没有账号？"}
							<Button asChild variant="link" className="px-1">
								<Link href={isRegister ? "/login" : "/register"}>
									{isRegister ? "去登录" : "去注册"}
								</Link>
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
