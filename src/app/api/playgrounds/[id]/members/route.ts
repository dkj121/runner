import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/playgrounds/[id]/members
 * Get all members of a playground
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
			select: { visibility: true },
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
			const isMember = await prisma.playGroundUser.findFirst({
				where: { playGroundId: id, userId: session.user.id },
			});
			if (!isMember) {
				return NextResponse.json({ error: "Forbidden" }, { status: 403 });
			}
		}

		const members = await prisma.playGroundUser.findMany({
			where: { playGroundId: id },
			include: {
				user: { select: { id: true, name: true, image: true, email: true } },
			},
			orderBy: [{ role: "desc" }, { createdAt: "asc" }],
		});

		return NextResponse.json({ members });
	} catch (error) {
		console.error("Failed to fetch members:", error);
		return NextResponse.json(
			{ error: "Failed to fetch members" },
			{ status: 500 },
		);
	}
}
