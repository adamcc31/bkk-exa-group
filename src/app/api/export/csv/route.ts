// ============================================
// CSV Export API — Download transactions as CSV
// GET /api/export/csv
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/features/auth";
import { PERMISSIONS } from "@/shared/lib/constants";
import { listTransactions } from "@/features/transactions/services";
import { transactionsToCsv } from "@/features/transactions/services/csv-export";
import type { Transaction } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const { session, error } = await requireAuth(PERMISSIONS.TRANSACTION_EXPORT_CSV);
    if (error) return error;

    const params = request.nextUrl.searchParams;
    const query = {
        page: 1,
        pageSize: 10000, // Export all
        sort_by: "transaction_date" as const,
        sort_order: "desc" as const,
        type: (params.get("type") ?? undefined) as "BKM" | "BKK" | undefined,
        payment_type: (params.get("payment_type") ?? undefined) as "CASH" | "BANK" | undefined,
        date_from: params.get("date_from") ?? undefined,
        date_to: params.get("date_to") ?? undefined,
    };

    const result = await listTransactions(session, query);

    if (!result.success || !result.data) {
        return NextResponse.json(result, { status: 500 });
    }

    const csv = transactionsToCsv(result.data as Transaction[]);
    const date = new Date().toISOString().split("T")[0];
    const filename = `Transaksi_Export_${date}.csv`;

    return new NextResponse(csv, {
        status: 200,
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    });
}
