// ============================================
// CSV Export Service
// ============================================

import type { Transaction } from "@/shared/types";
import { formatDate, formatCurrency } from "@/shared/lib/format";

/**
 * Generate CSV content from transaction data.
 */
export function transactionsToCsv(transactions: Transaction[]): string {
    const headers = [
        "Tanggal",
        "Jenis",
        "Pembayaran",
        "No. BKK",
        "Dibayar Kepada",
        "Keperluan",
        "Divisi",
        "Departemen",
        "Jumlah (Rp)",
        "Status",
        "Dibuat Oleh",
    ];

    const rows = transactions.map((tx) => [
        formatDate(tx.transaction_date),
        tx.type,
        tx.payment_type,
        tx.bkk_number || "",
        escapeCsvField(tx.paid_to_name || ""),
        escapeCsvField(tx.purpose || ""),
        tx.division || "",
        tx.department || "",
        formatCurrency(tx.total_amount),
        tx.status,
        tx.created_by,
    ]);

    const csvLines = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
    ];

    // Add BOM for Excel compatibility
    return "\uFEFF" + csvLines.join("\n");
}

function escapeCsvField(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
