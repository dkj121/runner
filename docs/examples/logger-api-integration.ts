/**
 * Example: Integrating Logger with Playground API Routes
 * This file demonstrates how to add logging to the existing playground APIs
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	createRequestLogger,
	PerformanceLogger,
	logApiRequest,
	logPlaygroundActivity,
	logError,
} from "@/lib/logger";

/**
 * Example 1: GET /api/playgrounds
 * List playgrounds with comprehensive logging
 */
export async function GET(request: Request) {
	const startTime = Date.now();
	const requestId = crypto.randomUUID();

	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		const duration = Date.now() - startTime;
		logApiRequest("GET", "/api/playgrounds", 401, duration);
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const logger = createRequestLogger(requestId, session.user.id);
	const perf = new PerformanceLogger("listPlaygrounds", {
		userId: session.user.id,
		requestId,
	});

	try {
		const { searchParams } = new URL(request.url);
		const take = Math.min(Number(searchParams.get("take")) || 20, 100);
		const skip = Number(searchParams.get("skip")) || 0;
		const visibility = searchParams.get("visibility") as "PUBLIC" | "PRIVATE" | null;

		logger.debug({ take, skip, visibility }, "Query parameters parsed");

		perf.checkpoint("params-parsed");

		const where = {
			users: { some: { userId: session.user.id } },
			...(visibility && { visibility }),
		};

		const [playgrounds, total] = await Promise.all([
			prisma.playGround.findMany({
				where,
				include: {
					_count: { select: { users: true } },
					users: {
						where: { role: "OWNER" },
						include: { user: { select: { name: true, image: true } } },
					},
				},
				orderBy: { updatedAt: "desc" },
				take,
				skip,
			}),
			prisma.playGround.count({ where }),
		]);

		perf.checkpoint("database-query");
		perf.done({ count: playgrounds.length, total });

		const duration = Date.now() - startTime;
		logApiRequest("GET", "/api/playgrounds", 200, duration, {
			userId: session.user.id,
			count: playgrounds.length,
			total,
		});

		logger.info(
			{ count: playgrounds.length, total, take, skip },
			"Playgrounds retrieved successfully",
		);

		return NextResponse.json({ playgrounds, total });
	} catch (error) {
		const duration = Date.now() - startTime;

		perf.error(error as Error);
		logError(error as Error, {
			operation: "listPlaygrounds",
			userId: session.user.id,
			requestId,
		});

		logApiRequest("GET", "/api/playgrounds", 500, duration, {
			userId: session.user.id,
			error: (error as Error).message,
		});

		logger.error({ err: error }, "Failed to list playgrounds");

		return NextResponse.json(
			{ error: "Failed to fetch playgrounds" },
			{ status: 500 },
		);
	}
}

/**
 * Example 2: POST /api/playgrounds
 * Create playground with activity logging
 */
export async function POST(request: Request) {
	const startTime = Date.now();
	const requestId = crypto.randomUUID();

	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		const duration = Date.now() - startTime;
		logApiRequest("POST", "/api/playgrounds", 401, duration);
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const logger = createRequestLogger(requestId, session.user.id);
	const perf = new PerformanceLogger("createPlayground", {
		userId: session.user.id,
		requestId,
	});

	logger.info("Creating new playground");

	try {
		const body = await request.json();
		const { name, description, visibility, locationLat, locationLng, locationAddr } = body;

		logger.debug({ name, visibility }, "Request body parsed");

		if (!name || typeof name !== "string") {
			const duration = Date.now() - startTime;
			logApiRequest("POST", "/api/playgrounds", 400, duration, {
				userId: session.user.id,
				error: "Invalid name",
			});

			return NextResponse.json(
				{ error: "Name is required and must be a string" },
				{ status: 400 },
			);
		}

		perf.checkpoint("validation");

		const playground = await prisma.playGround.create({
			data: {
				name,
				description,
				visibility: visibility || "PUBLIC",
				locationLat,
				locationLng,
				locationAddr,
				users: {
					create: {
						userId: session.user.id,
						role: "OWNER",
					},
				},
			},
			include: {
				_count: { select: { users: true } },
				users: {
					include: { user: { select: { name: true, image: true } } },
				},
			},
		});

		perf.checkpoint("database-insert");

		// Log playground activity
		logPlaygroundActivity("create", playground.id, session.user.id, {
			name: playground.name,
			visibility: playground.visibility,
			hasLocation: !!(locationLat && locationLng),
		});

		perf.done({ playgroundId: playground.id });

		const duration = Date.now() - startTime;
		logApiRequest("POST", "/api/playgrounds", 201, duration, {
			userId: session.user.id,
			playgroundId: playground.id,
		});

		logger.info(
			{ playgroundId: playground.id, name: playground.name },
			"Playground created successfully",
		);

		return NextResponse.json(playground, { status: 201 });
	} catch (error) {
		const duration = Date.now() - startTime;

		perf.error(error as Error);
		logError(error as Error, {
			operation: "createPlayground",
			userId: session.user.id,
			requestId,
		});

		logApiRequest("POST", "/api/playgrounds", 500, duration, {
			userId: session.user.id,
			error: (error as Error).message,
		});

		logger.error({ err: error }, "Failed to create playground");

		return NextResponse.json(
			{ error: "Failed to create playground" },
			{ status: 500 },
		);
	}
}

/**
 * Example 3: POST /api/playgrounds/[id]/join
 * Join playground with detailed logging
 */
export async function JOIN(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const startTime = Date.now();
	const requestId = crypto.randomUUID();

	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		const duration = Date.now() - startTime;
		logApiRequest("POST", "/api/playgrounds/[id]/join", 401, duration);
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;
	const logger = createRequestLogger(requestId, session.user.id);
	const perf = new PerformanceLogger("joinPlayground", {
		userId: session.user.id,
		playgroundId: id,
		requestId,
	});

	logger.info({ playgroundId: id }, "User attempting to join playground");

	try {
		const body = await request.json();
		const { inviteCode } = body;

		logger.debug({ inviteCode: inviteCode.substring(0, 3) + "***" }, "Invite code received");

		if (!inviteCode || typeof inviteCode !== "string") {
			const duration = Date.now() - startTime;
			logApiRequest("POST", "/api/playgrounds/[id]/join", 400, duration, {
				userId: session.user.id,
				playgroundId: id,
			});

			return NextResponse.json(
				{ error: "Invite code is required" },
				{ status: 400 },
			);
		}

		perf.checkpoint("validation");

		// Verify invite code
		const code = await prisma.inviteCode.findUnique({
			where: { code: inviteCode },
			include: { playGround: true },
		});

		perf.checkpoint("code-lookup");

		if (!code || code.playGroundId !== id) {
			logger.warn(
				{ inviteCode: inviteCode.substring(0, 3) + "***", playgroundId: id },
				"Invalid or mismatched invite code",
			);

			const duration = Date.now() - startTime;
			logApiRequest("POST", "/api/playgrounds/[id]/join", 400, duration, {
				userId: session.user.id,
				playgroundId: id,
				error: "invalid_code",
			});

			return NextResponse.json(
				{ error: "邀请码无效或不匹配此域" },
				{ status: 400 },
			);
		}

		// Validation checks
		if (!code.isActive) {
			logger.warn({ codeId: code.id }, "Inactive invite code used");
			return NextResponse.json({ error: "邀请码已失效" }, { status: 400 });
		}

		if (code.expiresAt && code.expiresAt < new Date()) {
			logger.warn({ codeId: code.id, expiresAt: code.expiresAt }, "Expired invite code used");
			return NextResponse.json({ error: "邀请码已过期" }, { status: 400 });
		}

		if (code.maxUses > 0 && code.useCount >= code.maxUses) {
			logger.warn(
				{ codeId: code.id, useCount: code.useCount, maxUses: code.maxUses },
				"Invite code usage limit reached",
			);
			return NextResponse.json({ error: "邀请码已达使用上限" }, { status: 400 });
		}

		perf.checkpoint("code-validation");

		// Check if already a member
		const existing = await prisma.playGroundUser.findFirst({
			where: { userId: session.user.id, playGroundId: id },
		});

		if (existing) {
			logger.warn({ playgroundId: id }, "User already a member");
			const duration = Date.now() - startTime;
			logApiRequest("POST", "/api/playgrounds/[id]/join", 400, duration, {
				userId: session.user.id,
				playgroundId: id,
				error: "already_member",
			});
			return NextResponse.json({ error: "你已经是该域成员" }, { status: 400 });
		}

		perf.checkpoint("membership-check");

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

		perf.checkpoint("transaction");

		// Log playground activity
		logPlaygroundActivity("join", id, session.user.id, {
			inviteCode: inviteCode.substring(0, 3) + "***",
			codeUseCount: code.useCount + 1,
		});

		perf.done({ membershipId: membership.id });

		const duration = Date.now() - startTime;
		logApiRequest("POST", "/api/playgrounds/[id]/join", 201, duration, {
			userId: session.user.id,
			playgroundId: id,
			membershipId: membership.id,
		});

		logger.info(
			{ playgroundId: id, membershipId: membership.id },
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

		logApiRequest("POST", "/api/playgrounds/[id]/join", 500, duration, {
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
