import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/playgrounds/[id]/leaderboard
 * Get the leaderboard/ranking for a playground
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth.api.getSession({ headers: await headers() });
	const { id } = await params;

	try {
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

		// Check visibility permissions
		if (playground.visibility === "PRIVATE") {
			if (!session?.user?.id) {
				return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
			}
			const isMember = playground.users.some(
				(u) => u.userId === session.user.id,
			);
			if (!isMember) {
				return NextResponse.json({ error: "Forbidden" }, { status: 403 });
			}
		}

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

		return NextResponse.json({ leaderboard });
	} catch (error) {
		console.error("Failed to fetch leaderboard:", error);
		return NextResponse.json(
			{ error: "Failed to fetch leaderboard" },
			{ status: 500 },
		);
	}
}
