import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRoute } from "@/lib/create-route";

/**
 * GET /api/playgrounds/[id]/members
 * Get all members of a playground
 * 可选鉴权：公开域可匿名读，PRIVATE 才要求登录且必须是成员
 */
export const GET = createRoute({
	method: "GET",
	path: "/api/playgrounds/[id]/members",
	operation: "listPlaygroundMembers",
})(
	async ({ params, session, logger, perf }) => {
		const { id } = params;

		logger.debug({ playgroundId: id }, "Fetching playground members");

		const playground = await prisma.playGround.findUnique({
			where: { id },
			select: { visibility: true },
		});

		if (!playground) {
			return NextResponse.json(
				{ error: "Playground not found" },
				{ status: 404 },
			);
		}

		perf.checkpoint("playground_fetched");

		// Check visibility permissions
		if (playground.visibility === "PRIVATE") {
			if (!session?.user?.id) {
				return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
			}
			const isMember = await prisma.playGroundUser.findFirst({
				where: { playGroundId: id, userId: session.user.id },
			});
			if (!isMember) {
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

		return NextResponse.json({ members });
	},
);