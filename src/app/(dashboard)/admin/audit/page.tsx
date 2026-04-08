// ============================================
// Audit Trail Page — Admin Only
// ============================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { DataTable, type Column } from "@/shared/components/data-display/data-table";
import { Badge } from "@/shared/components/ui/badge";
import type { AuditLog, ApiResponse } from "@/shared/types";

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });

    const fetchData = useCallback(async () => {
        setLoading(true);
        const res = await fetch(`/api/admin/audit-logs?page=${meta.page}`);
        const data: ApiResponse<AuditLog[]> = await res.json();
        if (data.success && data.data) {
            setLogs(data.data);
            if (data.meta) setMeta(data.meta);
        }
        setLoading(false);
    }, [meta.page]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const actionColor = (action: string) => {
        if (action.includes("create")) return "success";
        if (action.includes("delete")) return "danger";
        if (action.includes("update")) return "warning";
        return "default";
    };

    const columns: Column<Record<string, unknown>>[] = [
        {
            key: "created_at",
            header: "Waktu",
            width: "140px",
            render: (row) => {
                const d = new Date(row.created_at as string);
                return (
                    <span className="text-xs text-gray-600">
                        {d.toLocaleDateString("id-ID")} {d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                );
            },
        },
        {
            key: "action",
            header: "Aksi",
            width: "120px",
            render: (row) => (
                <Badge variant={actionColor(row.action as string)}>
                    {(row.action as string).toUpperCase()}
                </Badge>
            ),
        },
        {
            key: "entity_type",
            header: "Entitas",
            width: "120px",
            render: (row) => (
                <span className="text-xs font-mono text-gray-600">
                    {row.entity_type as string}
                </span>
            ),
        },
        {
            key: "entity_id",
            header: "ID",
            width: "200px",
            render: (row) => (
                <span className="text-[10px] font-mono text-gray-400">
                    {(row.entity_id as string)?.slice(0, 12)}...
                </span>
            ),
        },
        {
            key: "user_id",
            header: "User",
            render: (row) => (
                <span className="text-xs text-gray-600">
                    {(row.user_id as string)?.slice(0, 8)}...
                </span>
            ),
        },
        {
            key: "ip_address",
            header: "IP",
            width: "120px",
            render: (row) => (
                <span className="text-xs text-gray-400 font-mono">
                    {(row.ip_address as string) || "—"}
                </span>
            ),
        },
    ];

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900">Audit Trail</h1>
                <p className="text-xs text-gray-500 mt-0.5">
                    Log aktivitas sistem — hanya untuk Admin
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <span className="material-symbols-outlined text-3xl text-gray-300 animate-spin">progress_activity</span>
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={logs as unknown as Record<string, unknown>[]}
                    keyField="id"
                    emptyMessage="Belum ada log aktivitas."
                />
            )}
        </div>
    );
}
