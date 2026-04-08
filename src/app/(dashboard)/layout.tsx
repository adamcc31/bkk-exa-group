// ============================================
// Dashboard Layout — Server Component
// Fetches auth session & companies, renders shell
// ============================================

import { redirect } from "next/navigation";
import { getAuthSession } from "@/features/auth";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { DashboardShell } from "@/shared/components/layout/dashboard-shell";
import type { Company } from "@/shared/types";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getAuthSession();
    if (!session) redirect("/login");

    const supabase = await createSupabaseServerClient();
    const { data: companies } = await supabase
        .from("companies")
        .select("*")
        .eq("is_active", true)
        .order("name");

    const activeCompany = (companies as Company[] | null)?.find(
        (c) => c.id === session.activeCompanyId
    );

    return (
        <DashboardShell
            companies={(companies as Company[]) ?? []}
            activeCompanyId={session.activeCompanyId}
            role={session.role}
            userName={session.user.full_name}
            companyShortCode={activeCompany?.short_code ?? "—"}
        >
            {/* key forces client component remount on company switch */}
            <div key={session.activeCompanyId}>
                {children}
            </div>
        </DashboardShell>
    );
}
