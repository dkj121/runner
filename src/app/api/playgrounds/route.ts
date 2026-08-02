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
 * GET /api/playgrounds
 * List all playgrounds for the authenticated user
 * Query params: take, skip, visibility (PUBLIC|PRIVATE)
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
		const visibility = searchParams.get("visibility") as
			| "PUBLIC"
			| "PRIVATE"
			| null;

		logger.debug({ take, skip, visibility }, "Query parameters parsed");

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
 * POST /api/playgrounds
 * Create a new playground
 * Body: { name, description?, visibility?, locationLat?, locationLng?, locationAddr? }
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
		const {
			name,
			description,
			visibility,
			locationLat,
			locationLng,
			locationAddr,
		} = body;

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

		return NextResponse.json(playground, { status: 201 });
	} catch (error) {
		console.error("Failed to create playground:", error);
		return NextResponse.json(
			{ error: "Failed to create playground" },
			{ status: 500 },
		);
	}
}
