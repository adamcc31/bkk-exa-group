// ============================================
// Companies API — List companies
// GET /api/companies
// ============================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/features/auth";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const { error } = await requireAuth();
    if (error) return error;

    const supabase = await createSupabaseServerClient();
    const { data, error: dbError } = await supabase
        .from("companies")
        .select("*")
        .eq("is_active", true)
        .order("name");

    if (dbError) {
        return NextResponse.json(
            { success: false, error: { code: "DB_ERROR", message: dbError.message } },
            { status: 500 }
        );
    }

    return NextResponse.json({ success: true, data });
}
