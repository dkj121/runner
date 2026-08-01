import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/playgrounds/[id]/leave
 * Leave a playground (non-owners only)
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;

	try {
		// Check membership
		const membership = await prisma.playGroundUser.findFirst({
			where: { userId: session.user.id, playGroundId: id },
		});

		if (!membership) {
			return NextResponse.json({ error: "你不是该域成员" }, { status: 400 });
		}

		if (membership.role === "OWNER") {
			return NextResponse.json(
				{ error: "域主不能退出，请先转让或删除域" },
				{ status: 403 },
			);
		}

		await prisma.playGroundUser.delete({ where: { id: membership.id } });

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to leave playground:", error);
		return NextResponse.json(
			{ error: "Failed to leave playground" },
			{ status: 500 },
		);
	}
}
