// ============================================
// AI Jobs Section — Client Component
// Fetches and displays AI parsing activity
// ============================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { DataTable, type Column } from "@/shared/components/data-display/data-table";
import { Badge } from "@/shared/components/ui/badge";
import { formatCurrency, formatDate } from "@/shared/lib/format";
import type { AiJobStatus } from "@/shared/types";

interface AiJob {
    id: string;
    status: AiJobStatus;
    document_type: string | null;
    original_filename: string;
    total_amount: number | null;
    error_message: string | null;
    created_at: string;
}

export function AiJobsSection() {
    const [aiJobs, setAiJobs] = useState<AiJob[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchJobs = useCallback(async () => {
        setLoading(true);
        try {
            const aiRes = await fetch("/api/ai-parse/status/latest");
            const aiData = await aiRes.json();
            if (aiData.success) setAiJobs(aiData.data ?? []);
        } catch {
            // AI jobs endpoint may not exist yet, that's OK
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    const jobColumns: Column<Record<string, unknown>>[] = [
        {
            key: "original_filename",
            header: "File",
            render: (row) => (
                <span className="text-xs font-medium text-gray-700">{row.original_filename as string}</span>
            ),
        },
        {
            key: "document_type",
            header: "Tipe",
            width: "100px",
            render: (row) => (
                <Badge variant="default">
                    {((row.document_type as string) || "—").toUpperCase()}
                </Badge>
            ),
        },
        {
            key: "total_amount",
            header: "Nominal",
            align: "right",
            width: "140px",
            render: (row) => (
                <span className="text-xs font-bold text-gray-700">
                    {(row.total_amount as number) ? `Rp ${formatCurrency(row.total_amount as number)}` : "—"}
                </span>
            ),
        },
        {
            key: "status",
            header: "Status",
            width: "100px",
            align: "center",
            render: (row) => {
                const s = row.status as string;
                const variant = s === "completed" ? "success" : s === "failed" ? "danger" : s === "processing" ? "primary" : "warning";
                return <Badge variant={variant}>{s.toUpperCase()}</Badge>;
            },
        },
        {
            key: "created_at",
            header: "Waktu",
            width: "120px",
            render: (row) => (
                <span className="text-xs text-gray-500">{formatDate(row.created_at as string)}</span>
            ),
        },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <span className="material-symbols-outlined text-2xl text-gray-300 animate-spin">progress_activity</span>
            </div>
        );
    }

    return (
        <>
            <div className="mb-4">
                <h2 className="text-sm font-bold text-gray-900 mb-3">
                    <span className="material-symbols-outlined text-base align-text-bottom mr-1 text-[var(--color-primary)]">smart_toy</span>
                    AI Parsing Activity
                </h2>
            </div>

            {aiJobs.length > 0 ? (
                <DataTable
                    columns={jobColumns}
                    data={aiJobs as unknown as Record<string, unknown>[]}
                    keyField="id"
                    emptyMessage="Belum ada aktivitas AI parsing."
                />
            ) : (
                <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                    <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">smart_toy</span>
                    <p className="text-xs text-gray-400">
                        Belum ada aktivitas AI parsing. Upload dokumen di halaman AI Parser.
                    </p>
                </div>
            )}
        </>
    );
}
