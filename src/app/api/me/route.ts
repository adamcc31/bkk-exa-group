// ============================================
// Session API — returns current user's role & active company
// GET /api/me
// ============================================

import { NextResponse } from "next/server";
import { getAuthSession } from "@/features/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await getAuthSession();

    if (!session) {
        return NextResponse.json(
            { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
            { status: 401 }
        );
    }

    return NextResponse.json({
        success: true,
        data: {
            role: session.role,
            activeCompanyId: session.activeCompanyId,
            userId: session.user.id,
            userName: session.user.full_name,
        },
    });
}
