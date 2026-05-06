// ============================================
// Admin Roles API (Post-Supabase)
// GET /api/admin/roles  → list all roles
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { withDbContext } from "@/shared/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const userId = request.headers.get("x-user-id");
    const activeCompanyId = request.headers.get("x-active-company-id");
    const role = request.headers.get("x-user-role");

    if (!userId || !role) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Use database context
        const data = await withDbContext(
            userId,
            activeCompanyId,
            role,
            request.headers.get("x-own-company-id"),
            async (client) => {
                const res = await client.query("SELECT * FROM roles ORDER BY name ASC");
            return res.rows;
        });

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error("Admin Roles Error:", error.message);
        return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
    }
}
