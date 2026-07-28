import Link from "next/link";
import { ActivityIcon, ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)]">
			<section className="hidden border-r border-border bg-card/40 p-12 lg:flex lg:flex-col lg:justify-between">
				<Button asChild variant="ghost" className="w-fit">
					<Link href="/">
						<ArrowLeftIcon data-icon="inline-start" />
						返回首页
					</Link>
				</Button>
				<div className="max-w-lg space-y-5">
					<div className="flex size-12 items-center justify-center rounded-lg border border-border bg-background text-primary">
						<ActivityIcon className="size-6" />
					</div>
					<h1 className="text-5xl font-bold">Runner</h1>
					<p className="text-lg leading-8 text-muted-foreground">
						连接每一次出发。同步约跑计划、跑团关系和属于你的奔跑记录。
					</p>
				</div>
				<p className="text-sm text-muted-foreground">
					即时定位 · 跑团社交 · 数据分析
				</p>
			</section>
			<section className="flex items-center justify-center px-4 py-10 sm:px-8">
				<div className="w-full max-w-md">
					<Button asChild variant="ghost" className="mb-6 lg:hidden">
						<Link href="/">
							<ArrowLeftIcon data-icon="inline-start" />
							返回首页
						</Link>
					</Button>
					{children}
				</div>
			</section>
		</main>
	);
}
