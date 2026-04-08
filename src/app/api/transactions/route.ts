// ============================================
// Transaction API — List & Create
// GET  /api/transactions      → list (paginated, filtered)
// POST /api/transactions      → create
// ============================================

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/features/auth";
import { PERMISSIONS } from "@/shared/lib/constants";
import {
    transactionQuerySchema,
    createTransactionSchema,
} from "@/features/transactions/types";
import {
    listTransactions,
    createTransaction,
} from "@/features/transactions/services";

export const dynamic = "force-dynamic";

// GET /api/transactions
export async function GET(request: NextRequest) {
    const { session, error } = await requireAuth(PERMISSIONS.TRANSACTION_READ);
    if (error) return error;

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = transactionQuerySchema.safeParse(searchParams);

    if (!parsed.success) {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid query parameters",
                    details: parsed.error.flatten(),
                },
            },
            { status: 400 }
        );
    }

    const result = await listTransactions(session, parsed.data);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

// POST /api/transactions
export async function POST(request: NextRequest) {
    const { session, error } = await requireAuth(PERMISSIONS.TRANSACTION_CREATE);
    if (error) return error;

    const body = await request.json();
    const parsed = createTransactionSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid transaction data",
                    details: parsed.error.flatten(),
                },
            },
            { status: 400 }
        );
    }

    const result = await createTransaction(session, parsed.data);
    return NextResponse.json(result, { status: result.success ? 201 : 500 });
}
