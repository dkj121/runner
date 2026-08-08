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

/**
 * POST /api/playgrounds/[id]/join
 * Join a playground using an invite code
 * Body: { inviteCode: string }
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
		logApiRequest("POST", `/api/playgrounds/${id}/join`, 401, duration);
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const logger = createRequestLogger(requestId, session.user.id);
	const perf = new PerformanceLogger("joinPlayground", {
		playgroundId: id,
		userId: session.user.id,
		requestId,
	});

	logger.info({ playgroundId: id }, "User attempting to join playground");

	try {
		const body = await request.json();
		const { inviteCode } = body;

		if (!inviteCode || typeof inviteCode !== "string") {
			const duration = Date.now() - startTime;
			logApiRequest("POST", `/api/playgrounds/${id}/join`, 400, duration, {
				userId: session.user.id,
				playgroundId: id,
				error: "Missing invite code",
			});

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
			const duration = Date.now() - startTime;
			logApiRequest("POST", `/api/playgrounds/${id}/join`, 400, duration, {
				userId: session.user.id,
				playgroundId: id,
				inviteCode,
				error: "Invalid invite code",
			});

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
			const duration = Date.now() - startTime;
			logApiRequest("POST", `/api/playgrounds/${id}/join`, 400, duration, {
				userId: session.user.id,
				playgroundId: id,
				inviteCode,
				error: "Inactive invite code",
			});

			return NextResponse.json({ error: "邀请码已失效" }, { status: 400 });
		}

		if (code.expiresAt && code.expiresAt < new Date()) {
			const duration = Date.now() - startTime;
			logApiRequest("POST", `/api/playgrounds/${id}/join`, 400, duration, {
				userId: session.user.id,
				playgroundId: id,
				inviteCode,
				error: "Expired invite code",
			});

			return NextResponse.json({ error: "邀请码已过期" }, { status: 400 });
		}

		if (code.maxUses > 0 && code.useCount >= code.maxUses) {
			const duration = Date.now() - startTime;
			logApiRequest("POST", `/api/playgrounds/${id}/join`, 400, duration, {
				userId: session.user.id,
				playgroundId: id,
				inviteCode,
				error: "Max uses reached",
			});

			return NextResponse.json(
				{ error: "邀请码已达使用上限" },
				{ status: 400 },
			);
		}

		perf.checkpoint("invite_code_validated");

		// Check if already a member
		const existing = await prisma.playGroundUser.findFirst({
			where: { userId: session.user.id, playGroundId: id },
		});

		if (existing) {
			const duration = Date.now() - startTime;
			logApiRequest("POST", `/api/playgrounds/${id}/join`, 400, duration, {
				userId: session.user.id,
				playgroundId: id,
				error: "Already a member",
			});

			return NextResponse.json({ error: "你已经是该域成员" }, { status: 400 });
		}

		perf.checkpoint("membership_checked");

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

		perf.done();

		const duration = Date.now() - startTime;
		logApiRequest("POST", `/api/playgrounds/${id}/join`, 201, duration, {
			userId: session.user.id,
			playgroundId: id,
			inviteCode,
		});

		logger.info(
			{ playgroundId: id, userId: session.user.id },
			"User joined playground successfully",
		);

		return NextResponse.json(membership, { status: 201 });
	} catch (error) {
		const duration = Date.now() - startTime;

		perf.error(error as Error);
		logError(error as Error, {
			operation: "joinPlayground",
			userId: session.user.id,
			playgroundId: id,
			requestId,
		});

		logApiRequest("POST", `/api/playgrounds/${id}/join`, 500, duration, {
			userId: session.user.id,
			playgroundId: id,
			error: (error as Error).message,
		});

		logger.error({ err: error, playgroundId: id }, "Failed to join playground");

		return NextResponse.json(
			{ error: "Failed to join playground" },
			{ status: 500 },
		);
	}
}
