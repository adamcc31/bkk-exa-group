// ============================================
// Dashboard Shell — Client Wrapper
// Manages company switching and auth state
// ============================================

"use client";

import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import type { Company, UserRole } from "@/shared/types";

interface DashboardShellProps {
    children: React.ReactNode;
    companies: Company[];
    activeCompanyId: string;
    role: UserRole;
    userName: string;
    companyShortCode: string;
}

export function DashboardShell({
    children,
    companies,
    activeCompanyId,
    role,
    userName,
    companyShortCode,
}: DashboardShellProps) {
    const router = useRouter();

    async function handleCompanySwitch(companyId: string) {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.updateUser({
            data: { active_company_id: companyId },
        });
        router.refresh();
    }

    async function handleLogout() {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    }

    return (
        <div className="min-h-screen bg-[var(--color-bg-light)]">
            <Sidebar
                role={role}
                userName={userName}
                companyShortCode={companyShortCode}
            />

            <div className="ml-64">
                <Navbar
                    companies={companies}
                    activeCompanyId={activeCompanyId}
                    role={role}
                    onCompanySwitch={handleCompanySwitch}
                    onLogout={handleLogout}
                />

                <main className="p-6">{children}</main>
            </div>
        </div>
    );
}
