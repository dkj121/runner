# Logger Documentation

Comprehensive logging system for the Runner application using Pino with full TypeScript type safety.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Advanced Usage](#advanced-usage)
- [Type Safety](#type-safety)
- [Configuration](#configuration)
- [Helper Functions](#helper-functions)
- [Integration Examples](#integration-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Features

- ✅ **Structured Logging**: JSON logs in production, pretty-printed in development
- ✅ **Multiple Log Levels**: trace, debug, info, warn, error, fatal
- ✅ **Module-Specific Loggers**: Pre-configured loggers for different components
- ✅ **Performance Tracking**: Built-in performance logging with `PerformanceLogger`
- ✅ **Context Propagation**: Request ID, user ID, playground ID tracking
- ✅ **Security & Privacy**: Email masking, sensitive data filtering
- ✅ **Custom Serializers**: Automatic formatting for users, playgrounds, errors
- ✅ **Environment-Aware**: Different behaviors for dev/prod/test
- ✅ **Type-Safe**: Uses Prisma-generated types, zero `any` types
- ✅ **Extensible**: Easy to add new loggers and contexts

## Installation

Already installed via pnpm:

```bash
pnpm add pino pino-pretty
```

## Basic Usage

### Import the Logger

```typescript
import { logger } from "@/lib/logger";

// Simple logging
logger.info("Application started");
logger.debug("Debug information");
logger.warn("Warning message");
logger.error("Error occurred");
```

### Module-Specific Loggers

```typescript
import { loggers } from "@/lib/logger";

// Authentication logs
loggers.auth.info("User logged in");

// Playground logs
loggers.playground.debug("Playground created");

// GPS tracking logs
loggers.gps.info("GPS point received");

// Database logs
loggers.prisma.debug("Query executed");

// Redis logs
loggers.redis.debug("Cache hit");
```

Available module loggers:

- `loggers.auth` - Authentication & authorization
- `loggers.playground` - Playground operations
- `loggers.run` - Run records & tracking
- `loggers.gps` - GPS data & tracking
- `loggers.leaderboard` - Ranking & leaderboard
- `loggers.redis` - Redis cache operations
- `loggers.prisma` - Database queries
- `loggers.api` - API requests/responses
- `loggers.email` - Email sending (Resend)
- `loggers.invite` - Invite code operations
- `loggers.schedule` - Schedule management
- `loggers.voice` - Voice chat features

## Advanced Usage

### Creating Child Loggers with Context

```typescript
import { createLogger } from "@/lib/logger";

// Create a logger with user context
const userLogger = createLogger({ userId: "user123" });
userLogger.info("User performed action");
// Output: {"level":30,"userId":"user123","msg":"User performed action"}

// Create a logger for a specific module
const playgroundLogger = createLogger({ playgroundId: "pg123" }, "playground");
playgroundLogger.debug("Member joined");
// Output: {"level":20,"module":"playground","playgroundId":"pg123","msg":"Member joined"}
```

### Performance Logging

```typescript
import { PerformanceLogger } from "@/lib/logger";

async function createPlayground(data: CreatePlaygroundInput) {
	const perf = new PerformanceLogger("createPlayground", {
		userId: data.userId,
	});

	try {
		// Add checkpoints
		perf.checkpoint("validation");

		// Your code here
		const playground = await prisma.playGround.create({ data });

		perf.checkpoint("database");

		// Mark as done
		perf.done({ playgroundId: playground.id });

		return playground;
	} catch (error) {
		perf.error(error as Error);
		throw error;
	}
}
```

## Type Safety

### Prisma-Generated Types

The logger uses actual Prisma types for type safety:

```typescript
import type {
	User,
	PlayGround,
	RunRecord,
} from "../../generated/prisma/client";

// Serializers use Prisma types
user: (user: unknown) => {
	const u = user as Partial<User>;
	return {
		id: u.id,
		name: u.name,
		email: typeof u.email === "string" ? maskEmail(u.email) : undefined,
	};
};
```

### Benefits

✅ **Type Safety**: Full TypeScript type checking with Prisma types  
✅ **ESLint Compliant**: Zero `any` types, passes strict linting rules  
✅ **IntelliSense**: Better IDE autocomplete and type inference  
✅ **Maintainable**: Schema changes automatically update logger types  
✅ **Runtime Safety**: Proper type guards prevent runtime errors

### Usage with Prisma Models

```typescript
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

// Fetch user from database
const user = await prisma.user.findUnique({ where: { id: userId } });

// Log with type-safe serializer
logger.info({ user }, "User logged in");
// Output: {"level":30,"user":{"id":"...","name":"...","email":"z***g@example.com"}}

// Fetch playground with relations
const playground = await prisma.playGround.findUnique({
	where: { id: playgroundId },
	include: { _count: { select: { users: true } } },
});

// Log with type-safe serializer
logger.info({ playground }, "Playground activity");
// Output: {"level":30,"playground":{"id":"...","name":"晨跑团","memberCount":15}}
```

## Configuration

### Environment Variables

```bash
# Log level (trace|debug|info|warn|error|fatal)
LOG_LEVEL=debug

# Enable logging in test environment
LOG_IN_TESTS=true

# Debug flags
DEBUG_GPS=true
```

### Log Levels

- **trace** (10): Most verbose, every detail
- **debug** (20): Development debugging info
- **info** (30): General informational messages (default in production)
- **warn** (40): Warning messages, potential issues
- **error** (50): Error messages, exceptions
- **fatal** (60): Critical errors, application crash

### Output Format

**Development** (pretty-printed):

```
[2026-08-02 10:30:45] INFO (playground): Playground created
    playgroundId: "cm4abc123"
    userId: "user123"
    name: "晨跑团"
```

**Production** (JSON):

```json
{
	"level": 30,
	"time": "2026-08-02T10:30:45.123Z",
	"pid": 12345,
	"hostname": "server-01",
	"env": "production",
	"module": "playground",
	"playgroundId": "cm4abc123",
	"userId": "user123",
	"name": "晨跑团",
	"msg": "Playground created"
}
```

## Helper Functions

### Log API Requests

```typescript
import { logApiRequest } from "@/lib/logger";

export async function GET(request: Request) {
	const startTime = Date.now();

	// Your handler logic
	const response = NextResponse.json({ data: "..." });

	logApiRequest("GET", "/api/playgrounds", 200, Date.now() - startTime, {
		userId: session.user.id,
	});

	return response;
}
```

### Log Authentication Events

```typescript
import { logAuthEvent } from "@/lib/logger";

// Successful login
logAuthEvent("login", userId, true, { method: "email" });

// Failed login attempt
logAuthEvent("login", userId, false, {
	reason: "invalid_password",
	ip: request.ip,
});

// User signup
logAuthEvent("signup", userId, true, { method: "email" });
```

### Log Playground Activities

```typescript
import { logPlaygroundActivity } from "@/lib/logger";

// User creates playground
logPlaygroundActivity("create", playgroundId, userId, {
	name: playground.name,
	visibility: playground.visibility,
});

// User joins playground
logPlaygroundActivity("join", playgroundId, userId, {
	inviteCode: code,
});

// User leaves playground
logPlaygroundActivity("leave", playgroundId, userId);
```

### Log GPS Data

```typescript
import { logGpsPoint } from "@/lib/logger";

// Log GPS point received
logGpsPoint(runRecordId, pointCount, {
	lat: point.lat,
	lng: point.lng,
});
```

### Log Database Operations

```typescript
import { logDatabaseOperation } from "@/lib/logger";

const startTime = Date.now();
const users = await prisma.user.findMany();
const duration = Date.now() - startTime;

logDatabaseOperation("findMany", "User", duration, {
	count: users.length,
});
```

### Log Redis Operations

```typescript
import { logRedisOperation } from "@/lib/logger";

const startTime = Date.now();
const value = await redis.get(key);
const duration = Date.now() - startTime;

logRedisOperation("get", key, duration, {
	hit: !!value,
});
```

### Log Errors

```typescript
import { logError } from "@/lib/logger";

try {
	// Your code
} catch (error) {
	logError(error as Error, {
		operation: "createPlayground",
		userId: session.user.id,
		playgroundData: data,
	});
	throw error;
}
```

### Log Security Events

```typescript
import { logSecurityEvent } from "@/lib/logger";

// Failed authentication attempts
logSecurityEvent("multiple_failed_login_attempts", "high", {
	userId,
	attemptCount: 5,
	ip: request.ip,
});

// Suspicious activity
logSecurityEvent("rate_limit_exceeded", "medium", {
	userId,
	endpoint: "/api/playgrounds",
});

// Critical security issue
logSecurityEvent("unauthorized_access_attempt", "critical", {
	userId,
	resource: "admin_panel",
});
```

### Request Logger for API Routes

```typescript
import { createRequestLogger } from "@/lib/logger";

export async function POST(request: Request) {
	const session = await auth.api.getSession({ headers: await headers() });
	const requestId = crypto.randomUUID();

	const logger = createRequestLogger(requestId, session?.user?.id);

	logger.info("Request received");

	try {
		// Your handler logic
		logger.debug("Processing request", { body: await request.json() });

		const result = await processRequest();

		logger.info("Request completed successfully");
		return NextResponse.json(result);
	} catch (error) {
		logger.error({ err: error }, "Request failed");
		return NextResponse.json({ error: "Internal error" }, { status: 500 });
	}
}
```

### Conditional Logging

```typescript
import { createConditionalLogger } from "@/lib/logger";

// Only log when debug flag is enabled
const debugLogger = createConditionalLogger(
	() => process.env.DEBUG_GPS === "true",
);

debugLogger.info("This only logs when DEBUG_GPS=true");
```

## Integration Examples

### API Route with Full Logging

```typescript
import {
	createRequestLogger,
	PerformanceLogger,
	logApiRequest,
	logError,
} from "@/lib/logger";

export async function POST(request: Request) {
	const startTime = Date.now();
	const requestId = crypto.randomUUID();

	const session = await auth.api.getSession({ headers: await headers() });
	const logger = createRequestLogger(requestId, session?.user?.id);

	logger.info("POST /api/playgrounds - Request received");

	const perf = new PerformanceLogger("createPlayground", {
		userId: session.user.id,
		requestId,
	});

	try {
		const body = await request.json();
		logger.debug({ body }, "Request body parsed");

		perf.checkpoint("validation");

		const playground = await prisma.playGround.create({
			data: { name: body.name /* ... */ },
		});

		perf.checkpoint("database");
		perf.done({ playgroundId: playground.id });

		const duration = Date.now() - startTime;
		logApiRequest("POST", "/api/playgrounds", 201, duration, {
			userId: session.user.id,
			playgroundId: playground.id,
		});

		return NextResponse.json(playground, { status: 201 });
	} catch (error) {
		const duration = Date.now() - startTime;

		perf.error(error as Error);
		logError(error as Error, {
			operation: "createPlayground",
			userId: session.user.id,
			requestId,
		});

		logApiRequest("POST", "/api/playgrounds", 500, duration, {
			userId: session.user.id,
			error: (error as Error).message,
		});

		return NextResponse.json(
			{ error: "Failed to create playground" },
			{ status: 500 },
		);
	}
}
```

### Server Action with Logging

```typescript
import {
	loggers,
	PerformanceLogger,
	logPlaygroundActivity,
} from "@/lib/logger";

export async function createPlayGround(data: CreatePlaygroundInput) {
	const userId = await getUserId();
	const perf = new PerformanceLogger("createPlayGround", { userId });

	loggers.playground.info({ userId, name: data.name }, "Creating playground");

	try {
		const playground = await prisma.playGround.create({
			data: {
				name: data.name,
				// ...
				users: { create: { userId, role: "OWNER" } },
			},
		});

		perf.done({ playgroundId: playground.id });

		logPlaygroundActivity("create", playground.id, userId, {
			name: playground.name,
			visibility: playground.visibility,
		});

		revalidatePath("/dashboard");
		return playground;
	} catch (error) {
		perf.error(error as Error);
		loggers.playground.error(
			{ err: error, userId, data },
			"Failed to create playground",
		);
		throw error;
	}
}
```

## Best Practices

### 1. Use Appropriate Log Levels

```typescript
// ✅ Good
logger.debug("GPS point received", { lat, lng }); // Debug info
logger.info("User created playground"); // Important events
logger.warn("Invite code about to expire"); // Warnings
logger.error({ err }, "Failed to create playground"); // Errors

// ❌ Bad
logger.info("GPS point received"); // Too verbose for info
logger.error("User created playground"); // Not an error
```

### 2. Include Context

```typescript
// ✅ Good
logger.info(
	{ userId, playgroundId, operation: "join" },
	"User joined playground",
);

// ❌ Bad
logger.info("User joined");
```

### 3. Use Module-Specific Loggers

```typescript
// ✅ Good
loggers.auth.info("User authenticated");
loggers.playground.debug("Playground created");

// ❌ Bad (loses module context)
logger.info("User authenticated");
logger.debug("Playground created");
```

### 4. Don't Log Sensitive Data

```typescript
// ✅ Good
logger.info({ userId }, "Password reset");

// ❌ Bad (logs password!)
logger.info({ userId, password }, "Password reset");
```

### 5. Use Performance Logger for Long Operations

```typescript
// ✅ Good
const perf = new PerformanceLogger("generateLeaderboard");
// ... operation ...
perf.done();

// ❌ Bad (manual timing)
const start = Date.now();
// ... operation ...
logger.info(`Took ${Date.now() - start}ms`);
```

### 6. Use Type-Safe Serializers

```typescript
// ✅ Good - Uses Prisma types
const user = await prisma.user.findUnique({ where: { id } });
logger.info({ user }, "User logged in");

// ❌ Bad - Manual object construction
logger.info(
	{
		user: { id: user.id, name: user.name },
	},
	"User logged in",
);
```

## Custom Serializers

The logger automatically formats these Prisma models:

### User Serializer

```typescript
logger.info({ user }, "User logged in");
// Email is masked: z***g@example.com
// Only id, name, masked email are logged
```

### Playground Serializer

```typescript
logger.info({ playground }, "Playground activity");
// Only id, name, visibility, memberCount are logged
```

### Run Record Serializer

```typescript
logger.info({ runRecord }, "Run completed");
// Only id, userId, distance, duration, avgPace are logged
```

### Error Serializer

```typescript
logger.error({ err: error }, "Operation failed");
// Includes error message, stack trace, and error type
```

## Troubleshooting

### Logs not appearing in development?

Check `LOG_LEVEL` environment variable:

```bash
LOG_LEVEL=debug pnpm dev
```

### Want JSON logs in development?

Remove the `transport` section in `logger.ts` or set:

```bash
NODE_ENV=production pnpm dev
```

### Logs cluttering test output?

Tests automatically silence logs unless:

```bash
LOG_IN_TESTS=true pnpm test
```

### Need to debug a specific module?

Use conditional logger:

```bash
DEBUG_GPS=true pnpm dev
```

## Performance Considerations

- Pino is one of the fastest Node.js loggers (~30,000 ops/sec)
- Structured logging has minimal overhead
- Pretty printing in development adds ~20% overhead (acceptable for dev)
- JSON logging in production is fast and machine-parseable
- Child loggers reuse the base logger instance (efficient)

## API Reference

### Core Exports

- `logger: Logger` - Base logger instance
- `loggers: Record<string, Logger>` - Module-specific loggers
- `createLogger(context?, moduleName?): Logger` - Create child logger
- `PerformanceLogger` - Performance tracking class

### Helper Functions

- `createRequestLogger(requestId, userId?): Logger`
- `logDatabaseOperation(operation, model, duration, context?)`
- `logRedisOperation(operation, key, duration, context?)`
- `logApiRequest(method, path, statusCode, duration, context?)`
- `logGpsPoint(runRecordId, pointCount, context?)`
- `logPlaygroundActivity(activity, playgroundId, userId, context?)`
- `logAuthEvent(event, userId, success, context?)`
- `logError(error, context?, customLogger?)`
- `logSecurityEvent(event, severity, context?)`
- `createConditionalLogger(condition, baseLogger?): Logger`

### Types

```typescript
interface LogContext {
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
```

## Migration from console.log

```typescript
// Before
console.log("User created playground", playgroundId);

// After
loggers.playground.info({ playgroundId }, "User created playground");
```

## Future Enhancements

- [ ] Log aggregation to external service (Datadog, Logtail, etc.)
- [ ] Log rotation for file-based logging
- [ ] Sampling for high-volume logs
- [ ] OpenTelemetry integration
- [ ] Log filtering and redaction rules
- [ ] Real-time log streaming for debugging
