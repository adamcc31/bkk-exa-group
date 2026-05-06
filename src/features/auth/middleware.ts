// ============================================
// RBAC Middleware & Permission Guard (Post-Supabase)
// Features / Auth — BKK Automatic V3
// ============================================

import { headers } from "next/headers";
import { query as systemQuery } from "@/shared/lib/db/client";
import { type Permission } from "@/shared/lib/constants";
import { hasPermission } from "@/shared/lib/permissions";
import type { UserRole, User, AuthSession } from "@/shared/types";
import { NextResponse } from "next/server";

// Re-export for consumers that import from here
export { hasPermission };

/**
 * Get the current authenticated session with user profile & role.
 * Uses headers set by the global Next.js middleware.
 * Returns null if not authenticated.
 */
export async function getAuthSession(): Promise<AuthSession | null> {
    const headerList = await headers();
    const userId = headerList.get("x-user-id");
    const activeCompanyId = headerList.get("x-active-company-id");
    const role = headerList.get("x-user-role");

    if (!userId || !activeCompanyId || !role) return null;

    // Fetch user profile from DB
    const res = await systemQuery(
        `SELECT u.*, row_to_json(r.*) as role 
         FROM public.users u 
         JOIN public.roles r ON u.role_id = r.id 
         WHERE u.id = $1`,
        [userId]
    );

    if (res.rowCount === 0) return null;

    const user = res.rows[0] as User;

    return {
        user,
        activeCompanyId,
        role: role as UserRole,
    };
}

/**
 * API route guard — returns 401/403 if unauthorized.
 * Use at the top of Route Handlers.
 */
export async function requireAuth(
    requiredPermission?: Permission
): Promise<
    | { session: AuthSession; error: null }
    | { session: null; error: NextResponse }
> {
    const session = await getAuthSession();

    if (!session) {
        return {
            session: null,
            error: NextResponse.json(
                {
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Authentication required" },
                },
                { status: 401 }
            ),
        };
    }

    if (requiredPermission && !hasPermission(session.role, requiredPermission)) {
        return {
            session: null,
            error: NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "FORBIDDEN",
                        message: "Insufficient permissions",
                    },
                },
                { status: 403 }
            ),
        };
    }

    return { session, error: null };
}
