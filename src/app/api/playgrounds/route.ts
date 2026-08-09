import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRoute } from "@/lib/create-route";

/**
 * GET /api/playgrounds
 * List all playgrounds for the authenticated user
 * Query params: take, skip, visibility (PUBLIC|PRIVATE)
 */
export const GET = createRoute({
	method: "GET",
	path: "/api/playgrounds",
	auth: true,
	operation: "listPlaygrounds",
})(async ({ request, user, logger, perf }) => {
	const { searchParams } = new URL(request.url);
	const take = Math.min(Number(searchParams.get("take")) || 20, 100);
	const skip = Number(searchParams.get("skip")) || 0;
	const visibility = searchParams.get("visibility") as
		| "PUBLIC"
		| "PRIVATE"
		| null;

	logger.debug({ take, skip, visibility }, "Query parameters parsed");

	const where = {
		users: { some: { userId: user!.id } },
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

	logger.info(
		{ count: playgrounds.length, total, take, skip },
		"Playgrounds retrieved successfully",
	);

	return NextResponse.json({ playgrounds, total });
});

/**
 * POST /api/playgrounds
 * Create a new playground
 * Body: { name, description?, visibility?, locationLat?, locationLng?, locationAddr? }
 */
export const POST = createRoute({
	method: "POST",
	path: "/api/playgrounds",
	auth: true,
	operation: "createPlayground",
})(async ({ request, user, logger, perf }) => {
	logger.info("Creating new playground");

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
					userId: user!.id,
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
});
