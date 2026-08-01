import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/playgrounds/[id]
 * Get playground details by ID
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

		return NextResponse.json(playground);
	} catch (error) {
		console.error("Failed to fetch playground:", error);
		return NextResponse.json(
			{ error: "Failed to fetch playground" },
			{ status: 500 },
		);
	}
}

/**
 * PUT /api/playgrounds/[id]
 * Update playground (owner only)
 * Body: { name?, description?, visibility?, locationLat?, locationLng?, locationAddr? }
 */
export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;

	try {
		// Check ownership
		const membership = await prisma.playGroundUser.findFirst({
			where: { playGroundId: id, userId: session.user.id, role: "OWNER" },
		});

		if (!membership) {
			return NextResponse.json(
				{ error: "Only the owner can update this playground" },
				{ status: 403 },
			);
		}

		const body = await request.json();
		const {
			name,
			description,
			visibility,
			locationLat,
			locationLng,
			locationAddr,
		} = body;

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

		return NextResponse.json(updated);
	} catch (error) {
		console.error("Failed to update playground:", error);
		return NextResponse.json(
			{ error: "Failed to update playground" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/playgrounds/[id]
 * Delete playground (owner only)
 */
export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;

	try {
		// Check ownership
		const membership = await prisma.playGroundUser.findFirst({
			where: { playGroundId: id, userId: session.user.id, role: "OWNER" },
		});

		if (!membership) {
			return NextResponse.json(
				{ error: "Only the owner can delete this playground" },
				{ status: 403 },
			);
		}

		await prisma.playGround.delete({ where: { id } });

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to delete playground:", error);
		return NextResponse.json(
			{ error: "Failed to delete playground" },
			{ status: 500 },
		);
	}
}
