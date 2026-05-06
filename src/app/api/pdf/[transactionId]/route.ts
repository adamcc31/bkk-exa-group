// ============================================
// PDF Export API (Post-Supabase)
// GET /api/pdf/[transactionId]  → generate & download BKK PDF
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { withDbContext } from "@/shared/lib/db/client";
import { getTransaction } from "@/features/transactions/services";
import { renderToBuffer } from "@react-pdf/renderer";
import { BkkPdfDocument } from "@/features/pdf-export/components/bkk-pdf-document";
import type { StandardizedBkkData, Transaction } from "@/shared/types";
import React from "react";

export const dynamic = "force-dynamic";

type RouteContext = { params: { transactionId: string } };

export async function GET(request: NextRequest, context: RouteContext) {
    const userId = request.headers.get("x-user-id");
    const activeCompanyId = request.headers.get("x-active-company-id");
    const ownCompanyId = request.headers.get("x-own-company-id");
    const role = request.headers.get("x-user-role");

    if (!userId || !activeCompanyId || !role || !ownCompanyId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { transactionId } = await context.params;

        // Create a temporary session object for the service
        const session = {
            user: { id: userId, company_id: ownCompanyId },
            activeCompanyId: activeCompanyId,
            role: role as any,
        };

        const result = await getTransaction(session as any, transactionId);

        if (!result.success || !result.data) {
            return NextResponse.json(
                { error: "Transaction not found" },
                { status: 404 }
            );
        }

        const tx = result.data as Transaction;

        // Use database context to fetch company name and update status
        const pdfData = await withDbContext(userId, activeCompanyId, role, ownCompanyId, async (client) => {
            // 1. Fetch company name
            const compRes = await client.query("SELECT name FROM companies WHERE id = $1", [
                activeCompanyId,
            ]);
            const companyName = compRes.rows[0]?.name ?? "EXATA";

            // 2. Update status from draft → printed
            if (tx.status === "draft") {
                await client.query(
                    "UPDATE transactions SET status = $1, updated_at = now() WHERE id = $2",
                    ["printed", transactionId]
                );
            }

            return { companyName };
        });

        // 3. Build StandardizedBkkData for PDF
        const bkkData: StandardizedBkkData = {
            header: {
                company_name: pdfData.companyName,
                transaction_type: tx.type,
                doc_number: tx.bkk_number ?? "",
                payment_type: tx.payment_type,
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

        // 4. Render PDF
        const pdfBuffer = await renderToBuffer(
            React.createElement(BkkPdfDocument, { data: bkkData }) as any
        );

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
    } catch (error: any) {
        console.error("PDF Route Error:", error.message);
        return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
    }
}
