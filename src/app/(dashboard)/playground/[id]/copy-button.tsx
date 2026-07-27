"use client";

import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export function CopyButton({ code }: { code: string }) {
	async function handleCopy() {
		await navigator.clipboard.writeText(code);
		toast.success("邀请码已复制");
	}

	return (
		<Button
			variant="outline"
			onClick={handleCopy}
			className="w-full gap-2 border-border font-heading font-semibold"
		>
			<Copy className="size-4" />
			复制邀请码: {code}
		</Button>
	);
}
