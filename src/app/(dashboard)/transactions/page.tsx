// ============================================
// Transactions List Page — Client Component
// ============================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/shared/components/data-display/data-table";
import { FilterBar, type FilterField } from "@/shared/components/data-display/filter-bar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { StatCard } from "@/shared/components/data-display/stat-card";
import { formatCurrency, formatDate } from "@/shared/lib/format";
import { BkkPreviewModal } from "@/features/pdf-export/components/bkk-preview-modal";
import { mapTransactionToBkkData } from "@/features/transactions/utils/mapper";
import type { Transaction, ApiResponse, UserRole, StandardizedBkkData } from "@/shared/types";

const FILTER_FIELDS: FilterField[] = [
    {
        key: "type",
        label: "Jenis",
        type: "select",
        options: [
            { value: "BKK", label: "Kas Keluar (BKK)" },
            { value: "BKM", label: "Kas Masuk (BKM)" },
        ],
    },
    {
        key: "payment_type",
        label: "Pembayaran",
        type: "select",
        options: [
            { value: "CASH", label: "Cash" },
            { value: "BANK", label: "Bank" },
        ],
    },
    { key: "date_from", label: "Dari Tanggal", type: "date" },
    { key: "date_to", label: "Sampai Tanggal", type: "date" },
    { key: "purpose", label: "Keperluan", type: "text", placeholder: "Cari..." },
    { key: "paid_to_name", label: "Dibayar Kepada", type: "text", placeholder: "Cari nama..." },
];

interface DashboardStats {
    totalBkm: number;
    totalBkk: number;
    totalTransactions: number;
    balance: number;
}

export default function TransactionsPage() {
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [selectedMonth, setSelectedMonth] = useState<string>("");
    const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [activeCompanyName, setActiveCompanyName] = useState<string>("EXATA");

    // Modal State
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [selectedBkkData, setSelectedBkkData] = useState<StandardizedBkkData | null>(null);


    const fetchData = useCallback(async () => {
        setLoading(true);

        // Build month-based date range
        const monthFilters: Record<string, string> = {};
        if (selectedMonth) {
            const [year, month] = selectedMonth.split('-');
            const lastDay = new Date(Number(year), Number(month), 0).getDate();
            monthFilters.date_from = `${selectedMonth}-01`;
            monthFilters.date_to = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
        }

        const mergedFilters = { ...filters, ...monthFilters };

        const params = new URLSearchParams({
            page: String(meta.page),
            ...mergedFilters,
        });

        const statsParams = new URLSearchParams();
        if (monthFilters.date_from) statsParams.set('date_from', monthFilters.date_from);
        if (monthFilters.date_to) statsParams.set('date_to', monthFilters.date_to);

        const [txRes, statsRes] = await Promise.all([
            fetch(`/api/transactions?${params}`),
            fetch(`/api/dashboard/stats?${statsParams}`),
        ]);

        const txData: ApiResponse<Transaction[]> = await txRes.json();

        if (txData.success && txData.data) {
            setTransactions(txData.data);
            if (txData.meta) setMeta(txData.meta);
        }
        if (statsRes.ok) {
            const statsData = await statsRes.json();
            if (statsData.success) setStats(statsData.data);
        }
        setLoading(false);
    }, [filters, meta.page, selectedMonth]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        async function fetchMe() {
            try {
                const res = await fetch("/api/me");
                if (res.ok) {
                    const meData = await res.json();
                    if (meData.success) {
                        setUserRole(meData.data.role as UserRole);
                        if (meData.data.activeCompanyName) {
                            setActiveCompanyName(meData.data.activeCompanyName);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch current user profile:", e);
            }
        }
        fetchMe();
    }, []);

    async function handleSoftDelete(id: string) {
        if (!confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) return;
        const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
        const result = await res.json();
        if (result.success) {
            fetchData();
        }
    }



    const canDelete = userRole === "admin" || userRole === "finance";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const columns: Column<Record<string, unknown>>[] = [
        {
            key: "transaction_date",
            header: "Tanggal",
            width: "100px",
            render: (row) => (
                <span className="text-xs text-gray-700 font-medium">
                    {formatDate(row.transaction_date as string)}
                </span>
            ),
        },
        {
            key: "type",
            header: "Jenis",
            width: "80px",
            align: "center",
            render: (row) => (
                <Badge variant={row.type === "BKK" ? "danger" : "success"}>
                    {row.type as string}
                </Badge>
            ),
        },
        {
            key: "bkk_number",
            header: "No. Dokumen",
            width: "100px",
            render: (row) => (
                <span className="text-xs font-mono text-gray-600">
                    {(row.bkk_number as string) || "—"}
                </span>
            ),
        },
        {
            key: "paid_to_name",
            header: "Dibayar Kepada",
            render: (row) => (
                <span className="text-xs text-gray-800 font-medium">
                    {(row.paid_to_name as string) || "—"}
                </span>
            ),
        },
        {
            key: "purpose",
            header: "Keperluan",
            render: (row) => (
                <span className="text-xs text-gray-600 truncate block max-w-[200px]">
                    {(row.purpose as string) || "—"}
                </span>
            ),
        },
        {
            key: "total_amount",
            header: "Jumlah",
            align: "right",
            width: "140px",
            render: (row) => (
                <span
                    className={`text-xs font-bold ${row.type === "BKK" ? "text-red-600" : "text-green-600"
                        }`}
                >
                    Rp {formatCurrency(row.total_amount as number)}
                </span>
            ),
        },
        {
            key: "status",
            header: "Status",
            width: "90px",
            align: "center",
            render: (row) => {
                const variant =
                    row.status === "approved"
                        ? "success"
                        : row.status === "printed"
                            ? "warning"
                            : row.status === "submitted"
                                ? "primary"
                                : "default";
                return (
                    <Badge variant={variant}>
                        {row.status === "approved"
                            ? "Disetujui"
                            : row.status === "printed"
                                ? "Printed"
                                : row.status === "submitted"
                                    ? "Diajukan"
                                    : "Draft"}
                    </Badge>
                );
            },
        },
        {
            key: "actions",
            header: "",
            width: "130px",
            align: "center",
            render: (row) => (
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/transactions/${row.id as string}`);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Edit / Revisi"
                    >
                        <span className="material-symbols-outlined text-base">edit</span>
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const bkkData = mapTransactionToBkkData(row as unknown as Transaction);
                            // Inject ID for the PDF link in modal
                            (bkkData as any).id = row.id;
                            setSelectedBkkData(bkkData);
                            setIsPreviewOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[var(--color-primary)] hover:bg-blue-50 transition-colors"
                        title="Lihat / Export Dokumen"
                    >
                        <span className="material-symbols-outlined text-base">visibility</span>
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const bkkData = mapTransactionToBkkData(row as unknown as Transaction);
                            (bkkData as any).id = row.id;
                            setSelectedBkkData(bkkData);
                            setIsPreviewOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                        title="Export JPG"
                    >
                        <span className="material-symbols-outlined text-base">image</span>
                    </button>
                    {canDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSoftDelete(row.id as string);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Hapus Transaksi"
                        >
                            <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Transaksi</h1>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Kelola Bukti Kas Masuk & Keluar
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label htmlFor="month-filter" className="text-xs text-gray-500 font-medium">
                            Filter Bulan:
                        </label>
                        <input
                            id="month-filter"
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => {
                                setSelectedMonth(e.target.value);
                                setMeta((prev) => ({ ...prev, page: 1 }));
                            }}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 bg-white hover:border-gray-300 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none transition-colors"
                        />
                        {selectedMonth && (
                            <button
                                onClick={() => {
                                    setSelectedMonth("");
                                    setMeta((prev) => ({ ...prev, page: 1 }));
                                }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Hapus filter bulan"
                            >
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        )}
                    </div>
                    <Button
                        icon={
                            <span className="material-symbols-outlined text-base">add</span>
                        }
                        onClick={() => router.push("/transactions/new")}
                    >
                        Buat Transaksi
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard
                        icon="account_balance_wallet"
                        label="Total Kas Masuk (BKM)"
                        value={`Rp ${formatCurrency(stats.totalBkm)}`}
                        iconBgClass="bg-green-50"
                        iconColorClass="text-green-600"
                        bottomBarColor="from-green-400 to-green-600"
                    />
                    <StatCard
                        icon="payments"
                        label="Total Kas Keluar (BKK)"
                        value={`Rp ${formatCurrency(stats.totalBkk)}`}
                        iconBgClass="bg-red-50"
                        iconColorClass="text-red-600"
                        bottomBarColor="from-red-400 to-red-600"
                    />
                    <StatCard
                        icon="swap_vert"
                        label="Total Transaksi"
                        value={String(stats.totalTransactions)}
                        iconBgClass="bg-purple-50"
                        iconColorClass="text-purple-600"
                        bottomBarColor="from-purple-400 to-purple-600"
                    />
                    <StatCard
                        icon="account_balance"
                        label="Total Transaksi"
                        value={`Rp ${formatCurrency(stats.totalBkm + stats.totalBkk)}`}
                        variant="highlight"
                    />
                </div>
            )}

            {/* Filters */}
            <FilterBar
                fields={FILTER_FIELDS}
                onApply={(f) => {
                    setFilters(f);
                    setMeta((prev) => ({ ...prev, page: 1 }));
                }}
                onReset={() => {
                    setFilters({});
                    setMeta((prev) => ({ ...prev, page: 1 }));
                }}
            />

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <span className="material-symbols-outlined text-3xl text-gray-300 animate-spin">
                        progress_activity
                    </span>
                </div>
            ) : (
                <>
                    <DataTable
                        columns={columns}
                        data={transactions as unknown as Record<string, unknown>[]}
                        keyField="id"
                        onRowClick={(row) =>
                            router.push(`/transactions/${row.id as string}`)
                        }
                        emptyMessage="Belum ada transaksi. Klik 'Buat Transaksi' untuk memulai."
                    />

                    {/* Pagination */}
                    {meta.totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                            <p className="text-xs text-gray-500">
                                Menampilkan halaman {meta.page} dari {meta.totalPages} ({meta.total} data)
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={meta.page <= 1}
                                    onClick={() =>
                                        setMeta((prev) => ({ ...prev, page: prev.page - 1 }))
                                    }
                                >
                                    Sebelumnya
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={meta.page >= meta.totalPages}
                                    onClick={() =>
                                        setMeta((prev) => ({ ...prev, page: prev.page + 1 }))
                                    }
                                >
                                    Selanjutnya
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}
            {/* Modal */}
            <BkkPreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                data={selectedBkkData}
            />
        </div>
    );
}
