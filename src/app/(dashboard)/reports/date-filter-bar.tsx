// ============================================
// Date Filter Bar — Client Component
// Date range inputs + apply button + CSV export
// ============================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";

interface DateFilterBarProps {
    dateFrom: string;
    dateTo: string;
}

export function DateFilterBar({ dateFrom, dateTo }: DateFilterBarProps) {
    const router = useRouter();
    const [from, setFrom] = useState(dateFrom);
    const [to, setTo] = useState(dateTo);
    const isInvalid = from > to;

    function handleApply() {
        if (isInvalid) return;
        router.push(`/reports?date_from=${from}&date_to=${to}`);
    }

    function handleExportCsv() {
        window.open(`/api/export/csv?date_from=${from}&date_to=${to}`, "_blank");
    }

    return (
        <div className="flex items-center justify-between mb-6">
            <div>
                <h1 className="text-xl font-bold text-gray-900">Laporan & Monitoring</h1>
                <p className="text-xs text-gray-500 mt-0.5">
                    Ringkasan keuangan dan pemantauan AI
                </p>
            </div>
            <div className="flex items-center gap-3">
                {/* Date Range Inputs */}
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5" style={{ boxShadow: "var(--shadow-soft)" }}>
                    <span className="material-symbols-outlined text-gray-400 text-base">calendar_today</span>
                    <input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className="text-xs border-none outline-none bg-transparent text-gray-700 w-[120px]"
                    />
                    <span className="text-xs text-gray-400">—</span>
                    <input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className="text-xs border-none outline-none bg-transparent text-gray-700 w-[120px]"
                    />
                    <Button size="sm" onClick={handleApply} disabled={isInvalid}>
                        Terapkan
                    </Button>
                </div>

                {isInvalid && (
                    <span className="text-xs text-red-500">Tanggal awal harus ≤ tanggal akhir</span>
                )}

                {/* Export CSV */}
                <Button
                    variant="secondary"
                    icon={<span className="material-symbols-outlined text-base">download</span>}
                    onClick={handleExportCsv}
                >
                    Export CSV
                </Button>
            </div>
        </div>
    );
}
