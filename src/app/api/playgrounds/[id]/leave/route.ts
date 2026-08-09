import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRoute } from "@/lib/create-route";

/**
 * POST /api/playgrounds/[id]/leave
 * Leave a playground (non-owners only)
 */
export const POST = createRoute({
	method: "POST",
	path: "/api/playgrounds/[id]/leave",
	auth: true,
	operation: "leavePlayground",
})(async ({ params, user, logger, perf }) => {
	const { id } = params;

	logger.info({ playgroundId: id }, "User attempting to leave playground");

	// Check membership
	const membership = await prisma.playGroundUser.findFirst({
		where: { userId: user!.id, playGroundId: id },
	});

	if (!membership) {
		return NextResponse.json({ error: "你不是该域成员" }, { status: 400 });
	}

	perf.checkpoint("membership_verified");

	if (membership.role === "OWNER") {
		logger.warn(
			{ playgroundId: id, userId: user!.id },
			"Owner attempted to leave playground",
		);
		return NextResponse.json(
			{ error: "域主不能退出，请先转让或删除域" },
			{ status: 403 },
		);
	}

	await prisma.playGroundUser.delete({ where: { id: membership.id } });

	perf.done();
	logger.info(
		{ playgroundId: id, userId: user!.id },
		"User left playground successfully",
	);

	return NextResponse.json({ success: true });
});
