import type { Transaction, StandardizedBkkData } from "@/shared/types";

export function mapTransactionToBkkData(tx: Transaction): StandardizedBkkData {
    return {
        header: {
            company_name: tx.company_name || "EXATA",
            transaction_type: tx.type || "BKK",
            doc_number: tx.bkk_number || "-",
            payment_type: tx.payment_type || "CASH",
            transaction_date: tx.transaction_date || "-",
        },
        info: {
            paid_to: tx.paid_to_name || "-",
            division: tx.division || "-",
            department: tx.department || "-",
            total_amount: tx.total_amount ?? 0,
            purpose: tx.purpose || "-",
        },
        rows: (tx.items ?? []).map((item, idx) => ({
            no: idx + 1,
            description: item.description || "-",
            account_code: item.account_code || "-",
            amount: item.amount ?? 0,
        })),
        signatories: {
            received_by: tx.received_by || "-",
            paid_by: tx.paid_by || "-",
            approved_by: tx.approved_by || "-",
        },
    };
}
