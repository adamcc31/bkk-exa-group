// ============================================
// Dashboard Stats API — for client components
// GET /api/dashboard/stats?date_from=...&date_to=...
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/features/auth";
import { PERMISSIONS } from "@/shared/lib/constants";
import { getDashboardStats } from "@/features/transactions/services";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const { session, error } = await requireAuth(PERMISSIONS.TRANSACTION_READ);
    if (error) return error;

    const params = request.nextUrl.searchParams;
    const dateFrom = params.get("date_from") ?? undefined;
    const dateTo = params.get("date_to") ?? undefined;

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (
        (dateFrom && !dateRegex.test(dateFrom)) ||
        (dateTo && !dateRegex.test(dateTo))
    ) {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Format tanggal harus YYYY-MM-DD",
                },
            },
            { status: 400 }
        );
    }

    try {
        const stats = await getDashboardStats(session, dateFrom, dateTo);
        return NextResponse.json({ success: true, data: stats });
    } catch (err: unknown) {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "DB_ERROR",
                    message: (err as Error).message,
                },
            },
            { status: 500 }
        );
    }
}
