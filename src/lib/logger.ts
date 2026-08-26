import pino, { type Logger, type LoggerOptions } from "pino";
import type {
	User,
	PlayGround,
	RunRecord,
} from "../../generated/prisma/client";

/**
 * Logger configuration for the Runner application
 * Supports different environments, structured logging, and extensibility
 */

// Environment detection
const isDevelopment = process.env.NODE_ENV !== "production";
const isTest = process.env.NODE_ENV === "test";

// Log level from environment or default
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info");

/**
 * Base logger configuration
 */
const baseLoggerOptions: LoggerOptions = {
	level: logLevel,
	// Disable logging in test environment unless explicitly enabled
	...(isTest && !process.env.LOG_IN_TESTS && { level: "silent" }),

	// Custom serializers for sensitive data and error handling
	serializers: {
		req: pino.stdSerializers.req,
		res: pino.stdSerializers.res,
		err: pino.stdSerializers.err,

		// Custom serializer for user context (removes sensitive fields)
		user: (user: unknown) => {
			if (!user || typeof user !== "object") return user;
			const u = user as Partial<User>;
			return {
				id: u.id,
				name: u.name,
				email: typeof u.email === "string" ? maskEmail(u.email) : undefined,
			};
		},

		// Custom serializer for playground context
		playground: (playground: unknown) => {
			if (!playground || typeof playground !== "object") return playground;
			const pg = playground as Partial<PlayGround> & {
				_count?: { users?: number };
			};
			return {
				id: pg.id,
				name: pg.name,
				visibility: pg.visibility,
				memberCount: pg._count?.users,
			};
		},

		// Custom serializer for run records
		runRecord: (record: unknown) => {
			if (!record || typeof record !== "object") return record;
			const r = record as Partial<RunRecord>;
			return {
				id: r.id,
				userId: r.userId,
				distanceMeters: r.distanceMeters,
				durationSeconds: r.durationSeconds,
				paceSecondsPerKm: r.paceSecondsPerKm,
				status: r.status,
			};
		},
	},

	// Base context fields
	base: {
		pid: process.pid,
		hostname: process.env.HOSTNAME || "unknown",
		env: process.env.NODE_ENV || "development",
	},

	// Timestamp formatting
	timestamp: () => `,"time":"${new Date().toISOString()}"`,

	// Keep Next.js development logging in-process; pino-pretty's worker path
	// is not resolvable from the Turbopack runtime on Windows.
	...(isDevelopment && process.env.PINO_PRETTY === "true" && {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				translateTime: "SYS:standard",
				ignore: "pid,hostname",
				singleLine: false,
				messageFormat: "{levelLabel} - {msg}",
			},
		},
	}),
};

/**
 * Create the base logger instance
 */
export const logger: Logger = pino(baseLoggerOptions);

/**
 * Logger context types for structured logging
 */
export interface LogContext {
	userId?: string;
	playgroundId?: string;
	runRecordId?: string;
	requestId?: string;
	sessionId?: string;
	inviteCode?: string;
	operation?: string;
	duration?: number;
	[key: string]:
		| string
		| number
		| boolean
		| null
		| undefined
		| Record<string, unknown>;
}

/**
 * Create a child logger with specific context
 * @param context - Context to attach to all logs from this child logger
 * @param moduleName - Optional module name for namespace
 */
export function createLogger(
	context: LogContext = {},
	moduleName?: string,
): Logger {
	const childContext = {
		...(moduleName && { module: moduleName }),
		...context,
	};

	return logger.child(childContext);
}

/**
 * Module-specific loggers with predefined contexts
 */
export const loggers = {
	auth: createLogger({}, "auth"),
	playground: createLogger({}, "playground"),
	run: createLogger({}, "run"),
	gps: createLogger({}, "gps"),
	leaderboard: createLogger({}, "leaderboard"),
	redis: createLogger({}, "redis"),
	prisma: createLogger({}, "prisma"),
	api: createLogger({}, "api"),
	email: createLogger({}, "email"),
	invite: createLogger({}, "invite"),
	schedule: createLogger({}, "schedule"),
	voice: createLogger({}, "voice"),
};

/**
 * Performance logging helper
 */
export class PerformanceLogger {
	private startTime: number;
	private logger: Logger;
	private operation: string;
	private context: LogContext;

	constructor(
		operation: string,
		context: LogContext = {},
		customLogger?: Logger,
	) {
		this.startTime = Date.now();
		this.operation = operation;
		this.context = context;
		this.logger = customLogger || logger;

		this.logger.debug({ operation, ...context }, `Starting: ${operation}`);
	}

	/**
	 * Log completion with duration
	 */
	done(additionalContext: LogContext = {}): void {
		const duration = Date.now() - this.startTime;
		this.logger.info(
			{
				operation: this.operation,
				duration,
				...this.context,
				...additionalContext,
			},
			`Completed: ${this.operation} in ${duration}ms`,
		);
	}

	/**
	 * Log error with duration
	 */
	error(error: Error, additionalContext: LogContext = {}): void {
		const duration = Date.now() - this.startTime;
		this.logger.error(
			{
				operation: this.operation,
				duration,
				err: error,
				...this.context,
				...additionalContext,
			},
			`Failed: ${this.operation} after ${duration}ms - ${error.message}`,
		);
	}

	/**
	 * Add checkpoint with elapsed time
	 */
	checkpoint(label: string, additionalContext: LogContext = {}): void {
		const elapsed = Date.now() - this.startTime;
		this.logger.debug(
			{
				operation: this.operation,
				checkpoint: label,
				elapsed,
				...this.context,
				...additionalContext,
			},
			`Checkpoint [${label}]: ${elapsed}ms elapsed`,
		);
	}
}

/**
 * Request logger middleware helper
 * Creates a logger with request context
 */
export function createRequestLogger(
	requestId: string,
	userId?: string,
): Logger {
	return createLogger(
		{
			requestId,
			userId,
		},
		"request",
	);
}

/**
 * Database operation logger
 */
export function logDatabaseOperation(
	operation: string,
	model: string,
	duration: number,
	context: LogContext = {},
): void {
	loggers.prisma.debug(
		{ operation, model, duration, ...context },
		`DB ${operation} on ${model} - ${duration}ms`,
	);
}

/**
 * Redis operation logger
 */
export function logRedisOperation(
	operation: string,
	key: string,
	duration: number,
	context: LogContext = {},
): void {
	loggers.redis.debug(
		{ operation, key, duration, ...context },
		`Redis ${operation} [${key}] - ${duration}ms`,
	);
}

/**
 * API request/response logger
 */
export function logApiRequest(
	method: string,
	path: string,
	statusCode: number,
	duration: number,
	context: LogContext = {},
): void {
	const level =
		statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

	loggers.api[level](
		{ method, path, statusCode, duration, ...context },
		`${method} ${path} - ${statusCode} - ${duration}ms`,
	);
}

/**
 * GPS tracking logger for run sessions
 */
export function logGpsPoint(
	runRecordId: string,
	pointCount: number,
	context: LogContext = {},
): void {
	loggers.gps.debug(
		{ runRecordId, pointCount, ...context },
		`GPS point received - Run ${runRecordId}, Point #${pointCount}`,
	);
}

/**
 * Playground activity logger
 */
export function logPlaygroundActivity(
	activity: "create" | "join" | "leave" | "update" | "delete",
	playgroundId: string,
	userId: string,
	context: LogContext = {},
): void {
	loggers.playground.info(
		{ activity, playgroundId, userId, ...context },
		`Playground ${activity} - PG: ${playgroundId}, User: ${userId}`,
	);
}

/**
 * Authentication event logger
 */
export function logAuthEvent(
	event: "login" | "logout" | "signup" | "verify" | "reset",
	userId: string,
	success: boolean,
	context: LogContext = {},
): void {
	const level = success ? "info" : "warn";

	loggers.auth[level](
		{ event, userId, success, ...context },
		`Auth ${event} - User: ${userId} - ${success ? "Success" : "Failed"}`,
	);
}

/**
 * Error logger with stack trace
 */
export function logError(
	error: Error,
	context: LogContext = {},
	customLogger?: Logger,
): void {
	const errorLogger = customLogger || logger;

	errorLogger.error(
		{
			err: error,
			stack: error.stack,
			...context,
		},
		error.message,
	);
}

/**
 * Security event logger for suspicious activities
 */
export function logSecurityEvent(
	event: string,
	severity: "low" | "medium" | "high" | "critical",
	context: LogContext = {},
): void {
	const level =
		severity === "critical" || severity === "high" ? "error" : "warn";

	logger[level](
		{ security: true, event, severity, ...context },
		`Security Event [${severity.toUpperCase()}]: ${event}`,
	);
}

/**
 * Utility: Mask email for privacy
 */
function maskEmail(email: string): string {
	const [local, domain] = email.split("@");
	if (!local || !domain) return "***@***";

	const maskedLocal =
		local.length > 2
			? `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}`
			: "**";

	return `${maskedLocal}@${domain}`;
}

/**
 * Utility: Create a logger that only logs in specific conditions
 */
export function createConditionalLogger(
	condition: () => boolean,
	baseLogger: Logger = logger,
): Logger {
	return new Proxy(baseLogger, {
		get(target, prop) {
			const original = target[prop as keyof Logger];

			if (
				typeof original === "function" &&
				["trace", "debug", "info", "warn", "error", "fatal"].includes(
					prop as string,
				)
			) {
				return (...args: unknown[]) => {
					if (condition()) {
						return (original as (...params: unknown[]) => unknown).apply(
							target,
							args,
						);
					}
				};
			}

			return original;
		},
	});
}

/**
 * Export default logger
 */
export default logger;
