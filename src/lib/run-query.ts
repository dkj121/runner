import { Prisma } from "../../generated/prisma/client";

export const COMPLETED_RUN_FILTER = {
	status: "COMPLETED",
	trackPoints: { not: Prisma.DbNull },
} as const;
