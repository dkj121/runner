import Link from "next/link";

export default function Home() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
			<h1 className="text-4xl font-bold tracking-tight">Runner</h1>
			<p className="max-w-md text-gray-500">
				基于即时定位与社交分享的约跑平台 —— 匹配搭子、记录轨迹、一起奔跑。
			</p>
			<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div className="rounded-xl border p-4">
					<div className="text-lg font-semibold">即时定位</div>
					<div className="mt-1 text-sm text-gray-500">实时共享位置，轻松汇合</div>
				</div>
				<div className="rounded-xl border p-4">
					<div className="text-lg font-semibold">跑团社交</div>
					<div className="mt-1 text-sm text-gray-500">创建跑团，约跑不落单</div>
				</div>
				<div className="rounded-xl border p-4">
					<div className="text-lg font-semibold">数据分析</div>
					<div className="mt-1 text-sm text-gray-500">追踪每一次奔跑的进步</div>
				</div>
			</div>
		</div>
	);
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
