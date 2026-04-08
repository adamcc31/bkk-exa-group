// ============================================
// Audit Logs API
// GET /api/admin/audit-logs
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/features/auth";
import { PERMISSIONS } from "@/shared/lib/constants";
import { listAuditLogs } from "@/features/admin/services/audit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const { error } = await requireAuth(PERMISSIONS.AUDIT_VIEW);
    if (error) return error;

    const params = request.nextUrl.searchParams;
    const query = {
        page: Number(params.get("page") ?? 1),
        pageSize: Number(params.get("pageSize") ?? 30),
        entity_type: params.get("entity_type") ?? undefined,
    };

    const result = await listAuditLogs(query);
    return NextResponse.json(result);
}
