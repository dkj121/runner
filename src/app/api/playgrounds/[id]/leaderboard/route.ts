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
 * GET /api/playgrounds/[id]/leaderboard
 * Get the leaderboard/ranking for a playground
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
	const perf = new PerformanceLogger("getLeaderboard", {
		playgroundId: id,
		userId,
		requestId,
	});

	logger.debug({ playgroundId: id }, "Fetching leaderboard");

	try {
		const playground = await prisma.playGround.findUnique({
			where: { id },
			include: { users: true },
		});

		if (!playground) {
			const duration = Date.now() - startTime;
			logApiRequest("GET", `/api/playgrounds/${id}/leaderboard`, 404, duration, {
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
				logApiRequest("GET", `/api/playgrounds/${id}/leaderboard`, 401, duration, {
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
				logApiRequest("GET", `/api/playgrounds/${id}/leaderboard`, 403, duration, {
					userId: session.user.id,
					playgroundId: id,
					visibility: playground.visibility,
				});

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
			const duration = Date.now() - startTime;
			logApiRequest("GET", `/api/playgrounds/${id}/leaderboard`, 200, duration, {
				userId,
				playgroundId: id,
				leaderboardSize: 0,
			});

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

		const duration = Date.now() - startTime;
		logApiRequest("GET", `/api/playgrounds/${id}/leaderboard`, 200, duration, {
			userId,
			playgroundId: id,
			leaderboardSize: leaderboard.length,
		});

		return NextResponse.json({ leaderboard });
	} catch (error) {
		const duration = Date.now() - startTime;

		perf.error(error as Error);
		logError(error as Error, {
			operation: "getLeaderboard",
			userId,
			playgroundId: id,
			requestId,
		});

		logApiRequest("GET", `/api/playgrounds/${id}/leaderboard`, 500, duration, {
			userId,
			playgroundId: id,
			error: (error as Error).message,
		});

		logger.error({ err: error, playgroundId: id }, "Failed to fetch leaderboard");

		return NextResponse.json(
			{ error: "Failed to fetch leaderboard" },
			{ status: 500 },
		);
	}
}
