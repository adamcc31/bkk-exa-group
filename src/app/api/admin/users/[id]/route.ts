// ============================================
// Admin Users [id] API — Update / Deactivate
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/features/auth";
import { PERMISSIONS } from "@/shared/lib/constants";
import { updateUser, deactivateUser } from "@/features/admin/services/users";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
    const { session, error } = await requireAuth(PERMISSIONS.USER_UPDATE);
    if (error) return error;

    const { id } = await context.params;
    const body = await request.json();
    const result = await updateUser(session, id, body);

    return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
    const { session, error } = await requireAuth(PERMISSIONS.USER_DELETE);
    if (error) return error;

    const { id } = await context.params;
    const result = await deactivateUser(session, id);

    return NextResponse.json(result);
}
