import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/playgrounds/[id]/join
 * Join a playground using an invite code
 * Body: { inviteCode: string }
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
		const body = await request.json();
		const { inviteCode } = body;

		if (!inviteCode || typeof inviteCode !== "string") {
			return NextResponse.json(
				{ error: "Invite code is required" },
				{ status: 400 },
			);
		}

		// Verify invite code
		const code = await prisma.inviteCode.findUnique({
			where: { code: inviteCode },
			include: { playGround: true },
		});

		if (!code || code.playGroundId !== id) {
			return NextResponse.json(
				{ error: "邀请码无效或不匹配此域" },
				{ status: 400 },
			);
		}

		if (!code.isActive) {
			return NextResponse.json({ error: "邀请码已失效" }, { status: 400 });
		}

		if (code.expiresAt && code.expiresAt < new Date()) {
			return NextResponse.json({ error: "邀请码已过期" }, { status: 400 });
		}

		if (code.maxUses > 0 && code.useCount >= code.maxUses) {
			return NextResponse.json(
				{ error: "邀请码已达使用上限" },
				{ status: 400 },
			);
		}

		// Check if already a member
		const existing = await prisma.playGroundUser.findFirst({
			where: { userId: session.user.id, playGroundId: id },
		});

		if (existing) {
			return NextResponse.json({ error: "你已经是该域成员" }, { status: 400 });
		}

		// Join playground and increment use count
		const [membership] = await prisma.$transaction([
			prisma.playGroundUser.create({
				data: {
					userId: session.user.id,
					playGroundId: id,
					role: "USER",
				},
				include: {
					user: { select: { id: true, name: true, image: true } },
					playGround: true,
				},
			}),
			prisma.inviteCode.update({
				where: { id: code.id },
				data: { useCount: { increment: 1 } },
			}),
		]);

		return NextResponse.json(membership, { status: 201 });
	} catch (error) {
		console.error("Failed to join playground:", error);
		return NextResponse.json(
			{ error: "Failed to join playground" },
			{ status: 500 },
		);
	}
}
