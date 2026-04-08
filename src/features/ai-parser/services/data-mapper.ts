// ============================================
// Data Mapper — Unified AI Extraction → StandardizedBkkData
// Single mapper for all document types
// ============================================

import type { StandardizedBkkData } from "@/shared/types";
import type { UnifiedExtraction } from "../types";

/**
 * Convert DD/MM/YYYY to YYYY-MM-DD (ISO format used internally).
 */
function convertDateToISO(ddmmyyyy: string): string {
    const parts = ddmmyyyy.split("/");
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return ddmmyyyy; // Return as-is if format is unexpected
}

/**
 * Map a unified AI extraction result to the standardized BKK data format.
 * Handles both BPN and BANK_TRANSFER document types.
 */
export function mapUnifiedToBkk(
    data: UnifiedExtraction,
    companyName: string
): StandardizedBkkData {
    const isBpn = data.jenis_dokumen === "BPN";
    const isoDate = convertDateToISO(data.tanggal);

    // Build rows from keterangan_pengeluaran
    const rows = data.keterangan_pengeluaran.map((item, idx) => ({
        no: idx + 1,
        description: item.keterangan,
        account_code: "",
        amount: item.jumlah,
    }));

    return {
        header: {
            company_name: companyName,
            transaction_type: "BKK",
            doc_number: "",
            payment_type: "BANK",
            transaction_date: isoDate,
        },
        info: {
            paid_to: "",
            division: "FINANCE",
            department: "GENERAL",
            total_amount: data.jumlah_uang_total,
            purpose: data.untuk_keperluan,
        },
        rows,
        signatories: {
            received_by: "",
            paid_by: "BU NURUL",
            approved_by: "PAK NOVI",
        },
    };
}
