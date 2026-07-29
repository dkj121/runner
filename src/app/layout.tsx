import type { Metadata } from "next";

import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
	title: "Runner",
	description: "即时定位、跑团社交与跑步数据分析平台",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="zh-CN" className={`dark bg-background font-sans antialiased`}>
			<body className="antialiased">
				<AuthProvider>{children}</AuthProvider>
				<Toaster richColors position="top-center" />
			</body>
		</html>
	);
}
