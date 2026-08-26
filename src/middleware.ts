import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = new Set(["/", "/login", "/register", "/forgot-password"]);

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const browserVerificationEnabled = request.nextUrl.hostname === "localhost";
	const startsPersonalRunBrowserVerification =
		browserVerificationEnabled &&
		request.nextUrl.searchParams.get("personalRunBrowserTest") === "1";
	const isPersonalRunBrowserVerification =
		browserVerificationEnabled &&
		request.cookies.get("personal-run-browser-test")?.value === "1";
	const isPublic =
		publicRoutes.has(pathname) || pathname.startsWith("/api/auth/");

	if (startsPersonalRunBrowserVerification) {
		const verificationUrl = request.nextUrl.clone();
		verificationUrl.searchParams.delete("personalRunBrowserTest");
		const response = NextResponse.redirect(verificationUrl);
		response.cookies.set("personal-run-browser-test", "1", {
			httpOnly: true,
			sameSite: "strict",
		});
		return response;
	}

	if (
		isPublic ||
		isPersonalRunBrowserVerification ||
		getSessionCookie(request)
	) {
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
