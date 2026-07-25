"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";

const TAB_MAP: Record<string, string> = {
  "/run": "/run",
  "/summary": "/records",
  "/records": "/records",
  "/rank": "/rank",
  "/profile": "/profile",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = TAB_MAP[pathname] ?? pathname;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
      <div className="flex-1">{children}</div>
      <BottomNav active={active} />
    </div>
  );
}
