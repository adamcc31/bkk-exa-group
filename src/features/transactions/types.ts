// ============================================
// Transaction Feature — Zod Schemas & Types
// ============================================

import { z } from "zod";

// ---- Transaction Item ----
export const transactionItemSchema = z.object({
    description: z.string().min(1, "Deskripsi wajib diisi"),
    account_code: z.string().default(""),
    amount: z.coerce.number().min(0, "Jumlah tidak boleh negatif"),
});

export type TransactionItemInput = z.infer<typeof transactionItemSchema>;

// ---- Create Transaction ----
export const createTransactionSchema = z.object({
    type: z.enum(["BKM", "BKK"]),
    payment_type: z.enum(["CASH", "BANK"]),
    transaction_date: z.string().min(1, "Tanggal wajib diisi"),
    total_amount: z.coerce.number().min(0),
    purpose: z.string().min(1, "Keperluan wajib diisi"),
    division: z.string().min(1, "Divisi wajib diisi"),
    department: z.string().default(""),
    paid_to_name: z.string().default(""),
    received_by: z.string().default(""),
    paid_by: z.string().default(""),
    approved_by: z.string().default(""),
    note: z.string().nullable().optional(),
    items: z.array(transactionItemSchema).min(1, "Minimal 1 item transaksi"),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

// ---- Update Transaction ----
export const updateTransactionSchema = createTransactionSchema.partial().extend({
    status: z.enum(["draft", "printed", "submitted", "approved"]).optional(),
});

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

// ---- Query Params ----
export const transactionQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    type: z.enum(["BKM", "BKK"]).optional(),
    payment_type: z.enum(["CASH", "BANK"]).optional(),
    division: z.string().optional(),
    purpose: z.string().optional(),
    paid_to_name: z.string().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    sort_by: z.enum(["transaction_date", "total_amount", "created_at"]).default("transaction_date"),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
