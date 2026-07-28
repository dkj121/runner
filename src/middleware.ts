import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = new Set(["/", "/login", "/register", "/forgot-password"]);

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const isPublic =
		publicRoutes.has(pathname) || pathname.startsWith("/api/auth/");

	if (isPublic || getSessionCookie(request)) {
		return NextResponse.next();
	}

	const loginUrl = new URL("/login", request.url);
	loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
	return NextResponse.redirect(loginUrl);
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
	],
};
