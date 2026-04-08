// ============================================
// Admin Roles API
// GET /api/admin/roles  → list all roles
// ============================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/features/auth";
import { PERMISSIONS } from "@/shared/lib/constants";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const { error } = await requireAuth(PERMISSIONS.USER_READ);
    if (error) return error;

    const supabase = await createSupabaseServerClient();
    const { data, error: dbError } = await supabase
        .from("roles")
        .select("*")
        .order("name");

    if (dbError) {
        return NextResponse.json(
            { success: false, error: { code: "DB_ERROR", message: dbError.message } },
            { status: 500 }
        );
    }

    return NextResponse.json({ success: true, data: data ?? [] });
}
