// ============================================
// Transaction Service — Business Logic
// ============================================

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import type { AuthSession, Transaction, ApiResponse } from "@/shared/types";
import type {
    CreateTransactionInput,
    UpdateTransactionInput,
    TransactionQuery,
    TransactionItemInput,
} from "../types";

export async function listTransactions(
    session: AuthSession,
    query: TransactionQuery
): Promise<ApiResponse<Transaction[]>> {
    const supabase = await createSupabaseServerClient();

    const { page, pageSize, sort_by, sort_order, ...filters } = query;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let qb = supabase
        .from("transactions")
        .select("*, items:transaction_items(*)", { count: "exact" })
        .eq("is_deleted", false)
        .order(sort_by, { ascending: sort_order === "asc" })
        .range(from, to);

    // Scope by role — RLS already enforces, but we add explicit scoping for clarity
    if (session.role === "finance" || session.role === "admin") {
        qb = qb.eq("company_id", session.activeCompanyId);
    }
    // Staff: RLS limits to created_by automatically

    // Apply filters
    if (filters.type) qb = qb.eq("type", filters.type);
    if (filters.payment_type) qb = qb.eq("payment_type", filters.payment_type);
    if (filters.division) qb = qb.ilike("division", `%${filters.division}%`);
    if (filters.purpose) qb = qb.ilike("purpose", `%${filters.purpose}%`);
    if (filters.paid_to_name) qb = qb.ilike("paid_to_name", `%${filters.paid_to_name}%`);
    if (filters.date_from) qb = qb.gte("transaction_date", filters.date_from);
    if (filters.date_to) qb = qb.lte("transaction_date", filters.date_to);

    const { data, error, count } = await qb;

    if (error) {
        return {
            success: false,
            error: { code: "DB_ERROR", message: error.message },
        };
    }

    return {
        success: true,
        data: (data as unknown as Transaction[]) ?? [],
        meta: {
            page,
            pageSize,
            total: count ?? 0,
            totalPages: Math.ceil((count ?? 0) / pageSize),
        },
    };
}

export async function getTransaction(
    id: string
): Promise<ApiResponse<Transaction>> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
        .from("transactions")
        .select("*, items:transaction_items(*)")
        .eq("id", id)
        .eq("is_deleted", false)
        .single();

    if (error) {
        return {
            success: false,
            error: { code: "NOT_FOUND", message: "Transaction not found" },
        };
    }

    return { success: true, data: data as unknown as Transaction };
}

export async function createTransaction(
    session: AuthSession,
    input: CreateTransactionInput
): Promise<ApiResponse<Transaction>> {
    const supabase = await createSupabaseServerClient();

    const { items, ...transactionData } = input;

    // Calculate total from items
    const calculatedTotal = items.reduce((sum: number, item: TransactionItemInput) => sum + item.amount, 0);

    // Auto-generate BKK/BKM number via DB function
    let bkkNumber = "";
    const { data: numData, error: numError } = await supabase
        .rpc("generate_bkk_number", {
            p_company_id: session.activeCompanyId,
            p_type: transactionData.type,
        });

    if (numError) {
        return {
            success: false,
            error: { code: "NUMBER_GEN_FAILED", message: numError.message },
        };
    }
    bkkNumber = numData as string;

    // Insert transaction
    const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
            ...transactionData,
            company_id: session.activeCompanyId,
            created_by: session.user.id,
            total_amount: calculatedTotal,
            bkk_number: bkkNumber,
            status: "draft",
        })
        .select()
        .single();

    if (txError) {
        return {
            success: false,
            error: { code: "CREATE_FAILED", message: txError.message },
        };
    }

    // Insert items
    const { error: itemsError } = await supabase
        .from("transaction_items")
        .insert(
            items.map((item: TransactionItemInput, index: number) => ({
                transaction_id: transaction.id,
                item_order: index + 1,
                ...item,
            }))
        );

    if (itemsError) {
        return {
            success: false,
            error: { code: "ITEMS_FAILED", message: itemsError.message },
        };
    }

    return await getTransaction(transaction.id);
}

export async function updateTransaction(
    id: string,
    input: UpdateTransactionInput
): Promise<ApiResponse<Transaction>> {
    const supabase = await createSupabaseServerClient();

    const { items, ...transactionData } = input;

    // Update transaction fields
    if (Object.keys(transactionData).length > 0) {
        const updateData = { ...transactionData } as Record<string, unknown>;
        if (items) {
            updateData.total_amount = items.reduce((sum: number, item: TransactionItemInput) => sum + item.amount, 0);
        }
        const { error } = await supabase
            .from("transactions")
            .update(updateData)
            .eq("id", id);

        if (error) {
            return {
                success: false,
                error: { code: "UPDATE_FAILED", message: error.message },
            };
        }
    }

    // Replace items if provided
    if (items) {
        await supabase.from("transaction_items").delete().eq("transaction_id", id);

        const { error: itemsError } = await supabase
            .from("transaction_items")
            .insert(
                items.map((item: TransactionItemInput, index: number) => ({
                    transaction_id: id,
                    item_order: index + 1,
                    ...item,
                }))
            );

        if (itemsError) {
            return {
                success: false,
                error: { code: "ITEMS_FAILED", message: itemsError.message },
            };
        }
    }

    return await getTransaction(id);
}

export async function softDeleteTransaction(
    id: string
): Promise<ApiResponse<{ deleted: boolean }>> {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
        .from("transactions")
        .update({ is_deleted: true })
        .eq("id", id);

    if (error) {
        return {
            success: false,
            error: { code: "DELETE_FAILED", message: error.message },
        };
    }

    return { success: true, data: { deleted: true } };
}

export async function getDashboardStats(
    session: AuthSession,
    dateFrom?: string,
    dateTo?: string
) {
    const supabase = await createSupabaseServerClient();

    // Single RPC call — all aggregation done in database
    const { data, error } = await supabase.rpc("get_dashboard_stats", {
        p_company_id: session.activeCompanyId,
        p_date_from: dateFrom ?? null,
        p_date_to: dateTo ?? null,
    });

    if (error) {
        throw new Error(`Dashboard stats query failed: ${error.message}`);
    }

    const row = data?.[0] ?? { total_bkm: 0, total_bkk: 0, total_transactions: 0 };
    return {
        totalBkm: Number(row.total_bkm),
        totalBkk: Number(row.total_bkk),
        totalTransactions: Number(row.total_transactions),
        balance: Number(row.total_bkm) - Number(row.total_bkk),
    };
}

