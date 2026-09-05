import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint for Docker healthcheck and monitoring
 * Tests database connectivity
 */
export async function GET() {
	try {
		// Check database connection
		await prisma.$queryRaw`SELECT 1`;

		// TODO: Add Redis health check when redis client is fully implemented
		// import { redis } from "@/lib/redis";
		// await redis.ping();

		return NextResponse.json(
			{
				status: "healthy",
				timestamp: new Date().toISOString(),
				services: {
					database: "connected",
					redis: "not_implemented", // Change to "connected" when redis.ping() works
				},
			},
			{ status: 200 },
		);
	} catch (error) {
		// Log detailed error server-side only
		if (error instanceof Error) {
			logger.error(
				{
					error: error.message,
					stack: error.stack,
				},
				"Health check failed",
			);
		} else {
			logger.error({ error: String(error) }, "Health check failed");
		}

		// Return generic error to client
		return NextResponse.json(
			{
				status: "unhealthy",
				timestamp: new Date().toISOString(),
			},
			{ status: 503 },
		);
	}
}
