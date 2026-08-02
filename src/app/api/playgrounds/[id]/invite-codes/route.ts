import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	createRequestLogger,
	PerformanceLogger,
	logApiRequest,
	logError,
} from "@/lib/logger";

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
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const startTime = Date.now();
	const requestId = crypto.randomUUID();
	const { id } = await params;

	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		const duration = Date.now() - startTime;
		logApiRequest("GET", `/api/playgrounds/${id}/invite-codes`, 401, duration);
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const logger = createRequestLogger(requestId, session.user.id);
	const perf = new PerformanceLogger("listInviteCodes", {
		playgroundId: id,
		userId: session.user.id,
		requestId,
	});

	logger.debug({ playgroundId: id }, "Fetching invite codes");

	try {
		// Check ownership
		const membership = await prisma.playGroundUser.findFirst({
			where: { playGroundId: id, userId: session.user.id, role: "OWNER" },
		});

		if (!membership) {
			const duration = Date.now() - startTime;
			logApiRequest("GET", `/api/playgrounds/${id}/invite-codes`, 403, duration, {
				userId: session.user.id,
				playgroundId: id,
			});

			logger.warn(
				{ playgroundId: id, userId: session.user.id },
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

		const duration = Date.now() - startTime;
		logApiRequest("GET", `/api/playgrounds/${id}/invite-codes`, 200, duration, {
			userId: session.user.id,
			playgroundId: id,
			codeCount: inviteCodes.length,
		});

		return NextResponse.json({ inviteCodes });
	} catch (error) {
		const duration = Date.now() - startTime;

		perf.error(error as Error);
		logError(error as Error, {
			operation: "listInviteCodes",
			userId: session.user.id,
			playgroundId: id,
			requestId,
		});

		logApiRequest("GET", `/api/playgrounds/${id}/invite-codes`, 500, duration, {
			userId: session.user.id,
			playgroundId: id,
			error: (error as Error).message,
		});

		logger.error({ err: error, playgroundId: id }, "Failed to fetch invite codes");

		return NextResponse.json(
			{ error: "Failed to fetch invite codes" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/playgrounds/[id]/invite-codes
 * Generate a new invite code (owner only)
 * Body: { maxUses?: number, expiresInHours?: number }
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const startTime = Date.now();
	const requestId = crypto.randomUUID();
	const { id } = await params;

	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		const duration = Date.now() - startTime;
		logApiRequest("POST", `/api/playgrounds/${id}/invite-codes`, 401, duration);
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const logger = createRequestLogger(requestId, session.user.id);
	const perf = new PerformanceLogger("generateInviteCode", {
		playgroundId: id,
		userId: session.user.id,
		requestId,
	});

	logger.info({ playgroundId: id }, "Generating invite code");

	try {
		// Check ownership
		const membership = await prisma.playGroundUser.findFirst({
			where: { playGroundId: id, userId: session.user.id, role: "OWNER" },
		});

		if (!membership) {
			const duration = Date.now() - startTime;
			logApiRequest("POST", `/api/playgrounds/${id}/invite-codes`, 403, duration, {
				userId: session.user.id,
				playgroundId: id,
			});

			logger.warn(
				{ playgroundId: id, userId: session.user.id },
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
				createdBy: session.user.id,
				maxUses,
				expiresAt,
			},
		});

		perf.done({ code: inviteCode.code });

		const duration = Date.now() - startTime;
		logApiRequest("POST", `/api/playgrounds/${id}/invite-codes`, 201, duration, {
			userId: session.user.id,
			playgroundId: id,
			code: inviteCode.code,
		});

		logger.info(
			{ playgroundId: id, code: inviteCode.code },
			"Invite code generated successfully",
		);

		return NextResponse.json(inviteCode, { status: 201 });
	} catch (error) {
		const duration = Date.now() - startTime;

		perf.error(error as Error);
		logError(error as Error, {
			operation: "generateInviteCode",
			userId: session.user.id,
			playgroundId: id,
			requestId,
		});

		logApiRequest("POST", `/api/playgrounds/${id}/invite-codes`, 500, duration, {
			userId: session.user.id,
			playgroundId: id,
			error: (error as Error).message,
		});

		logger.error(
			{ err: error, playgroundId: id },
			"Failed to generate invite code",
		);

		return NextResponse.json(
			{ error: "Failed to generate invite code" },
			{ status: 500 },
		);
	}
}
