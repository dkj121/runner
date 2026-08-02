/**
 * Example: Integrating Logger with Server Actions
 * This file demonstrates how to add logging to server actions in actions.ts
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
	loggers,
	PerformanceLogger,
	logPlaygroundActivity,
	logAuthEvent,
	logError,
	logSecurityEvent,
} from "@/lib/logger";

/**
 * Example 1: Create Playground with logging
 */
export async function createPlayGround(data: {
	name: string;
	description?: string;
	visibility?: "PUBLIC" | "PRIVATE";
	locationLat?: number;
	locationLng?: number;
	locationAddr?: string;
}) {
	const session = await auth.api.getSession({ headers: await headers() });
	const userId = session?.user?.id;

	if (!userId) {
		loggers.auth.warn("Unauthorized playground creation attempt");
		throw new Error("Unauthorized");
	}

	const perf = new PerformanceLogger("createPlayGround", {
		userId,
		playgroundName: data.name,
	});

	loggers.playground.info({ userId, name: data.name }, "Creating playground");

	try {
		const playground = await prisma.playGround.create({
			data: {
				name: data.name,
				description: data.description,
				visibility: data.visibility || "PUBLIC",
				locationLat: data.locationLat,
				locationLng: data.locationLng,
				locationAddr: data.locationAddr,
				users: {
					create: {
						userId,
						role: "OWNER",
					},
				},
			},
		});

		perf.done({ playgroundId: playground.id });

		logPlaygroundActivity("create", playground.id, userId, {
			name: playground.name,
			visibility: playground.visibility,
		});

		loggers.playground.info(
			{ playgroundId: playground.id, name: playground.name },
			"Playground created successfully",
		);

		revalidatePath("/dashboard");
		return playground;
	} catch (error) {
		perf.error(error as Error);
		logError(error as Error, {
			operation: "createPlayGround",
			userId,
			playgroundData: data,
		});
		throw error;
	}
}

/**
 * Example 2: Join Playground with comprehensive logging
 */
export async function joinPlayGround(inviteCode: string) {
	const session = await auth.api.getSession({ headers: await headers() });
	const userId = session?.user?.id;

	if (!userId) {
		loggers.auth.warn({ inviteCode: inviteCode.substring(0, 3) + "***" }, "Unauthorized join attempt");
		throw new Error("Unauthorized");
	}

	const perf = new PerformanceLogger("joinPlayGround", {
		userId,
		inviteCode: inviteCode.substring(0, 3) + "***",
	});

	loggers.playground.info(
		{ userId, inviteCode: inviteCode.substring(0, 3) + "***" },
		"User attempting to join playground",
	);

	try {
		const code = await prisma.inviteCode.findUnique({
			where: { code: inviteCode },
			include: { playGround: true },
		});

		perf.checkpoint("code-lookup");

		if (!code || !code.isActive) {
			loggers.invite.warn(
				{ userId, inviteCode: inviteCode.substring(0, 3) + "***" },
				"Invalid or inactive invite code",
			);
			throw new Error("邀请码无效");
		}

		if (code.expiresAt && code.expiresAt < new Date()) {
			loggers.invite.warn(
				{ userId, codeId: code.id, expiresAt: code.expiresAt },
				"Expired invite code used",
			);
			throw new Error("邀请码已过期");
		}

		if (code.maxUses > 0 && code.useCount >= code.maxUses) {
			loggers.invite.warn(
				{ userId, codeId: code.id, useCount: code.useCount, maxUses: code.maxUses },
				"Invite code usage limit reached",
			);
			throw new Error("邀请码已达使用上限");
		}

		perf.checkpoint("validation");

		// Check not already a member
		const existing = await prisma.playGroundUser.findFirst({
			where: { userId, playGroundId: code.playGroundId },
		});

		if (existing) {
			loggers.playground.warn(
				{ userId, playgroundId: code.playGroundId },
				"User already a member",
			);
			throw new Error("你已经是该域成员");
		}

		perf.checkpoint("membership-check");

		await prisma.$transaction([
			prisma.playGroundUser.create({
				data: { userId, playGroundId: code.playGroundId, role: "USER" },
			}),
			prisma.inviteCode.update({
				where: { id: code.id },
				data: { useCount: { increment: 1 } },
			}),
		]);

		perf.checkpoint("transaction");

		logPlaygroundActivity("join", code.playGroundId, userId, {
			inviteCode: inviteCode.substring(0, 3) + "***",
			playgroundName: code.playGround.name,
			codeUseCount: code.useCount + 1,
		});

		perf.done({ playgroundId: code.playGroundId });

		loggers.playground.info(
			{ userId, playgroundId: code.playGroundId },
			"User joined playground successfully",
		);

		revalidatePath("/playground");
		return code.playGround;
	} catch (error) {
		perf.error(error as Error);
		logError(error as Error, {
			operation: "joinPlayGround",
			userId,
			inviteCode: inviteCode.substring(0, 3) + "***",
		});
		throw error;
	}
}

/**
 * Example 3: Leave Playground with activity logging
 */
export async function leavePlayGround(playGroundId: string) {
	const session = await auth.api.getSession({ headers: await headers() });
	const userId = session?.user?.id;

	if (!userId) {
		loggers.auth.warn({ playGroundId }, "Unauthorized leave attempt");
		throw new Error("Unauthorized");
	}

	const perf = new PerformanceLogger("leavePlayGround", {
		userId,
		playGroundId,
	});

	loggers.playground.info({ userId, playGroundId }, "User attempting to leave playground");

	try {
		const membership = await prisma.playGroundUser.findFirst({
			where: { userId, playGroundId },
		});

		if (!membership) {
			loggers.playground.warn({ userId, playGroundId }, "User not a member");
			throw new Error("你不是该域成员");
		}

		if (membership.role === "OWNER") {
			loggers.playground.warn(
				{ userId, playGroundId },
				"Owner attempted to leave playground",
			);
			throw new Error("域主不能退出，请先转让或删除域");
		}

		perf.checkpoint("validation");

		await prisma.playGroundUser.delete({ where: { id: membership.id } });

		perf.checkpoint("database-delete");

		logPlaygroundActivity("leave", playGroundId, userId);

		perf.done();

		loggers.playground.info(
			{ userId, playGroundId },
			"User left playground successfully",
		);

		revalidatePath("/playground");
	} catch (error) {
		perf.error(error as Error);
		logError(error as Error, {
			operation: "leavePlayGround",
			userId,
			playGroundId,
		});
		throw error;
	}
}

/**
 * Example 4: Generate Invite Code with logging
 */
export async function generateInviteCode(
	playGroundId: string,
	options?: { maxUses?: number; expiresInHours?: number },
) {
	const session = await auth.api.getSession({ headers: await headers() });
	const userId = session?.user?.id;

	if (!userId) {
		loggers.auth.warn({ playGroundId }, "Unauthorized invite code generation");
		throw new Error("Unauthorized");
	}

	const perf = new PerformanceLogger("generateInviteCode", {
		userId,
		playGroundId,
	});

	loggers.invite.info(
		{ userId, playGroundId, maxUses: options?.maxUses, expiresInHours: options?.expiresInHours },
		"Generating invite code",
	);

	try {
		const pg = await prisma.playGroundUser.findFirst({
			where: { playGroundId, userId, role: "OWNER" },
		});

		if (!pg) {
			loggers.invite.warn(
				{ userId, playGroundId },
				"Non-owner attempted to generate invite code",
			);
			throw new Error("Only the owner can generate invite codes");
		}

		perf.checkpoint("authorization");

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

		perf.checkpoint("database-insert");
		perf.done({ inviteCode: code.substring(0, 3) + "***" });

		loggers.invite.info(
			{
				userId,
				playGroundId,
				inviteCode: code.substring(0, 3) + "***",
				maxUses: options?.maxUses ?? 0,
				expiresAt,
			},
			"Invite code generated successfully",
		);

		revalidatePath(`/playground/${playGroundId}`);
		return code;
	} catch (error) {
		perf.error(error as Error);
		logError(error as Error, {
			operation: "generateInviteCode",
			userId,
			playGroundId,
		});
		throw error;
	}
}

/**
 * Example 5: Delete Playground with security logging
 */
export async function deletePlayGround(id: string) {
	const session = await auth.api.getSession({ headers: await headers() });
	const userId = session?.user?.id;

	if (!userId) {
		loggers.auth.warn({ playGroundId: id }, "Unauthorized delete attempt");
		throw new Error("Unauthorized");
	}

	const perf = new PerformanceLogger("deletePlayGround", {
		userId,
		playGroundId: id,
	});

	loggers.playground.warn({ userId, playGroundId: id }, "Attempting to delete playground");

	try {
		const pg = await prisma.playGroundUser.findFirst({
			where: { playGroundId: id, userId, role: "OWNER" },
			include: { playGround: true },
		});

		if (!pg) {
			logSecurityEvent("unauthorized_delete_attempt", "medium", {
				userId,
				playGroundId: id,
				operation: "deletePlayGround",
			});
			throw new Error("Only the owner can delete");
		}

		perf.checkpoint("authorization");

		// Get member count before deletion for logging
		const memberCount = await prisma.playGroundUser.count({
			where: { playGroundId: id },
		});

		await prisma.playGround.delete({ where: { id } });

		perf.checkpoint("database-delete");

		logPlaygroundActivity("delete", id, userId, {
			name: pg.playGround.name,
			memberCount,
		});

		perf.done();

		loggers.playground.warn(
			{ userId, playGroundId: id, memberCount },
			"Playground deleted successfully",
		);

		revalidatePath("/dashboard");
		revalidatePath("/playground");
	} catch (error) {
		perf.error(error as Error);
		logError(error as Error, {
			operation: "deletePlayGround",
			userId,
			playGroundId: id,
		});
		throw error;
	}
}

/**
 * Example 6: Authentication with logging
 */
export async function signUpUser(email: string, password: string, name: string) {
	const perf = new PerformanceLogger("signUpUser", { email: maskEmail(email) });

	loggers.auth.info({ email: maskEmail(email) }, "User signup attempt");

	try {
		// Your signup logic here
		const user = await createUser(email, password, name);

		perf.checkpoint("user-created");

		// Send verification email
		await sendVerificationEmail(user.email);

		perf.checkpoint("email-sent");

		logAuthEvent("signup", user.id, true, {
			email: maskEmail(email),
			method: "email",
		});

		perf.done({ userId: user.id });

		loggers.auth.info({ userId: user.id }, "User signed up successfully");

		return user;
	} catch (error) {
		perf.error(error as Error);

		logAuthEvent("signup", "", false, {
			email: maskEmail(email),
			error: (error as Error).message,
		});

		logError(error as Error, {
			operation: "signUpUser",
			email: maskEmail(email),
		});

		throw error;
	}
}

/**
 * Helper function to generate random code
 */
function generateCode(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let code = "";
	for (let i = 0; i < 6; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

/**
 * Helper function to mask email
 */
function maskEmail(email: string): string {
	const [local, domain] = email.split("@");
	if (!local || !domain) return "***@***";

	const maskedLocal = local.length > 2
		? `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}`
		: "**";

	return `${maskedLocal}@${domain}`;
}

/**
 * Placeholder functions (implement according to your auth system)
 */
async function createUser(email: string, password: string, name: string) {
	// Implementation here
	return { id: "user123", email, name };
}

async function sendVerificationEmail(email: string) {
	// Implementation here
}
