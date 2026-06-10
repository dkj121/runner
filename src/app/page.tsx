import Link from "next/link";

export default function Home() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
			<h1 className="text-3xl font-bold">Runner</h1>
			<p className="text-gray-500">即时约跑</p>

			<div className="flex gap-4">
				<Link
					href="/login"
					className="rounded-lg bg-black px-6 py-2 text-sm text-white"
				>
					登录
				</Link>
				<Link href="/register" className="rounded-lg border px-6 py-2 text-sm">
					注册
				</Link>
				<Link href="/dashboard" className="rounded-lg border px-6 py-2 text-sm">
					仪表盘
				</Link>
			</div>
		</div>
	);
}
