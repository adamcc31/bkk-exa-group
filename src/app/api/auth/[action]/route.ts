import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";
import * as authService from "@/features/auth/services/auth.service";

/**
 * Auth Route Handler - Handles login, logout, refresh, and switch-company
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ action: string }> }
) {
    const { action } = await params;

    try {
        switch (action) {
            case "login":
                return await handleLogin(request);
            case "logout":
                return await handleLogout();
            case "refresh":
                return await handleRefresh(request);
            case "switch-company":
                return await handleSwitchCompany(request);
            default:
                return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
        }
    } catch (error: any) {
        console.error(`Auth Error [${action}]:`, error.message);

        // Known auth errors — safe to expose
        const knownErrors = [
            "Invalid credentials",
            "Invalid or expired refresh token",
            "Unauthorized",
            "Company not found",
            "Refresh token missing",
        ];

        const isKnownError = knownErrors.includes(error.message);

        return NextResponse.json(
            { error: isKnownError ? error.message : "Authentication failed" },
            { status: isKnownError ? 401 : 500 }
        );
    }
}

async function handleLogin(request: NextRequest) {
    const { email, password } = await request.json();
    const { user, accessToken, refreshToken } = await authService.login(email, password);

    const response = NextResponse.json({ user });

    // Set Cookies
    setAuthCookies(response, accessToken, refreshToken);

    return response;
}

async function handleLogout() {
    const response = NextResponse.json({ success: true });
    
    // Clear Cookies
    response.cookies.set("access_token", "", { maxAge: 0 });
    response.cookies.set("refresh_token", "", { maxAge: 0 });
    
    return response;
}

async function handleRefresh(request: NextRequest) {
    const refreshToken = request.cookies.get("refresh_token")?.value;
    if (!refreshToken) {
        throw new Error("Refresh token missing");
    }

    const oldAccessToken = request.cookies.get("access_token")?.value;
    let preferredActiveCompanyId: string | undefined;

    if (oldAccessToken) {
        try {
            const payload = jose.decodeJwt(oldAccessToken);
            preferredActiveCompanyId = payload?.active_company_id as string;
        } catch (e) {
            console.warn("[AuthRoute] Failed to decode expired access token payload:", e);
        }
    }

    const { accessToken } = await authService.refreshAccessToken(refreshToken, preferredActiveCompanyId);
    const response = NextResponse.json({ success: true });

    // Update Access Token Cookie
    response.cookies.set("access_token", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60, // 15 minutes
    });

    return response;
}

async function handleSwitchCompany(request: NextRequest) {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
        throw new Error("Unauthorized");
    }

    const { companyId } = await request.json();
    const { accessToken } = await authService.switchActiveCompany(userId, companyId);

    const response = NextResponse.json({ success: true });

    // Update Access Token Cookie with new active_company_id claim
    response.cookies.set("access_token", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60,
    });

    return response;
}

function setAuthCookies(response: NextResponse, accessToken: string, refreshToken: string) {
    const isProd = process.env.NODE_ENV === "production";

    response.cookies.set("access_token", accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60, // 15 minutes
    });

    response.cookies.set("refresh_token", refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    });
}
