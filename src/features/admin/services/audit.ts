// ============================================
// Audit Log Service (Post-Supabase)
// ============================================

import { withDbContext } from "@/shared/lib/db/client";
import type { AuthSession, AuditLog, ApiResponse } from "@/shared/types";

/**
 * Writes a new audit log entry
 */
export async function writeAuditLog(params: {
    session: AuthSession;
    action: string;
    entityType: string;
    entityId: string;
    oldValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    ipAddress?: string;
}): Promise<void> {
    await withDbContext(
        params.session.user.id,
        params.session.activeCompanyId,
        params.session.role,
        params.session.user.company_id,
        async (client) => {
            await client.query(
                `INSERT INTO audit_logs (
                company_id, user_id, action, entity_type, entity_id, 
                old_value, new_value, ip_address
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    params.session.activeCompanyId,
                    params.session.user.id,
                    params.action,
                    params.entityType,
                    params.entityId,
                    params.oldValue ?? null,
                    params.newValue ?? null,
                    params.ipAddress ?? null,
                ]
            );
        }
    );
}

/**
 * Lists audit logs with pagination
 */
export async function listAuditLogs(
    session: AuthSession,
    query: { page?: number; pageSize?: number; entity_type?: string }
): Promise<ApiResponse<AuditLog[]>> {
    return await withDbContext(
        session.user.id,
        session.activeCompanyId,
        session.role,
        session.user.company_id,
        async (client) => {
            const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 30;
        const offset = (page - 1) * pageSize;

        const params: any[] = [];
        let whereClause = "";

        if (query.entity_type) {
            whereClause = "WHERE entity_type = $1";
            params.push(query.entity_type);
        }

        const nextIdx = params.length + 1;

        // 1. Get total count
        const countRes = await client.query(
            `SELECT COUNT(*)::INT as total FROM audit_logs ${whereClause}`,
            params
        );
        const total = countRes.rows[0].total;

        // 2. Get data
        const dataRes = await client.query(
            `SELECT * FROM audit_logs 
             ${whereClause} 
             ORDER BY created_at DESC 
             LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
            [...params, pageSize, offset]
        );

        return {
            success: true,
            data: dataRes.rows as AuditLog[],
            meta: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    });
}
