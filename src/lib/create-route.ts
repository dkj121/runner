import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
	createRequestLogger,
	PerformanceLogger,
	logApiRequest,
	logError,
} from "@/lib/logger";

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

export interface RouteContext {
	request: Request;
	/** 已解析的路径参数（Next 的 params 是异步的，这里统一 await 后传入） */
	params: Record<string, string>;
	session: Session;
	/** 当前登录用户（未登录时为 null）；auth:true 时必非空，但类型上仍为 nullable，handler 内用 `user!.id` */
	user: NonNullable<Session>["user"] | null;
	requestId: string;
	logger: ReturnType<typeof createRequestLogger>;
	perf: PerformanceLogger;
	method: string;
	path: string;
}

type RouteHandler = (ctx: RouteContext) => Promise<NextResponse>;

export interface CreateRouteOptions {
	method: string;
	/** 请求日志路径，如 "/api/playgrounds" */
	path: string;
	/** 强制登录；未登录返回 401 */
	auth?: boolean;
	/** PerformanceLogger 的 operation 名称，默认 `${method} ${path}` */
	operation?: string;
}

/**
 * API 路由深度模块：集中处理鉴权、请求日志、性能计时与异常捕获。
 *
 * 用法：
 * ```ts
 * export const GET = createRoute({ method: "GET", path: "/api/playgrounds", auth: true })(
 *   async ({ user, params, logger }) => { ... }
 * );
 * ```
 *
 * - 业务自行返回 400/404 等业务错误；
 * - wrapper 只在「未登录(401)」和「未捕获异常(500)」时兜底，并统一记录日志。
 */
export function createRoute(opts: CreateRouteOptions) {
	const { method, path, auth: requireAuth, operation } = opts;

	return function route(handler: RouteHandler) {
		return async function (
			request: Request,
			{ params }: { params: Promise<Record<string, string>> },
		): Promise<NextResponse> {
			const startTime = Date.now();
			const requestId = crypto.randomUUID();
			const resolvedParams = (await params) || {};

			const session: Session = await auth.api.getSession({
				headers: await headers(),
			});
			const userId = session?.user?.id;

			const logger = createRequestLogger(requestId, userId);
			const perf = new PerformanceLogger(
				operation ?? `${method} ${path}`,
				{ userId, requestId, ...resolvedParams },
			);

			// 强制鉴权：未登录 → 401
			if (requireAuth && !userId) {
				logApiRequest(method, path, 401, Date.now() - startTime);
				return NextResponse.json(
					{ error: "Unauthorized" },
					{ status: 401 },
				);
			}

			try {
				const response = await handler({
					request,
					params: resolvedParams,
					session,
					user: session?.user ?? null,
					requestId,
					logger,
					perf,
					method,
					path,
				});
				logApiRequest(method, path, response.status, Date.now() - startTime);
				return response;
			} catch (e) {
				const error = e instanceof Error ? e : new Error(String(e));
				perf.error(error);
				logError(error, { userId, requestId, operation });
				logApiRequest(method, path, 500, Date.now() - startTime);
				return NextResponse.json(
					{ error: "Internal Server Error" },
					{ status: 500 },
				);
			}
		};
	};
}