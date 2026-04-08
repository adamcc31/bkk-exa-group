// ============================================
// AI Extraction Schema — Unified Zod Validation
// Single schema for all document types (BPN, BANK_TRANSFER)
// ============================================

import { z } from "zod";

// ---- Unified Extraction Schema ----
export const unifiedExtractionSchema = z.object({
    jenis_dokumen: z.enum(["BPN", "BANK_TRANSFER", "TIDAK_DIKENALI"]),
    nama_pt: z.string().default(""),
    tanggal: z.string().min(1), // DD/MM/YYYY
    jumlah_uang_total: z.coerce.number().min(0),
    untuk_keperluan: z.string().default(""),
    keterangan_pengeluaran: z
        .array(
            z.object({
                keterangan: z.string(),
                jumlah: z.coerce.number(),
            })
        )
        .min(1),
});

export type UnifiedExtraction = z.infer<typeof unifiedExtractionSchema>;

// ---- AI Job Status Query ----
export const aiJobStatusSchema = z.object({
    job_id: z.string().uuid(),
});
