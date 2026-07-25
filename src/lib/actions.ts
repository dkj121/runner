"use server";

import { prisma } from "./prisma";
import { createRunSession, clearRunSession } from "./gps-cache";
import { revalidatePath } from "next/cache";

export async function createRunRecord(userId: string) {
	const record = await prisma.runRecord.create({
		data: { userId, startTime: new Date() },
	});

	await createRunSession(record.id, userId);

	revalidatePath("/run");
	return { runId: record.id };
}

export async function updateRunRecord(
	runId: string,
	data: {
		endTime: string;
		duration: number;
		distance: number;
		avgPace: string;
		trackPoints?: { lat: number; lng: number; timestamp: number }[];
		calories?: number;
		splits?: { km: number; pace: string }[];
		notes?: string;
	},
) {
	const record = await prisma.runRecord.update({
		where: { id: runId },
		data: {
			endTime: new Date(data.endTime),
			duration: data.duration,
			distance: data.distance,
			avgPace: data.avgPace,
			...(data.trackPoints !== undefined && { trackPoints: data.trackPoints }),
			...(data.calories !== undefined && { calories: data.calories }),
			...(data.splits !== undefined && { splits: data.splits }),
			...(data.notes !== undefined && { notes: data.notes }),
		},
	});

	await clearRunSession(runId, record.userId);

	revalidatePath("/run");
	revalidatePath("/summary");
	return { ok: true };
}

export async function getUserRunRecords(
	userId: string,
	options?: { take?: number; skip?: number },
) {
	const take = Math.min(options?.take ?? 20, 100);
	const skip = options?.skip ?? 0;

	const [records, total] = await Promise.all([
		prisma.runRecord.findMany({
			where: { userId },
			orderBy: { startTime: "desc" },
			take,
			skip,
		}),
		prisma.runRecord.count({ where: { userId } }),
	]);

	return { records, total };
}

export async function getRunRecord(runId: string) {
	const record = await prisma.runRecord.findUnique({
		where: { id: runId },
	});

	if (!record) throw new Error("run not found");

	return record;
}
