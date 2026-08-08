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
 * GET /api/playgrounds/[id]/members
 * Get all members of a playground
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const startTime = Date.now();
	const requestId = crypto.randomUUID();
	const { id } = await params;

	const session = await auth.api.getSession({ headers: await headers() });
	const userId = session?.user?.id;

	const logger = createRequestLogger(requestId, userId);
	const perf = new PerformanceLogger("listPlaygroundMembers", {
		playgroundId: id,
		userId,
		requestId,
	});

	logger.debug({ playgroundId: id }, "Fetching playground members");

	try {
		const playground = await prisma.playGround.findUnique({
			where: { id },
			select: { visibility: true },
		});

		if (!playground) {
			const duration = Date.now() - startTime;
			logApiRequest("GET", `/api/playgrounds/${id}/members`, 404, duration, {
				userId,
				playgroundId: id,
			});

			return NextResponse.json(
				{ error: "Playground not found" },
				{ status: 404 },
			);
		}

		perf.checkpoint("playground_fetched");

		// Check visibility permissions
		if (playground.visibility === "PRIVATE") {
			if (!session?.user?.id) {
				const duration = Date.now() - startTime;
				logApiRequest("GET", `/api/playgrounds/${id}/members`, 401, duration, {
					playgroundId: id,
					visibility: playground.visibility,
				});

				return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
			}
			const isMember = await prisma.playGroundUser.findFirst({
				where: { playGroundId: id, userId: session.user.id },
			});
			if (!isMember) {
				const duration = Date.now() - startTime;
				logApiRequest("GET", `/api/playgrounds/${id}/members`, 403, duration, {
					userId: session.user.id,
					playgroundId: id,
					visibility: playground.visibility,
				});

				logger.warn(
					{ playgroundId: id, userId: session.user.id },
					"Non-member attempted to view private playground members",
				);

				return NextResponse.json({ error: "Forbidden" }, { status: 403 });
			}
		}

		perf.checkpoint("access_verified");

		const members = await prisma.playGroundUser.findMany({
			where: { playGroundId: id },
			include: {
				user: { select: { id: true, name: true, image: true, email: true } },
			},
			orderBy: [{ role: "desc" }, { createdAt: "asc" }],
		});

		perf.done({ memberCount: members.length });

		const duration = Date.now() - startTime;
		logApiRequest("GET", `/api/playgrounds/${id}/members`, 200, duration, {
			userId,
			playgroundId: id,
			memberCount: members.length,
		});

		return NextResponse.json({ members });
	} catch (error) {
		const duration = Date.now() - startTime;

		perf.error(error as Error);
		logError(error as Error, {
			operation: "listPlaygroundMembers",
			userId,
			playgroundId: id,
			requestId,
		});

		logApiRequest("GET", `/api/playgrounds/${id}/members`, 500, duration, {
			userId,
			playgroundId: id,
			error: (error as Error).message,
		});

		logger.error({ err: error, playgroundId: id }, "Failed to fetch members");

		return NextResponse.json(
			{ error: "Failed to fetch members" },
			{ status: 500 },
		);
	}
}
