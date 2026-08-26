import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { TabBar } from "@/components/navigation/tab-bar";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const isLocalBrowserVerification =
		process.env.NODE_ENV !== "production" &&
		(await cookies()).get("personal-run-browser-test")?.value === "1";
	const session = isLocalBrowserVerification
		? null
		: await auth.api.getSession({
				headers: await headers(),
			});

	if (!session && !isLocalBrowserVerification) {
		redirect("/login");
	}

	return (
		<div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-background">
			<main className="flex-1 overflow-y-auto pb-24">{children}</main>
			<TabBar />
		</div>
	);
}
