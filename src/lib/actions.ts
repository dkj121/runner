"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type OtpPurpose = "sign-in" | "email-verification" | "forget-password";

// ─── helpers ────────────────────────────────────────────

async function getUserId(): Promise<string> {
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	if (!session?.user?.id) throw new Error("Unauthorized");
	return session.user.id;
}

function generateCode(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	const randomBytes = new Uint8Array(6);
	crypto.getRandomValues(randomBytes);
	return Array.from(randomBytes, (b) => chars[b % chars.length]).join("");
}

// ─── PlayGround CRUD ───────────────────────────────────

export async function createPlayGround(data: {
	name: string;
	visibility: "PUBLIC" | "PRIVATE";
	description?: string;
	location?: { lat: number; lng: number; address: string };
}) {
	const userId = await getUserId();

	const playground = await prisma.playGround.create({
		data: {
			name: data.name,
			visibility: data.visibility,
			description: data.description ?? null,
			locationLat: data.location?.lat ?? null,
			locationLng: data.location?.lng ?? null,
			locationAddr: data.location?.address ?? null,
			users: {
				create: { userId, role: "OWNER" },
			},
			rankinglist: {
				create: {},
			},
		},
		include: { users: true, inviteCodes: true },
	});

	// Auto-generate an invite code
	const code = generateCode();
	await prisma.inviteCode.create({
		data: {
			code,
			playGroundId: playground.id,
			createdBy: userId,
		},
	});

	revalidatePath("/dashboard");
	revalidatePath("/playground");

	return { playground, inviteCode: code };
}

export async function getPlayGround(id: string) {
	const userId = await getUserId().catch(() => null);
	const pg = await prisma.playGround.findUnique({
		where: { id },
		include: {
			users: {
				include: { user: { select: { id: true, name: true, image: true } } },
			},
			inviteCodes: {
				where: { isActive: true },
				orderBy: { createdAt: "desc" },
				take: 1,
			},
			rankinglist: true,
			_count: { select: { users: true } },
		},
	});
	if (!pg) return null;
	// PUBLIC playgrounds visible to all; PRIVATE require membership
	if (
		pg.visibility !== "PUBLIC" &&
		!pg.users.some((u) => u.userId === userId)
	) {
		throw new Error("Not authorized");
	}
	return pg;
}

export async function listPublicPlayGrounds() {
	return prisma.playGround.findMany({
		where: { visibility: "PUBLIC" },
		include: {
			_count: { select: { users: true } },
		},
		orderBy: { createdAt: "desc" },
		take: 20,
	});
}

export async function listMyPlayGrounds() {
	const userId = await getUserId();
	return prisma.playGround.findMany({
		where: { users: { some: { userId } } },
		include: {
			_count: { select: { users: true } },
			users: {
				where: { role: "OWNER" },
				include: { user: { select: { name: true } } },
			},
		},
		orderBy: { updatedAt: "desc" },
	});
}

export async function updatePlayGround(
	id: string,
	data: {
		name?: string;
		description?: string;
		visibility?: "PUBLIC" | "PRIVATE";
		locationLat?: number | null;
		locationLng?: number | null;
		locationAddr?: string | null;
	},
) {
	const userId = await getUserId();
	const pg = await prisma.playGroundUser.findFirst({
		where: { playGroundId: id, userId, role: "OWNER" },
	});
	if (!pg) throw new Error("Only the owner can update");

	const updated = await prisma.playGround.update({
		where: { id },
		data,
	});

	revalidatePath(`/playground/${id}`);
	return updated;
}

export async function deletePlayGround(id: string) {
	const userId = await getUserId();
	const pg = await prisma.playGroundUser.findFirst({
		where: { playGroundId: id, userId, role: "OWNER" },
	});
	if (!pg) throw new Error("Only the owner can delete");

	await prisma.playGround.delete({ where: { id } });

	revalidatePath("/dashboard");
	revalidatePath("/playground");
}

// ─── Membership ────────────────────────────────────────

export async function joinPlayGround(inviteCode: string) {
	const userId = await getUserId();

	const code = await prisma.inviteCode.findUnique({
		where: { code: inviteCode },
		include: { playGround: true },
	});

	if (!code || !code.isActive) throw new Error("邀请码无效");
	if (code.expiresAt && code.expiresAt < new Date())
		throw new Error("邀请码已过期");
	if (code.maxUses > 0 && code.useCount >= code.maxUses)
		throw new Error("邀请码已达使用上限");

	// Check not already a member
	const existing = await prisma.playGroundUser.findFirst({
		where: { userId, playGroundId: code.playGroundId },
	});
	if (existing) throw new Error("你已经是该域成员");

	await prisma.$transaction([
		prisma.playGroundUser.create({
			data: { userId, playGroundId: code.playGroundId, role: "USER" },
		}),
		prisma.inviteCode.update({
			where: { id: code.id },
			data: { useCount: { increment: 1 } },
		}),
	]);

	revalidatePath("/playground");
	return code.playGround;
}

export async function joinPlayGroundByInvite(inviteCode: string) {
	return joinPlayGround(inviteCode);
}

export async function leavePlayGround(playGroundId: string) {
	const userId = await getUserId();

	const membership = await prisma.playGroundUser.findFirst({
		where: { userId, playGroundId },
	});
	if (!membership) throw new Error("你不是该域成员");
	if (membership.role === "OWNER")
		throw new Error("域主不能退出，请先转让或删除域");

	await prisma.playGroundUser.delete({ where: { id: membership.id } });

	revalidatePath("/playground");
}

// ─── Invite Codes ──────────────────────────────────────

export async function generateInviteCode(
	playGroundId: string,
	options?: { maxUses?: number; expiresInHours?: number },
) {
	const userId = await getUserId();
	const pg = await prisma.playGroundUser.findFirst({
		where: { playGroundId, userId, role: "OWNER" },
	});
	if (!pg) throw new Error("Only the owner can generate invite codes");

	const code = generateCode();
	const expiresAt = options?.expiresInHours
		? new Date(Date.now() + options.expiresInHours * 3600_000)
		: null;

	await prisma.inviteCode.create({
		data: {
			code,
			playGroundId,
			createdBy: userId,
			maxUses: options?.maxUses ?? 0,
			expiresAt,
		},
	});

	revalidatePath(`/playground/${playGroundId}`);
	return code;
}

// ─── Ranking / Leaderboard ─────────────────────────────

export async function getPlayGroundLeaderboard(playGroundId: string) {
	const userId = await getUserId().catch(() => null);
	const pg = await prisma.playGround.findUnique({
		where: { id: playGroundId },
		include: { users: true },
	});
	if (!pg) throw new Error("Not found");
	if (
		pg.visibility !== "PUBLIC" &&
		!pg.users.some((u) => u.userId === userId)
	) {
		throw new Error("Not authorized");
	}

	const rankingList = await prisma.playGroundRankingList.findUnique({
		where: { playGroundId },
		include: {
			runRecords: {
				include: { user: { select: { id: true, name: true, image: true } } },
				orderBy: { distance: "desc" },
			},
		},
	});

	if (!rankingList) return [];

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

	return Array.from(userMap.values()).sort(
		(a, b) => b.totalDistance - a.totalDistance,
	);
}

export async function getPlayGroundMembers(playGroundId: string) {
	const userId = await getUserId().catch(() => null);
	const pg = await prisma.playGround.findUnique({
		where: { id: playGroundId },
	});
	if (!pg) throw new Error("Not found");
	if (pg.visibility !== "PUBLIC") {
		const membership = await prisma.playGroundUser.findFirst({
			where: { playGroundId, userId: userId ?? "" },
		});
		if (!membership) throw new Error("Not authorized");
	}
	return prisma.playGroundUser.findMany({
		where: { playGroundId },
		include: { user: { select: { id: true, name: true, image: true } } },
		orderBy: { createdAt: "asc" },
	});
}

// ─── Schedule ──────────────────────────────────────────

export async function getPlayGroundSchedule(playGroundId: string) {
	return prisma.playGroundSchedule.findUnique({
		where: { playGroundId },
		include: { spotDates: { orderBy: { date: "asc" } } },
	});
}

export async function getUserSchedule() {
	const userId = await getUserId();
	return prisma.userSchedule.findUnique({
		where: { userId },
		include: { spotDates: { orderBy: { date: "asc" } } },
	});
}

export async function resendOtp(email: string, type: OtpPurpose) {
	const normalizedEmail = email.trim().toLowerCase();
	if (!normalizedEmail) {
		return { success: false, error: "请输入邮箱地址。" };
	}

	try {
		await auth.api.sendVerificationOTP({
			body: { email: normalizedEmail, type },
		});
		return { success: true, error: null };
	} catch {
		return { success: false, error: "验证码发送失败，请稍后重试。" };
	}
}

export async function checkSession() {
	return auth.api.getSession({ headers: await headers() });
}
