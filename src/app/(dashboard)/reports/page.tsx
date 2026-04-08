// ============================================
// Reports & Monitoring Page — Server Component
// Fetches stats directly on server, no API route needed
// ============================================

import { redirect } from "next/navigation";
import { getAuthSession } from "@/features/auth";
import { getDashboardStats } from "@/features/transactions/services";
import { getDefaultDateRange } from "@/shared/lib/date";
import { DateFilterBar } from "./date-filter-bar";
import { StatsDisplay } from "./stats-display";
import { AiJobsSection } from "./ai-jobs-section";

interface Props {
    searchParams: Promise<{ date_from?: string; date_to?: string }>;
}

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: Props) {
    const session = await getAuthSession();
    if (!session) redirect("/login");

    const params = await searchParams;
    const { dateFrom: defaultFrom, dateTo: defaultTo } = getDefaultDateRange();
    const dateFrom = params.date_from ?? defaultFrom;
    const dateTo = params.date_to ?? defaultTo;

    let stats = null;
    let error: string | null = null;

    try {
        stats = await getDashboardStats(session, dateFrom, dateTo);
    } catch (err: unknown) {
        error = (err as Error).message;
    }

    return (
        <div>
            {/* Header + Date Filter + Export */}
            <DateFilterBar dateFrom={dateFrom} dateTo={dateTo} />

            {/* Error Banner */}
            {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm mb-6">
                    <span className="material-symbols-outlined text-sm align-text-bottom mr-1">error</span>
                    {error}
                </div>
            )}

            {/* Summary Stats */}
            {stats && <StatsDisplay stats={stats} />}

            {/* AI Jobs (client component — independent fetch) */}
            <AiJobsSection />
        </div>
    );
}
