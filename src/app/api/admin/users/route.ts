// ============================================
// Admin Users API
// GET/POST /api/admin/users
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/features/auth";
import { PERMISSIONS } from "@/shared/lib/constants";
import { listUsers, createUser } from "@/features/admin/services/users";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const { session, error } = await requireAuth(PERMISSIONS.USER_READ);
    if (error) return error;

    const params = request.nextUrl.searchParams;
    const query = {
        page: Number(params.get("page") ?? 1),
        pageSize: Number(params.get("pageSize") ?? 20),
        company_id: params.get("company_id") ?? session.activeCompanyId,
        search: params.get("search") ?? undefined,
    };

    const result = await listUsers(session, query);
    return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
    const { session, error } = await requireAuth(PERMISSIONS.USER_CREATE);
    if (error) return error;

    const body = await request.json();
    const result = await createUser(session, body);

    return NextResponse.json(result, {
        status: result.success ? 201 : 400,
    });
}
