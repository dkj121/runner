import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRoute } from "@/lib/create-route";

/**
 * GET /api/playgrounds/[id]
 * Get playground details by ID
 * 可选鉴权：公开域可匿名读，PRIVATE 才要求登录且必须是成员
 */
export const GET = createRoute({
	method: "GET",
	path: "/api/playgrounds/[id]",
	operation: "getPlayground",
})(async ({ params, session, logger, perf }) => {
	const { id } = params;

	logger.debug({ playgroundId: id }, "Fetching playground details");

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
		return NextResponse.json(
			{ error: "Playground not found" },
			{ status: 404 },
		);
	}

	perf.checkpoint("fetched");

	// Check visibility permissions
	if (playground.visibility === "PRIVATE") {
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		const isMember = playground.users.some((u) => u.userId === session.user.id);
		if (!isMember) {
			logger.warn(
				{ playgroundId: id, userId: session.user.id },
				"Non-member attempted to access private playground",
			);
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
	}

	perf.done({ memberCount: playground._count.users });

	return NextResponse.json(playground);
});

/**
 * PUT /api/playgrounds/[id]
 * Update playground (owner only)
 * Body: { name?, description?, visibility?, locationLat?, locationLng?, locationAddr? }
 */
export const PUT = createRoute({
	method: "PUT",
	path: "/api/playgrounds/[id]",
	auth: true,
	operation: "updatePlayground",
})(async ({ request, params, user, logger, perf }) => {
	const { id } = params;

	logger.info({ playgroundId: id }, "Updating playground");

	// Check ownership
	const membership = await prisma.playGroundUser.findFirst({
		where: { playGroundId: id, userId: user!.id, role: "OWNER" },
	});

	if (!membership) {
		logger.warn(
			{ playgroundId: id, userId: user!.id },
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
	logger.info({ playgroundId: id }, "Playground updated successfully");

	return NextResponse.json(updated);
});

/**
 * DELETE /api/playgrounds/[id]
 * Delete playground (owner only)
 */
export const DELETE = createRoute({
	method: "DELETE",
	path: "/api/playgrounds/[id]",
	auth: true,
	operation: "deletePlayground",
})(async ({ params, user, logger, perf }) => {
	const { id } = params;

	logger.info({ playgroundId: id }, "Deleting playground");

	// Check ownership
	const membership = await prisma.playGroundUser.findFirst({
		where: { playGroundId: id, userId: user!.id, role: "OWNER" },
	});

	if (!membership) {
		logger.warn(
			{ playgroundId: id, userId: user!.id },
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
	logger.info({ playgroundId: id }, "Playground deleted successfully");

	return NextResponse.json({ success: true });
});
