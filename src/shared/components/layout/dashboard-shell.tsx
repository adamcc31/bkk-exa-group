// ============================================
// Dashboard Shell — Client Wrapper (Post-Supabase)
// Manages company switching and auth state
// ============================================

"use client";

import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
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
        try {
            const response = await fetch("/api/auth/switch-company", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ companyId }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to switch company");
            }

            router.refresh();
        } catch (err) {
            console.error("Company switch failed:", err);
            alert("Gagal mengganti perusahaan");
        }
    }

    async function handleLogout() {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/login");
            router.refresh();
        } catch (err) {
            console.error("Logout failed:", err);
            // Fallback: forced redirect
            window.location.href = "/login";
        }
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
