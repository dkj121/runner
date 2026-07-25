import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Runner",
	description: "基于即时定位与社交分享的约跑平台",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="zh-CN" className="dark">
			<body className="antialiased">{children}</body>
		</html>
	);
}
