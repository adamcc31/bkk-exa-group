// ============================================
// PDF Export API
// GET /api/pdf/[transactionId]  → generate & download BKK PDF
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/features/auth";
import { PERMISSIONS } from "@/shared/lib/constants";
import { getTransaction, updateTransaction } from "@/features/transactions/services";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { BkkPdfDocument } from "@/features/pdf-export/components/bkk-pdf-document";
import type { StandardizedBkkData, Transaction } from "@/shared/types";
import React from "react";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ transactionId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    const { session, error } = await requireAuth(PERMISSIONS.TRANSACTION_EXPORT_PDF);
    if (error) return error;

    const { transactionId } = await context.params;
    const result = await getTransaction(transactionId);

    if (!result.success || !result.data) {
        return NextResponse.json(
            { success: false, error: { code: "NOT_FOUND", message: "Transaction not found" } },
            { status: 404 }
        );
    }

    const tx = result.data as Transaction;

    // Fetch company name for the PDF header
    const supabase = await createSupabaseServerClient();
    const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", session.activeCompanyId)
        .single();

    const companyName = company?.name ?? "EXATA";

    // Build StandardizedBkkData from transaction
    const bkkData: StandardizedBkkData = {
        header: {
            company_name: companyName,
            transaction_type: tx.type, // "BKK" or "BKM"
            doc_number: tx.bkk_number ?? "",
            payment_type: tx.payment_type, // "BANK" or "CASH"
            transaction_date: tx.transaction_date,
        },
        info: {
            paid_to: tx.paid_to_name,
            division: tx.division,
            department: tx.department,
            total_amount: tx.total_amount,
            purpose: tx.purpose,
        },
        rows: (tx.items ?? []).map((item, idx) => ({
            no: idx + 1,
            description: item.description,
            account_code: item.account_code,
            amount: item.amount,
        })),
        signatories: {
            received_by: tx.received_by,
            paid_by: tx.paid_by,
            approved_by: tx.approved_by,
        },
    };

    // Render PDF to buffer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
        React.createElement(BkkPdfDocument, { data: bkkData }) as any
    );

    // Update status from draft → printed on first PDF export
    if (tx.status === "draft") {
        await updateTransaction(transactionId, { status: "printed" });
    }

    // Return PDF — preview (inline) by default, download if ?download=true
    const filename = `BKK_${tx.bkk_number || tx.id}_${tx.transaction_date}.pdf`;
    const forceDownload = request.nextUrl.searchParams.get("download") === "true";
    const disposition = forceDownload ? "attachment" : "inline";

    return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `${disposition}; filename="${filename}"`,
        },
    });
}
