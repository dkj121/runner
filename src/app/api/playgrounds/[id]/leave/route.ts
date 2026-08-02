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
 * POST /api/playgrounds/[id]/leave
 * Leave a playground (non-owners only)
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
		logApiRequest("POST", `/api/playgrounds/${id}/leave`, 401, duration);
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const logger = createRequestLogger(requestId, session.user.id);
	const perf = new PerformanceLogger("leavePlayground", {
		playgroundId: id,
		userId: session.user.id,
		requestId,
	});

	logger.info({ playgroundId: id }, "User attempting to leave playground");

	try {
		// Check membership
		const membership = await prisma.playGroundUser.findFirst({
			where: { userId: session.user.id, playGroundId: id },
		});

		if (!membership) {
			const duration = Date.now() - startTime;
			logApiRequest("POST", `/api/playgrounds/${id}/leave`, 400, duration, {
				userId: session.user.id,
				playgroundId: id,
				error: "Not a member",
			});

			return NextResponse.json({ error: "你不是该域成员" }, { status: 400 });
		}

		perf.checkpoint("membership_verified");

		if (membership.role === "OWNER") {
			const duration = Date.now() - startTime;
			logApiRequest("POST", `/api/playgrounds/${id}/leave`, 403, duration, {
				userId: session.user.id,
				playgroundId: id,
				role: membership.role,
			});

			logger.warn(
				{ playgroundId: id, userId: session.user.id },
				"Owner attempted to leave playground",
			);

			return NextResponse.json(
				{ error: "域主不能退出，请先转让或删除域" },
				{ status: 403 },
			);
		}

		await prisma.playGroundUser.delete({ where: { id: membership.id } });

		perf.done();

		const duration = Date.now() - startTime;
		logApiRequest("POST", `/api/playgrounds/${id}/leave`, 200, duration, {
			userId: session.user.id,
			playgroundId: id,
		});

		logger.info(
			{ playgroundId: id, userId: session.user.id },
			"User left playground successfully",
		);

		return NextResponse.json({ success: true });
	} catch (error) {
		const duration = Date.now() - startTime;

		perf.error(error as Error);
		logError(error as Error, {
			operation: "leavePlayground",
			userId: session.user.id,
			playgroundId: id,
			requestId,
		});

		logApiRequest("POST", `/api/playgrounds/${id}/leave`, 500, duration, {
			userId: session.user.id,
			playgroundId: id,
			error: (error as Error).message,
		});

		logger.error({ err: error, playgroundId: id }, "Failed to leave playground");

		return NextResponse.json(
			{ error: "Failed to leave playground" },
			{ status: 500 },
		);
	}
}
