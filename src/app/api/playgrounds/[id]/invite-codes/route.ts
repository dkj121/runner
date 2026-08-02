import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function generateCode(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let code = "";
	for (let i = 0; i < 6; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

/**
 * GET /api/playgrounds/[id]/invite-codes
 * List all invite codes for a playground (owner only)
 */
export async function GET(
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
				{ error: "Only the owner can view invite codes" },
				{ status: 403 },
			);
		}

		const inviteCodes = await prisma.inviteCode.findMany({
			where: { playGroundId: id },
			orderBy: { createdAt: "desc" },
		});

		return NextResponse.json({ inviteCodes });
	} catch (error) {
		console.error("Failed to fetch invite codes:", error);
		return NextResponse.json(
			{ error: "Failed to fetch invite codes" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/playgrounds/[id]/invite-codes
 * Generate a new invite code (owner only)
 * Body: { maxUses?: number, expiresInHours?: number }
 */
export async function POST(
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
				{ error: "Only the owner can generate invite codes" },
				{ status: 403 },
			);
		}

		const body = await request.json().catch(() => ({}));
		const { maxUses = 0, expiresInHours } = body;

		const code = generateCode();
		const expiresAt = expiresInHours
			? new Date(Date.now() + expiresInHours * 3600_000)
			: null;

		const inviteCode = await prisma.inviteCode.create({
			data: {
				code,
				playGroundId: id,
				createdBy: session.user.id,
				maxUses,
				expiresAt,
			},
		});

		return NextResponse.json(inviteCode, { status: 201 });
	} catch (error) {
		console.error("Failed to generate invite code:", error);
		return NextResponse.json(
			{ error: "Failed to generate invite code" },
			{ status: 500 },
		);
	}
}
