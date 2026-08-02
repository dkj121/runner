import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/playgrounds
 * List all playgrounds for the authenticated user
 * Query params: take, skip, visibility (PUBLIC|PRIVATE)
 */
export async function GET(request: Request) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const take = Math.min(Number(searchParams.get("take")) || 20, 100);
	const skip = Number(searchParams.get("skip")) || 0;
	const visibility = searchParams.get("visibility") as
		| "PUBLIC"
		| "PRIVATE"
		| null;

	const where = {
		users: { some: { userId: session.user.id } },
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

	return NextResponse.json({ playgrounds, total });
}

/**
 * POST /api/playgrounds
 * Create a new playground
 * Body: { name, description?, visibility?, locationLat?, locationLng?, locationAddr? }
 */
export async function POST(request: Request) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const {
			name,
			description,
			visibility,
			locationLat,
			locationLng,
			locationAddr,
		} = body;

		if (!name || typeof name !== "string") {
			return NextResponse.json(
				{ error: "Name is required and must be a string" },
				{ status: 400 },
			);
		}

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
						userId: session.user.id,
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
	} catch (error) {
		console.error("Failed to create playground:", error);
		return NextResponse.json(
			{ error: "Failed to create playground" },
			{ status: 500 },
		);
	}
}
