// ============================================
// Dashboard Layout — Server Component (Post-Supabase)
// Fetches auth session & companies, renders shell
// ============================================

import { redirect } from "next/navigation";
import { getAuthSession } from "@/features/auth";
import { query as systemQuery } from "@/shared/lib/db/client";
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

    // Fetch active companies using systemQuery (bypass RLS for layout setup)
    const res = await systemQuery(
        "SELECT * FROM companies WHERE is_active = true ORDER BY name ASC"
    );
    const companies = res.rows as Company[];

    const activeCompany = companies.find(
        (c) => c.id === session.activeCompanyId
    );

    return (
        <DashboardShell
            companies={companies}
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
