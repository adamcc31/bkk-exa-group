import { NextResponse, type NextRequest } from "next/server";
import { getJWTPayload } from "@/shared/lib/auth/jwt";

// 1. Define paths that require authentication
const PROTECTED_PATHS = ["/admin", "/ai-parser", "/reports", "/transactions"];

/**
 * Next.js Middleware for Authentication and Context Forwarding
 */
export async function middleware(request: NextRequest) {
    const accessToken = request.cookies.get("access_token")?.value;
    const payload = accessToken ? await getJWTPayload(accessToken) : null;

    const { pathname } = request.nextUrl;

    // 1. Redirect logic for authenticated users at /login
    if (payload && pathname === "/login") {
        return NextResponse.redirect(new URL("/", request.url));
    }

    // 2. Determine if route is protected
    // Protect root "/" if it's the dashboard entry, and all paths in PROTECTED_PATHS
    // Also protect all /api routes except /api/auth/*
    const isRoot = pathname === "/";
    const isProtectedRoute = isRoot || PROTECTED_PATHS.some(p => pathname.startsWith(p));
    const isApiRoute = pathname.startsWith("/api");
    const isAuthApi = pathname.startsWith("/api/auth");

    if (!payload && (isProtectedRoute || (isApiRoute && !isAuthApi))) {
        // For API routes, return 401 instead of redirect
        if (isApiRoute) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // 3. Forward User Context via Headers if authenticated
    const requestHeaders = new Headers(request.headers);
    if (payload && payload.sub) {
        console.log(`[Middleware] Authenticated: ${payload.email} (${payload.role}) | Active: ${payload.active_company_id} | Own: ${payload.company_id}`);
        requestHeaders.set("x-user-id", payload.sub);
        requestHeaders.set("x-active-company-id", payload.active_company_id);
        requestHeaders.set("x-own-company-id", payload.company_id);
        requestHeaders.set("x-user-role", payload.role);
    } else if (isProtectedRoute || (isApiRoute && !isAuthApi)) {
        console.warn(`[Middleware] Unauthorized access attempt to: ${pathname}`);
    }

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         * - public assets
         */
        "/((?!_next/static|_next/image|favicon.ico|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
