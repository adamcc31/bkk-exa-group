// ============================================
// Transaction Service — Business Logic (Post-Supabase)
// ============================================

import { withDbContext, query as systemQuery } from "@/shared/lib/db/client";
import { createQueryBuilder } from "@/shared/lib/db/query-builder";
import type { AuthSession, Transaction, ApiResponse } from "@/shared/types";
import type {
    CreateTransactionInput,
    UpdateTransactionInput,
    TransactionQuery,
    TransactionItemInput,
} from "../types";

/**
 * Whitelist of columns allowed for sorting to prevent SQL injection
 */
const ALLOWED_SORT_COLUMNS = [
    "transaction_date",
    "created_at",
    "total_amount",
    "bkk_number",
    "status",
    "type",
    "paid_to_name",
] as const;

type SortColumn = (typeof ALLOWED_SORT_COLUMNS)[number];

function sanitizeSortColumn(col: string): SortColumn {
    if (ALLOWED_SORT_COLUMNS.includes(col as SortColumn)) {
        return col as SortColumn;
    }
    return "transaction_date"; // safe default
}

/**
 * Lists transactions with items aggregated as JSON
 */
export async function listTransactions(
    session: AuthSession,
    query: TransactionQuery
): Promise<ApiResponse<Transaction[]>> {
    return await withDbContext(session.user.id, session.activeCompanyId, session.role, session.user.company_id, async (client) => {
        const { page, pageSize, sort_by, sort_order, ...filters } = query;
        const offset = (page - 1) * pageSize;

        const qb = createQueryBuilder().where("t.is_deleted = $", false);

        // Filters
        qb.whereIf("t.type = $", filters.type)
            .whereIf("t.payment_type = $", filters.payment_type)
            .whereIf("t.division ILIKE $", filters.division ? `%${filters.division}%` : null)
            .whereIf("t.purpose ILIKE $", filters.purpose ? `%${filters.purpose}%` : null)
            .whereIf(
                "t.paid_to_name ILIKE $",
                filters.paid_to_name ? `%${filters.paid_to_name}%` : null
            )
            .whereIf("t.transaction_date >= $", filters.date_from)
            .whereIf("t.transaction_date <= $", filters.date_to);

        const { whereClause, params, nextParamIndex } = qb.build();
        console.log(`[Transactions] Query: ${whereClause} | Params: ${JSON.stringify(params)}`);

        // 1. Get total count for metadata
        const countRes = await client.query(
            `SELECT COUNT(*)::INT as total FROM transactions t ${whereClause}`,
            params
        );
        const total = countRes.rows[0].total;

        // 2. Get paginated data with items aggregated
        const dataRes = await client.query(
            `SELECT t.*, 
                COALESCE(
                    json_agg(ti.* ORDER BY ti.item_order) FILTER (WHERE ti.id IS NOT NULL), 
                    '[]'
                ) as items
             FROM transactions t
             LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
             ${whereClause}
             GROUP BY t.id
             ORDER BY t.${sanitizeSortColumn(sort_by)} ${sort_order === "asc" ? "ASC" : "DESC"}
             LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`,
            [...params, pageSize, offset]
        );

        return {
            success: true,
            data: dataRes.rows as unknown as Transaction[],
            meta: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    });
}

/**
 * Gets a single transaction by ID
 */
export async function getTransaction(
    session: AuthSession,
    id: string
): Promise<ApiResponse<Transaction>> {
    return await withDbContext(session.user.id, session.activeCompanyId, session.role, session.user.company_id, async (client) => {
        const res = await client.query(
            `SELECT t.*, 
                COALESCE(
                    json_agg(ti.* ORDER BY ti.item_order) FILTER (WHERE ti.id IS NOT NULL), 
                    '[]'
                ) as items
             FROM transactions t
             LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
             WHERE t.id = $1 AND t.is_deleted = false
             GROUP BY t.id`,
            [id]
        );

        if (res.rowCount === 0) {
            return {
                success: false,
                error: { code: "NOT_FOUND", message: "Transaction not found" },
            };
        }

        return { success: true, data: res.rows[0] as unknown as Transaction };
    });
}

/**
 * Creates a new transaction with items (Atomic)
 */
export async function createTransaction(
    session: AuthSession,
    input: CreateTransactionInput
): Promise<ApiResponse<Transaction>> {
    return await withDbContext(session.user.id, session.activeCompanyId, session.role, session.user.company_id, async (client) => {
        const { items, ...transactionData } = input;

        // 1. Calculate total
        const calculatedTotal = items.reduce((sum, item) => sum + item.amount, 0);

        // 2. Auto-generate BKK/BKM number via DB function
        const numRes = await client.query("SELECT generate_bkk_number($1, $2) as bkk_number", [
            session.activeCompanyId,
            transactionData.type,
        ]);
        const bkkNumber = numRes.rows[0].bkk_number;

        // 3. Insert transaction
        console.log(`[DB] Creating transaction for company ${session.activeCompanyId}. Signatories: paid_by=${transactionData.paid_by}, approved_by=${transactionData.approved_by}`);
        
        const txRes = await client.query(
            `INSERT INTO transactions (
                company_id, created_by, type, payment_type, transaction_date, 
                total_amount, purpose, division, department, paid_to_name, 
                bkk_number, received_by, paid_by, approved_by, note, status
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             RETURNING id`,
            [
                session.activeCompanyId,
                session.user.id,
                transactionData.type,
                transactionData.payment_type,
                transactionData.transaction_date,
                calculatedTotal,
                transactionData.purpose,
                transactionData.division,
                transactionData.department,
                transactionData.paid_to_name,
                bkkNumber,
                transactionData.received_by || "",
                transactionData.paid_by || "BU NURUL",
                transactionData.approved_by || "PAK NOVI",
                transactionData.note || null,
                "draft",
            ]
        );
        const transactionId = txRes.rows[0].id;

        // 4. Insert items
        for (const [index, item] of items.entries()) {
            await client.query(
                `INSERT INTO transaction_items (transaction_id, item_order, description, account_code, amount)
                 VALUES ($1, $2, $3, $4, $5)`,
                [transactionId, index + 1, item.description, item.account_code, item.amount]
            );
        }

        // Return the full object
        const finalRes = await client.query(
            `SELECT t.*, json_agg(ti.* ORDER BY ti.item_order) as items
             FROM transactions t
             LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
             WHERE t.id = $1
             GROUP BY t.id`,
            [transactionId]
        );

        return { success: true, data: finalRes.rows[0] as unknown as Transaction };
    });
}

/**
 * Updates a transaction and its items (Atomic)
 */
export async function updateTransaction(
    session: AuthSession,
    id: string,
    input: UpdateTransactionInput
): Promise<ApiResponse<Transaction>> {
    return await withDbContext(session.user.id, session.activeCompanyId, session.role, session.user.company_id, async (client) => {
        const { items, ...transactionData } = input;

        const UPDATABLE_FIELDS: (keyof UpdateTransactionInput)[] = [
            "payment_type",
            "transaction_date",
            "purpose",
            "division",
            "department",
            "paid_to_name",
            "received_by",
            "paid_by",
            "approved_by",
            "note",
            "status",
        ];

        // 1. Update main fields if provided
        if (Object.keys(transactionData).length > 0) {
            console.log(`[DB] Updating transaction ${id}. Signatories: paid_by=${transactionData.paid_by}, approved_by=${transactionData.approved_by}`);
            
            const fields: string[] = [];
            const values: any[] = [];
            let i = 1;

            for (const field of UPDATABLE_FIELDS) {
                const value = (transactionData as any)[field];
                if (value !== undefined) {
                    fields.push(`${field} = $${i++}`);
                    // Use fallback for signatories if empty string provided
                    if ((field === "paid_by" || field === "approved_by") && !value) {
                        values.push(field === "paid_by" ? "BU NURUL" : "PAK NOVI");
                    } else {
                        values.push(value);
                    }
                }
            }

            if (fields.length > 0) {
                if (items) {
                    const calculatedTotal = items.reduce((sum, item) => sum + item.amount, 0);
                    fields.push(`total_amount = $${i++}`);
                    values.push(calculatedTotal);
                }

                values.push(id);
                await client.query(
                    `UPDATE transactions SET ${fields.join(", ")}, updated_at = now() WHERE id = $${i}`,
                    values
                );
            }
        }

        // 2. Replace items if provided
        if (items) {
            await client.query("DELETE FROM transaction_items WHERE transaction_id = $1", [id]);
            for (const [index, item] of items.entries()) {
                await client.query(
                    `INSERT INTO transaction_items (transaction_id, item_order, description, account_code, amount)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [id, index + 1, item.description, item.account_code, item.amount]
                );
            }
        }

        // Return updated object
        const finalRes = await client.query(
            `SELECT t.*, json_agg(ti.* ORDER BY ti.item_order) as items
             FROM transactions t
             LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
             WHERE t.id = $1
             GROUP BY t.id`,
            [id]
        );

        return { success: true, data: finalRes.rows[0] as unknown as Transaction };
    });
}

/**
 * Soft deletes a transaction
 */
export async function softDeleteTransaction(
    session: AuthSession,
    id: string
): Promise<ApiResponse<{ deleted: boolean }>> {
    return await withDbContext(session.user.id, session.activeCompanyId, session.role, session.user.company_id, async (client) => {
        const res = await client.query(
            "UPDATE transactions SET is_deleted = true, updated_at = now() WHERE id = $1",
            [id]
        );

        if (res.rowCount === 0) {
            return {
                success: false,
                error: { code: "NOT_FOUND", message: "Transaction not found" },
            };
        }

        return { success: true, data: { deleted: true } };
    });
}

/**
 * Fetches dashboard stats using aggregated database function
 */
export async function getDashboardStats(
    session: AuthSession,
    dateFrom?: string,
    dateTo?: string
) {
    return await withDbContext(session.user.id, session.activeCompanyId, session.role, session.user.company_id, async (client) => {
        const res = await client.query("SELECT * FROM get_dashboard_stats($1, $2, $3)", [
            session.activeCompanyId,
            dateFrom ?? null,
            dateTo ?? null,
        ]);

        const row = res.rows[0] || { total_bkm: 0, total_bkk: 0, total_transactions: 0 };

        return {
            totalBkm: Number(row.total_bkm),
            totalBkk: Number(row.total_bkk),
            totalTransactions: Number(row.total_transactions),
            balance: Number(row.total_bkm) - Number(row.total_bkk),
        };
    });
}
