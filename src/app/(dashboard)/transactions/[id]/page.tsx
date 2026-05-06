// ============================================
// Transaction Detail / Edit Page
// ============================================

import { redirect } from "next/navigation";
import { requireAuth } from "@/features/auth";
import { PERMISSIONS } from "@/shared/lib/constants";
import { getTransaction } from "@/features/transactions/services";
import TransactionForm from "@/features/transactions/components/transaction-form";
import type { Transaction } from "@/shared/types";

export const dynamic = "force-dynamic";

export default async function TransactionDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { session, error: authError } = await requireAuth(PERMISSIONS.TRANSACTION_READ);
    if (authError) redirect("/login");

    const { id } = await params;
    const result = await getTransaction(session, id);

    if (!result.success || !result.data) {
        redirect("/transactions");
    }

    return <TransactionForm initialData={result.data as Transaction} />;
}
