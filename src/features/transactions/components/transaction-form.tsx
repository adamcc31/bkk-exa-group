// ============================================
// Transaction Form — Matching Template Design
// 4 Card Sections: Info Umum, Detail Transaksi,
// Lampiran & Catatan, Otorisasi
// ============================================

"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
    TRANSACTION_TYPES,
    PAYMENT_TYPES,
    DIVISIONS,
    DEPARTMENTS,
    PAID_BY_OPTIONS,
    APPROVED_BY_OPTIONS,
    PDF_SPECS,
} from "@/shared/lib/constants";
import type { Transaction } from "@/shared/types";

interface FormRow {
    description: string;
    account_code: string;
    amount: string;
}

interface TransactionFormProps {
    initialData?: Transaction;
}

const EMPTY_ROW: FormRow = { description: "", account_code: "", amount: "" };

export default function TransactionForm({ initialData }: TransactionFormProps) {
    const router = useRouter();
    const isEdit = !!initialData;

    // --- State ---
    const [division, setDivision] = useState(initialData?.division ?? "");
    const [type, setType] = useState(initialData?.type ?? "BKK");
    const [department, setDepartment] = useState(initialData?.department ?? "");
    const [paymentType, setPaymentType] = useState(initialData?.payment_type ?? "CASH");
    const [transactionDate, setTransactionDate] = useState(initialData?.transaction_date ?? new Date().toISOString().split("T")[0]);
    const [totalAmount, setTotalAmount] = useState(initialData?.total_amount?.toString() ?? "");
    const [purpose, setPurpose] = useState(initialData?.purpose ?? "");
    const [paidToName, setPaidToName] = useState(initialData?.paid_to_name ?? "");
    const [note, setNote] = useState(initialData?.note ?? "");
    const [receivedBy, setReceivedBy] = useState(initialData?.received_by ?? "");
    const [paidBy, setPaidBy] = useState(initialData?.paid_by ?? "BU NURUL");
    const [approvedBy, setApprovedBy] = useState(initialData?.approved_by ?? "PAK NOVI");

    const [rows, setRows] = useState<FormRow[]>(
        initialData?.items?.map((item) => ({
            description: item.description,
            account_code: item.account_code,
            amount: item.amount.toString(),
        })) ?? [{ ...EMPTY_ROW }]
    );

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auto-fill "Dibayarkan Kepada" and "Diterima Oleh" for staff role
    useEffect(() => {
        if (isEdit) return; // Don't auto-fill on edit mode
        async function fetchMe() {
            try {
                const res = await fetch("/api/me");
                const data = await res.json();
                if (data.success && data.data.role === "staff" && data.data.userName) {
                    const name = data.data.userName;
                    if (!paidToName) setPaidToName(name);
                    if (!receivedBy) setReceivedBy(name);
                }
            } catch {
                // Silently fail — not critical
            }
        }
        fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEdit]);

    // --- Row Management ---
    function addRow() {
        if (rows.length >= PDF_SPECS.MAX_DATA_ROWS) return;
        setRows([...rows, { ...EMPTY_ROW }]);
    }

    function removeRow(idx: number) {
        if (rows.length <= 1) return;
        setRows(rows.filter((_, i) => i !== idx));
    }

    function updateRow(idx: number, field: keyof FormRow, value: string) {
        const updated = [...rows];
        updated[idx] = { ...updated[idx], [field]: value };
        setRows(updated);

        // Auto-calculate total from row amounts
        const sum = updated.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
        if (sum > 0) setTotalAmount(sum.toString());
    }

    // --- Submit ---
    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const payload = {
            type,
            payment_type: paymentType,
            transaction_date: transactionDate,
            total_amount: parseFloat(totalAmount) || 0,
            purpose,
            division,
            department,
            paid_to_name: paidToName,
            received_by: receivedBy,
            paid_by: paidBy,
            approved_by: approvedBy,
            note: note || null,
            items: rows
                .filter((r) => r.description || r.amount)
                .map((r, i) => ({
                    item_order: i + 1,
                    description: r.description,
                    account_code: r.account_code,
                    amount: parseFloat(r.amount) || 0,
                })),
        };

        try {
            const url = isEdit ? `/api/transactions/${initialData!.id}` : "/api/transactions";
            const method = isEdit ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const result = await res.json();
            if (!result.success) {
                setError(result.error?.message ?? "Gagal menyimpan");
                setSaving(false);
                return;
            }

            router.push("/transactions");
            router.refresh();
        } catch (err) {
            setError(String(err));
            setSaving(false);
        }
    }

    const inputClass = "block w-full pl-3 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] bg-white transition-shadow";
    const selectClass = "block w-full pl-3 pr-10 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] bg-white transition-shadow appearance-none";
    const labelClass = "block text-sm font-medium text-gray-700 mb-2";

    return (
        <div className="max-w-4xl mx-auto px-4 py-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">
                    {isEdit ? "Edit Formulir Kas" : "Formulir Kas Online"}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                    {isEdit ? "Perbarui data transaksi kas." : "Buat permintaan kas masuk (BKM) atau kas keluar (BKK) baru."}
                </p>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm mb-6">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* ===== Section 1: Informasi Umum ===== */}
                <div className="bg-white shadow-[var(--shadow-soft)] rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-blue-100 text-[var(--color-primary)] flex items-center justify-center">
                            <span className="material-symbols-outlined text-sm">info</span>
                        </span>
                        <h3 className="text-lg font-medium text-gray-900">Informasi Umum</h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClass}>Divisi</label>
                            <select value={division} onChange={(e) => setDivision(e.target.value)} className={selectClass} required>
                                <option value="">-- Pilih Divisi --</option>
                                {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Form Type</label>
                            <select value={type} onChange={(e) => setType(e.target.value as "BKM" | "BKK")} className={selectClass}>
                                {TRANSACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Bagian (Department)</label>
                            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={selectClass} required>
                                <option value="">-- Pilih Bagian --</option>
                                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>No. BKK Type</label>
                            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as "CASH" | "BANK")} className={selectClass}>
                                {PAYMENT_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                        </div>
                        {/* Auto-generated BKK/BKM Number (read-only) */}
                        <div>
                            <label className={labelClass}>No. Dokumen</label>
                            {isEdit && initialData?.bkk_number ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={initialData.bkk_number}
                                        readOnly
                                        disabled
                                        className={`${inputClass} bg-gray-100 text-gray-600 cursor-not-allowed font-mono`}
                                    />
                                    <span className="material-symbols-outlined text-gray-400 text-sm" title="Nomor otomatis, tidak dapat diubah">lock</span>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 italic mt-2">
                                    <span className="material-symbols-outlined text-sm align-middle mr-1">auto_awesome</span>
                                    Nomor akan di-generate otomatis saat disimpan
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* ===== Section 2: Detail Transaksi ===== */}
                <div className="bg-white shadow-[var(--shadow-soft)] rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-sm">receipt_long</span>
                        </span>
                        <h3 className="text-lg font-medium text-gray-900">Detail Transaksi</h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClass}>Tanggal</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-gray-400 text-sm">calendar_today</span>
                                </div>
                                <input
                                    type="date"
                                    value={transactionDate}
                                    onChange={(e) => setTransactionDate(e.target.value)}
                                    className={`${inputClass} pl-10`}
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Jumlah Uang (Rp)</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 text-sm font-semibold">Rp</span>
                                </div>
                                <input
                                    type="text"
                                    value={totalAmount}
                                    onChange={(e) => setTotalAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                                    placeholder="0"
                                    className={`${inputClass} pl-10 pr-12`}
                                    required
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 text-sm">IDR</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Dibayarkan Kepada</label>
                            <input
                                type="text"
                                value={paidToName}
                                onChange={(e) => setPaidToName(e.target.value)}
                                placeholder="Nama penerima"
                                className={inputClass}
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Untuk Keperluan</label>
                            <input
                                type="text"
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                                placeholder="Contoh: Pembelian ATK Bulanan"
                                className={inputClass}
                                required
                            />
                        </div>

                        {/* Dynamic Detail Rows */}
                        <div className="col-span-1 md:col-span-2">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-700">Keterangan Detail</label>
                                {rows.length < PDF_SPECS.MAX_DATA_ROWS && (
                                    <button
                                        type="button"
                                        onClick={addRow}
                                        className="text-xs text-[var(--color-primary)] hover:text-blue-700 font-medium flex items-center"
                                    >
                                        <span className="material-symbols-outlined text-sm mr-1">add</span>
                                        Tambah Baris
                                    </button>
                                )}
                            </div>
                            <div className="space-y-2">
                                {rows.map((row, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            value={row.description}
                                            onChange={(e) => updateRow(idx, "description", e.target.value)}
                                            placeholder="Deskripsi item..."
                                            className={inputClass}
                                            style={{ width: "auto", flex: "3 1 0%" }}
                                        />
                                        <input
                                            type="text"
                                            value={row.account_code}
                                            onChange={(e) => updateRow(idx, "account_code", e.target.value)}
                                            placeholder="No. A/C"
                                            className={inputClass}
                                            style={{ width: "80px", flexShrink: 0 }}
                                        />
                                        <input
                                            type="text"
                                            value={row.amount}
                                            onChange={(e) => updateRow(idx, "amount", e.target.value.replace(/[^0-9.]/g, ""))}
                                            placeholder="Jumlah"
                                            className={inputClass}
                                            style={{ width: "130px", flexShrink: 0 }}
                                        />
                                        {rows.length > 1 && (
                                            <button type="button" onClick={() => removeRow(idx)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                                <span className="material-symbols-outlined text-base">close</span>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Add Row Button (bottom) */}
                    {rows.length < PDF_SPECS.MAX_DATA_ROWS && (
                        <div className="px-6 pb-6 pt-0">
                            <button
                                type="button"
                                onClick={addRow}
                                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors flex items-center justify-center gap-2 bg-gray-50"
                            >
                                <span className="material-symbols-outlined">add_circle_outline</span>
                                Tambah Keterangan Lain
                            </button>
                        </div>
                    )}
                </div>

                {/* ===== Section 3: Lampiran & Catatan ===== */}
                <div className="bg-white shadow-[var(--shadow-soft)] rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-sm">attach_file</span>
                        </span>
                        <h3 className="text-lg font-medium text-gray-900">Lampiran &amp; Catatan</h3>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <label className={labelClass}>Note (Optional)</label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Tambahkan catatan tambahan jika diperlukan..."
                                rows={3}
                                className={`${inputClass} resize-none`}
                            />
                        </div>
                    </div>
                </div>

                {/* ===== Section 4: Otorisasi ===== */}
                <div className="bg-white shadow-[var(--shadow-soft)] rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-sm">verified_user</span>
                        </span>
                        <h3 className="text-lg font-medium text-gray-900">Otorisasi</h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className={labelClass}>Diterima oleh</label>
                            <input
                                type="text"
                                value={receivedBy}
                                onChange={(e) => setReceivedBy(e.target.value)}
                                placeholder="Nama penerima"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Dibayar oleh</label>
                            <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className={selectClass}>
                                {PAID_BY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Disetujui oleh</label>
                            <select value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} className={selectClass}>
                                {APPROVED_BY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* ===== Actions ===== */}
                <div className="flex items-center justify-end gap-4 pt-4 pb-12">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-8 py-3 border border-transparent rounded-xl shadow-lg shadow-blue-500/30 text-sm font-bold text-white bg-[var(--color-primary)] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
                    >
                        {saving ? "Menyimpan..." : "Simpan Formulir"}
                    </button>
                </div>
            </form>
        </div>
    );
}
