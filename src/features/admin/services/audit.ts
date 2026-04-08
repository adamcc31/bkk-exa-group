// ============================================
// Audit Log Service
// ============================================

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import type { AuthSession, AuditLog, ApiResponse } from "@/shared/types";

export async function writeAuditLog(params: {
    session: AuthSession;
    action: string;
    entityType: string;
    entityId: string;
    oldValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    ipAddress?: string;
}): Promise<void> {
    const supabase = await createSupabaseServerClient();

    await supabase.from("audit_logs").insert({
        company_id: params.session.activeCompanyId,
        user_id: params.session.user.id,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        old_value: params.oldValue ?? null,
        new_value: params.newValue ?? null,
        ip_address: params.ipAddress ?? null,
    });
}

export async function listAuditLogs(
    query: { page?: number; pageSize?: number; entity_type?: string }
): Promise<ApiResponse<AuditLog[]>> {
    const supabase = await createSupabaseServerClient();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 30;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let qb = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

    if (query.entity_type) {
        qb = qb.eq("entity_type", query.entity_type);
    }

    const { data, error, count } = await qb;

    if (error) {
        return { success: false, error: { code: "DB_ERROR", message: error.message } };
    }

    return {
        success: true,
        data: (data as AuditLog[]) ?? [],
        meta: {
            page,
            pageSize,
            total: count ?? 0,
            totalPages: Math.ceil((count ?? 0) / pageSize),
        },
    };
}
