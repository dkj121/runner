import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRoute } from "@/lib/create-route";

function generateCode(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let code = "";
	for (let i = 0; i < 6; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

/**
 * GET /api/playgrounds/[id]/invite-codes
 * List all invite codes for a playground (owner only)
 */
export const GET = createRoute({
	method: "GET",
	path: "/api/playgrounds/[id]/invite-codes",
	auth: true,
	operation: "listInviteCodes",
})(async ({ params, user, logger, perf }) => {
	const { id } = params;

	logger.debug({ playgroundId: id }, "Fetching invite codes");

	// Check ownership
	const membership = await prisma.playGroundUser.findFirst({
		where: { playGroundId: id, userId: user!.id, role: "OWNER" },
	});

	if (!membership) {
		logger.warn(
			{ playgroundId: id, userId: user!.id },
			"Non-owner attempted to view invite codes",
		);
		return NextResponse.json(
			{ error: "Only the owner can view invite codes" },
			{ status: 403 },
		);
	}

	perf.checkpoint("ownership_verified");

	const inviteCodes = await prisma.inviteCode.findMany({
		where: { playGroundId: id },
		orderBy: { createdAt: "desc" },
	});

	perf.done({ codeCount: inviteCodes.length });

	return NextResponse.json({ inviteCodes });
});

/**
 * POST /api/playgrounds/[id]/invite-codes
 * Generate a new invite code (owner only)
 * Body: { maxUses?: number, expiresInHours?: number }
 */
export const POST = createRoute({
	method: "POST",
	path: "/api/playgrounds/[id]/invite-codes",
	auth: true,
	operation: "generateInviteCode",
})(async ({ request, params, user, logger, perf }) => {
	const { id } = params;

	logger.info({ playgroundId: id }, "Generating invite code");

	// Check ownership
	const membership = await prisma.playGroundUser.findFirst({
		where: { playGroundId: id, userId: user!.id, role: "OWNER" },
	});

	if (!membership) {
		logger.warn(
			{ playgroundId: id, userId: user!.id },
			"Non-owner attempted to generate invite code",
		);
		return NextResponse.json(
			{ error: "Only the owner can generate invite codes" },
			{ status: 403 },
		);
	}

	perf.checkpoint("ownership_verified");

	const body = await request.json().catch(() => ({}));
	const { maxUses = 0, expiresInHours } = body;

	logger.debug({ maxUses, expiresInHours }, "Invite code settings");

	const code = generateCode();
	const expiresAt = expiresInHours
		? new Date(Date.now() + expiresInHours * 3600_000)
		: null;

	const inviteCode = await prisma.inviteCode.create({
		data: {
			code,
			playGroundId: id,
			createdBy: user!.id,
			maxUses,
			expiresAt,
		},
	});

	perf.done({ code: inviteCode.code });
	logger.info(
		{ playgroundId: id, code: inviteCode.code },
		"Invite code generated successfully",
	);

	return NextResponse.json(inviteCode, { status: 201 });
});
