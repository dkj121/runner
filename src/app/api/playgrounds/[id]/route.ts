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
 * GET /api/playgrounds/[id]
 * Get playground details by ID
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
	const perf = new PerformanceLogger("getPlayground", {
		playgroundId: id,
		userId,
		requestId,
	});

	logger.debug({ playgroundId: id }, "Fetching playground details");

	try {
		const playground = await prisma.playGround.findUnique({
			where: { id },
			include: {
				_count: { select: { users: true } },
				users: {
					include: { user: { select: { id: true, name: true, image: true } } },
					orderBy: { createdAt: "asc" },
				},
				inviteCodes: {
					where: { isActive: true },
					orderBy: { createdAt: "desc" },
					take: 1,
				},
			},
		});

		if (!playground) {
			const duration = Date.now() - startTime;
			logApiRequest("GET", `/api/playgrounds/${id}`, 404, duration, {
				userId,
				playgroundId: id,
			});

			return NextResponse.json(
				{ error: "Playground not found" },
				{ status: 404 },
			);
		}

		perf.checkpoint("fetched");

		// Check visibility permissions
		if (playground.visibility === "PRIVATE") {
			if (!session?.user?.id) {
				const duration = Date.now() - startTime;
				logApiRequest("GET", `/api/playgrounds/${id}`, 401, duration, {
					playgroundId: id,
					visibility: playground.visibility,
				});

				return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
			}
			const isMember = playground.users.some(
				(u) => u.userId === session.user.id,
			);
			if (!isMember) {
				const duration = Date.now() - startTime;
				logApiRequest("GET", `/api/playgrounds/${id}`, 403, duration, {
					userId: session.user.id,
					playgroundId: id,
					visibility: playground.visibility,
				});

				logger.warn(
					{ playgroundId: id, userId: session.user.id },
					"Non-member attempted to access private playground",
				);

				return NextResponse.json({ error: "Forbidden" }, { status: 403 });
			}
		}

		perf.done({ memberCount: playground._count.users });

		const duration = Date.now() - startTime;
		logApiRequest("GET", `/api/playgrounds/${id}`, 200, duration, {
			userId,
			playgroundId: id,
			visibility: playground.visibility,
		});

		return NextResponse.json(playground);
	} catch (error) {
		const duration = Date.now() - startTime;

		perf.error(error as Error);
		logError(error as Error, {
			operation: "getPlayground",
			userId,
			playgroundId: id,
			requestId,
		});

		logApiRequest("GET", `/api/playgrounds/${id}`, 500, duration, {
			userId,
			playgroundId: id,
			error: (error as Error).message,
		});

		logger.error(
			{ err: error, playgroundId: id },
			"Failed to fetch playground",
		);

		return NextResponse.json(
			{ error: "Failed to fetch playground" },
			{ status: 500 },
		);
	}
}

/**
 * PUT /api/playgrounds/[id]
 * Update playground (owner only)
 * Body: { name?, description?, visibility?, locationLat?, locationLng?, locationAddr? }
 */
export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const startTime = Date.now();
	const requestId = crypto.randomUUID();
	const { id } = await params;

	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		const duration = Date.now() - startTime;
		logApiRequest("PUT", `/api/playgrounds/${id}`, 401, duration);
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const logger = createRequestLogger(requestId, session.user.id);
	const perf = new PerformanceLogger("updatePlayground", {
		playgroundId: id,
		userId: session.user.id,
		requestId,
	});

	logger.info({ playgroundId: id }, "Updating playground");

	try {
		// Check ownership
		const membership = await prisma.playGroundUser.findFirst({
			where: { playGroundId: id, userId: session.user.id, role: "OWNER" },
		});

		if (!membership) {
			const duration = Date.now() - startTime;
			logApiRequest("PUT", `/api/playgrounds/${id}`, 403, duration, {
				userId: session.user.id,
				playgroundId: id,
			});

			logger.warn(
				{ playgroundId: id, userId: session.user.id },
				"Non-owner attempted to update playground",
			);

			return NextResponse.json(
				{ error: "Only the owner can update this playground" },
				{ status: 403 },
			);
		}

		perf.checkpoint("ownership_verified");

		const body = await request.json();
		const {
			name,
			description,
			visibility,
			locationLat,
			locationLng,
			locationAddr,
		} = body;

		logger.debug({ updates: Object.keys(body) }, "Update fields");

		const updated = await prisma.playGround.update({
			where: { id },
			data: {
				...(name !== undefined && { name }),
				...(description !== undefined && { description }),
				...(visibility !== undefined && { visibility }),
				...(locationLat !== undefined && { locationLat }),
				...(locationLng !== undefined && { locationLng }),
				...(locationAddr !== undefined && { locationAddr }),
			},
			include: {
				_count: { select: { users: true } },
				users: {
					include: { user: { select: { name: true, image: true } } },
				},
			},
		});

		perf.done();

		const duration = Date.now() - startTime;
		logApiRequest("PUT", `/api/playgrounds/${id}`, 200, duration, {
			userId: session.user.id,
			playgroundId: id,
		});

		logger.info({ playgroundId: id }, "Playground updated successfully");

		return NextResponse.json(updated);
	} catch (error) {
		const duration = Date.now() - startTime;

		perf.error(error as Error);
		logError(error as Error, {
			operation: "updatePlayground",
			userId: session.user.id,
			playgroundId: id,
			requestId,
		});

		logApiRequest("PUT", `/api/playgrounds/${id}`, 500, duration, {
			userId: session.user.id,
			playgroundId: id,
			error: (error as Error).message,
		});

		logger.error(
			{ err: error, playgroundId: id },
			"Failed to update playground",
		);

		return NextResponse.json(
			{ error: "Failed to update playground" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/playgrounds/[id]
 * Delete playground (owner only)
 */
export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const startTime = Date.now();
	const requestId = crypto.randomUUID();
	const { id } = await params;

	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		const duration = Date.now() - startTime;
		logApiRequest("DELETE", `/api/playgrounds/${id}`, 401, duration);
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const logger = createRequestLogger(requestId, session.user.id);
	const perf = new PerformanceLogger("deletePlayground", {
		playgroundId: id,
		userId: session.user.id,
		requestId,
	});

	logger.info({ playgroundId: id }, "Deleting playground");

	try {
		// Check ownership
		const membership = await prisma.playGroundUser.findFirst({
			where: { playGroundId: id, userId: session.user.id, role: "OWNER" },
		});

		if (!membership) {
			const duration = Date.now() - startTime;
			logApiRequest("DELETE", `/api/playgrounds/${id}`, 403, duration, {
				userId: session.user.id,
				playgroundId: id,
			});

			logger.warn(
				{ playgroundId: id, userId: session.user.id },
				"Non-owner attempted to delete playground",
			);

			return NextResponse.json(
				{ error: "Only the owner can delete this playground" },
				{ status: 403 },
			);
		}

		perf.checkpoint("ownership_verified");

		await prisma.playGround.delete({ where: { id } });

		perf.done();

		const duration = Date.now() - startTime;
		logApiRequest("DELETE", `/api/playgrounds/${id}`, 200, duration, {
			userId: session.user.id,
			playgroundId: id,
		});

		logger.info({ playgroundId: id }, "Playground deleted successfully");

		return NextResponse.json({ success: true });
	} catch (error) {
		const duration = Date.now() - startTime;

		perf.error(error as Error);
		logError(error as Error, {
			operation: "deletePlayground",
			userId: session.user.id,
			playgroundId: id,
			requestId,
		});

		logApiRequest("DELETE", `/api/playgrounds/${id}`, 500, duration, {
			userId: session.user.id,
			playgroundId: id,
			error: (error as Error).message,
		});

		logger.error(
			{ err: error, playgroundId: id },
			"Failed to delete playground",
		);

		return NextResponse.json(
			{ error: "Failed to delete playground" },
			{ status: 500 },
		);
	}
}
