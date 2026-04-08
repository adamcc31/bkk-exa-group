// ============================================
// DataTable Component — Reusable Data Display
// ============================================

"use client";

import type { ReactNode } from "react";

export interface Column<T> {
    key: string;
    header: string;
    width?: string;
    align?: "left" | "center" | "right";
    render?: (row: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    keyField: string;
    emptyMessage?: string;
    onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, unknown>>({
    columns,
    data,
    keyField,
    emptyMessage = "Tidak ada data",
    onRowClick,
}: DataTableProps<T>) {
    return (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50">
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className={`px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider ${col.align === "right"
                                    ? "text-right"
                                    : col.align === "center"
                                        ? "text-center"
                                        : "text-left"
                                    }`}
                                style={col.width ? { width: col.width } : undefined}
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {data.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                className="px-4 py-12 text-center text-gray-400"
                            >
                                <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">
                                    inbox
                                </span>
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((row, idx) => (
                            <tr
                                key={String(row[keyField])}
                                onClick={() => onRowClick?.(row)}
                                className={`
                  transition-colors
                  ${onRowClick ? "cursor-pointer hover:bg-blue-50/40" : ""}
                  ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}
                `}
                            >
                                {columns.map((col) => (
                                    <td
                                        key={col.key}
                                        className={`px-4 py-3 ${col.align === "right"
                                            ? "text-right"
                                            : col.align === "center"
                                                ? "text-center"
                                                : "text-left"
                                            }`}
                                    >
                                        {col.render
                                            ? col.render(row, idx)
                                            : String(row[col.key] ?? "—")}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
