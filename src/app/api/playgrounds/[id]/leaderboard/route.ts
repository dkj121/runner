import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRoute } from "@/lib/create-route";

/**
 * GET /api/playgrounds/[id]/leaderboard
 * Get the leaderboard/ranking for a playground
 * 可选鉴权：公开域可匿名读，PRIVATE 才要求登录且必须是成员
 */
export const GET = createRoute({
	method: "GET",
	path: "/api/playgrounds/[id]/leaderboard",
	operation: "getLeaderboard",
})(
	async ({ params, session, logger, perf }) => {
		const { id } = params;

		logger.debug({ playgroundId: id }, "Fetching leaderboard");

		const playground = await prisma.playGround.findUnique({
			where: { id },
			include: { users: true },
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
			const isMember = playground.users.some(
				(u) => u.userId === session.user.id,
			);
			if (!isMember) {
				logger.warn(
					{ playgroundId: id, userId: session.user.id },
					"Non-member attempted to view private playground leaderboard",
				);
				return NextResponse.json({ error: "Forbidden" }, { status: 403 });
			}
		}

		perf.checkpoint("access_verified");

		// Fetch ranking list
		const rankingList = await prisma.playGroundRankingList.findUnique({
			where: { playGroundId: id },
			include: {
				runRecords: {
					include: {
						user: { select: { id: true, name: true, image: true } },
					},
					orderBy: { distance: "desc" },
				},
			},
		});

		if (!rankingList) {
			return NextResponse.json({ leaderboard: [] });
		}

		perf.checkpoint("ranking_fetched");

		// Aggregate by user
		const userMap = new Map<
			string,
			{
				userId: string;
				name: string;
				image: string | null;
				totalDistance: number;
				totalTime: number;
				runCount: number;
				bestPace: string;
			}
		>();

		for (const record of rankingList.runRecords) {
			const existing = userMap.get(record.userId);
			if (existing) {
				existing.totalDistance += record.distance;
				existing.totalTime += record.duration;
				existing.runCount += 1;
				// Keep the best pace (lower is better)
				if (record.avgPace < existing.bestPace) {
					existing.bestPace = record.avgPace;
				}
			} else {
				userMap.set(record.userId, {
					userId: record.userId,
					name: record.user.name,
					image: record.user.image,
					totalDistance: record.distance,
					totalTime: record.duration,
					runCount: 1,
					bestPace: record.avgPace,
				});
			}
		}

		const leaderboard = Array.from(userMap.values())
			.sort((a, b) => b.totalDistance - a.totalDistance)
			.map((user, index) => ({
				...user,
				rank: index + 1,
			}));

		perf.done({ leaderboardSize: leaderboard.length });

		return NextResponse.json({ leaderboard });
	},
);