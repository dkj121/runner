import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRoute } from "@/lib/create-route";

/**
 * POST /api/playgrounds/[id]/join
 * Join a playground using an invite code
 * Body: { inviteCode: string }
 */
export const POST = createRoute({
	method: "POST",
	path: "/api/playgrounds/[id]/join",
	auth: true,
	operation: "joinPlayground",
})(async ({ request, params, user, logger, perf }) => {
	const { id } = params;

	logger.info({ playgroundId: id }, "User attempting to join playground");

	const body = await request.json();
	const { inviteCode } = body;

	if (!inviteCode || typeof inviteCode !== "string") {
		return NextResponse.json(
			{ error: "Invite code is required" },
			{ status: 400 },
		);
	}

	logger.debug({ inviteCode }, "Validating invite code");
	perf.checkpoint("request_parsed");

	// Verify invite code
	const code = await prisma.inviteCode.findUnique({
		where: { code: inviteCode },
		include: { playGround: true },
	});

	if (!code || code.playGroundId !== id) {
		logger.warn(
			{ playgroundId: id, inviteCode },
			"Invalid or mismatched invite code",
		);
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
		return NextResponse.json({ error: "邀请码已达使用上限" }, { status: 400 });
	}

	perf.checkpoint("invite_code_validated");

	// Check if already a member
	const existing = await prisma.playGroundUser.findFirst({
		where: { userId: user!.id, playGroundId: id },
	});

	if (existing) {
		return NextResponse.json({ error: "你已经是该域成员" }, { status: 400 });
	}

	perf.checkpoint("membership_checked");

	// Join playground and increment use count
	const [membership] = await prisma.$transaction([
		prisma.playGroundUser.create({
			data: {
				userId: user!.id,
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

	perf.done();
	logger.info(
		{ playgroundId: id, userId: user!.id },
		"User joined playground successfully",
	);

	return NextResponse.json(membership, { status: 201 });
});
