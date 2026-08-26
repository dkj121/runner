import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRoute } from "@/lib/create-route";
import { COMPLETED_RUN_FILTER } from "@/lib/run-query";

/**
 * GET /api/playgrounds/[id]/leaderboard
 * Get the leaderboard/ranking for a playground
 * 可选鉴权：公开域可匿名读，PRIVATE 才要求登录且必须是成员
 */
export const GET = createRoute({
	method: "GET",
	path: "/api/playgrounds/[id]/leaderboard",
	operation: "getLeaderboard",
})(async ({ params, session, logger, perf }) => {
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
		const isMember = playground.users.some((u) => u.userId === session.user.id);
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
				where: COMPLETED_RUN_FILTER,
				select: {
					userId: true,
					distanceMeters: true,
					durationSeconds: true,
					paceSecondsPerKm: true,
					user: { select: { id: true, name: true, image: true } },
				},
				orderBy: { distanceMeters: "desc" },
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
			totalDistanceMeters: number;
			totalDurationSeconds: number;
			runCount: number;
			bestPaceSecondsPerKm: number | null;
		}
	>();

	for (const record of rankingList.runRecords) {
		const existing = userMap.get(record.userId);
		if (existing) {
			existing.totalDistanceMeters += record.distanceMeters;
			existing.totalDurationSeconds += record.durationSeconds;
			existing.runCount += 1;
			if (
				record.paceSecondsPerKm !== null &&
				(existing.bestPaceSecondsPerKm === null ||
					record.paceSecondsPerKm < existing.bestPaceSecondsPerKm)
			) {
				existing.bestPaceSecondsPerKm = record.paceSecondsPerKm;
			}
		} else {
			userMap.set(record.userId, {
				userId: record.userId,
				name: record.user.name,
				image: record.user.image,
				totalDistanceMeters: record.distanceMeters,
				totalDurationSeconds: record.durationSeconds,
				runCount: 1,
				bestPaceSecondsPerKm: record.paceSecondsPerKm,
			});
		}
	}

	const leaderboard = Array.from(userMap.values())
		.sort((a, b) => b.totalDistanceMeters - a.totalDistanceMeters)
		.map((user, index) => ({
			userId: user.userId,
			name: user.name,
			image: user.image,
			totalDistanceMeters: user.totalDistanceMeters,
			totalDurationSeconds: user.totalDurationSeconds,
			runCount: user.runCount,
			bestPaceSecondsPerKm: user.bestPaceSecondsPerKm,
			rank: index + 1,
		}));

	perf.done({ leaderboardSize: leaderboard.length });

	return NextResponse.json({ leaderboard });
});
