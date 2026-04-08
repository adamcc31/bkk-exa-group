// ============================================
// RBAC Middleware & Permission Guard
// Features / Auth — BKK Automatic V3
// ============================================

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { type Permission } from "@/shared/lib/constants";
import { hasPermission } from "@/shared/lib/permissions";
import type { UserRole, User, AuthSession } from "@/shared/types";
import { NextResponse } from "next/server";

// Re-export for consumers that import from here
export { hasPermission };

/**
 * Get the current authenticated session with user profile & role.
 * Returns null if not authenticated.
 */
export async function getAuthSession(): Promise<AuthSession | null> {
    const supabase = await createSupabaseServerClient();

    const {
        data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) return null;

    // Fetch user profile with role
    const { data: profile } = await supabase
        .from("users")
        .select("*, role:roles(*)")
        .eq("id", authUser.id)
        .single();

    if (!profile) return null;

    const user = profile as unknown as User;
    const role = user.role?.name ?? "staff";

    // Active company: use metadata override (for admin/finance switching) or own company
    const activeCompanyId =
        (authUser.user_metadata?.active_company_id as string) ?? user.company_id;

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
