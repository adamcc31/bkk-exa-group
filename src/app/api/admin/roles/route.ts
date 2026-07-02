// ============================================
// Admin Roles API (Post-Supabase)
// GET /api/admin/roles  → list all roles
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/features/auth";
import { PERMISSIONS } from "@/shared/lib/constants";
import { withDbContext } from "@/shared/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const { session, error } = await requireAuth(PERMISSIONS.USER_READ);
    if (error) return error;

    try {
        // Use database context
        const data = await withDbContext(
            session.user.id,
            session.activeCompanyId,
            session.role,
            session.user.company_id,
            async (client) => {
                const res = await client.query("SELECT * FROM roles ORDER BY name ASC");
                return res.rows;
            }
        );

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error("Admin Roles Error:", error.message);
        return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
    }
}
