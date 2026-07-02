import { NextResponse, type NextRequest } from "next/server";
import { getJWTPayload } from "@/shared/lib/auth/jwt";

// 1. Define paths that require authentication
const PROTECTED_PATHS = ["/admin", "/ai-parser", "/reports", "/transactions"];

// Simple In-Memory Rate Limiter for Expensive Endpoints
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 60; // 60 requests/min limit

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const requestData = ipRequestCounts.get(ip);

    if (!requestData) {
        ipRequestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
        return false;
    }

    if (now > requestData.resetTime) {
        ipRequestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
        return false;
    }

    requestData.count++;
    return requestData.count > MAX_REQUESTS_PER_MINUTE;
}

/**
 * Next.js Global Proxy for Authentication, CSRF Protection, and Context Forwarding
 */
export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    console.log(`[Proxy] Request: ${request.method} ${pathname}`);

    // Rate Limiting for expensive endpoints (AI parsing and PDF rendering)
    const isExpensiveApi = pathname.startsWith("/api/ai-parse") || pathname.startsWith("/api/pdf");
    if (isExpensiveApi) {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
        if (isRateLimited(ip)) {
            console.warn(`[Proxy] Rate limit exceeded for IP ${ip} on path ${pathname}`);
            return NextResponse.json(
                { error: "Too many requests. Please try again in a minute." },
                { status: 429 }
            );
        }
    }

    // CSRF Protection: Verify Origin on state-changing requests (non-GET)
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (request.method !== "GET" && origin) {
        // Ensure request comes from the same host
        const isSameOrigin = origin.includes(host || "");
        if (!isSameOrigin) {
            console.warn(`[Proxy] Blocked potential CSRF request from ${origin} to ${pathname}`);
            return NextResponse.json(
                { error: "CSRF verification failed" },
                { status: 403 }
            );
        }
    }

    const accessToken = request.cookies.get("access_token")?.value;
    let payload = null;
    
    if (accessToken) {
        try {
            payload = await getJWTPayload(accessToken);
        } catch (e) {
            console.error(`[Proxy] Token validation failed:`, e);
        }
    }

    // 1. Redirect logic for authenticated users at /login
    if (payload && pathname === "/login") {
        return NextResponse.redirect(new URL("/", request.url));
    }

    // 2. Determine if route is protected
    const isRoot = pathname === "/";
    const isProtectedRoute = isRoot || PROTECTED_PATHS.some(p => pathname.startsWith(p));
    const isApiRoute = pathname.startsWith("/api");
    const isAuthApi = pathname.startsWith("/api/auth");
    const isHealthApi = pathname.startsWith("/api/health");

    if (!payload && (isProtectedRoute || (isApiRoute && !isAuthApi && !isHealthApi))) {
        console.warn(`[Proxy] Blocking unauthorized request to ${pathname}. isProtectedRoute=${isProtectedRoute}, isApiRoute=${isApiRoute}, isAuthApi=${isAuthApi}`);
        // For API routes, return 401 instead of redirect
        if (isApiRoute) {
            return NextResponse.json(
                { error: "Authentication required (Proxy Block)" },
                { status: 401 }
            );
        }
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // 3. Forward User Context via Headers if authenticated
    const requestHeaders = new Headers(request.headers);
    if (payload && payload.sub) {
        // Multi-Tenant Isolation: Enforce active_company_id restriction for non-admins
        let activeCompanyId = payload.active_company_id;
        if (payload.role !== "admin" && activeCompanyId !== payload.company_id) {
            console.warn(`[Proxy] Non-admin user ${payload.email} attempted to use mismatched company ID: ${activeCompanyId}. Forcing own company ID: ${payload.company_id}`);
            activeCompanyId = payload.company_id;
        }

        console.log(`[Proxy] Authenticated: ${payload.email} (${payload.role}) | Active: ${activeCompanyId} | Own: ${payload.company_id}`);
        requestHeaders.set("x-user-id", payload.sub);
        requestHeaders.set("x-active-company-id", activeCompanyId);
        requestHeaders.set("x-own-company-id", payload.company_id);
        requestHeaders.set("x-user-role", payload.role);
    } else if (isProtectedRoute || (isApiRoute && !isAuthApi)) {
        console.warn(`[Proxy] Unauthorized access attempt to: ${pathname}`);
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
