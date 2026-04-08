// ============================================
// Transaction API — Get, Update, Delete
// GET    /api/transactions/[id]  → get single
// PATCH  /api/transactions/[id]  → update
// DELETE /api/transactions/[id]  → soft delete
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/features/auth";
import { PERMISSIONS } from "@/shared/lib/constants";
import { updateTransactionSchema } from "@/features/transactions/types";
import {
    getTransaction,
    updateTransaction,
    softDeleteTransaction,
} from "@/features/transactions/services";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/transactions/[id]
export async function GET(request: NextRequest, context: RouteContext) {
    const { error } = await requireAuth(PERMISSIONS.TRANSACTION_READ);
    if (error) return error;

    const { id } = await context.params;
    const result = await getTransaction(id);

    return NextResponse.json(result, {
        status: result.success ? 200 : 404,
    });
}

// PATCH /api/transactions/[id]
export async function PATCH(request: NextRequest, context: RouteContext) {
    const { error } = await requireAuth(PERMISSIONS.TRANSACTION_UPDATE);
    if (error) return error;

    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateTransactionSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid update data",
                    details: parsed.error.flatten(),
                },
            },
            { status: 400 }
        );
    }

    const result = await updateTransaction(id, parsed.data);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

// DELETE /api/transactions/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
    const { error } = await requireAuth(PERMISSIONS.TRANSACTION_DELETE);
    if (error) return error;

    const { id } = await context.params;
    const result = await softDeleteTransaction(id);

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
