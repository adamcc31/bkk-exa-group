// ============================================
// Admin: User Management Page — Full CRUD
// Fields: Nama, Divisi (Unit PT), Email, Password
// with auto-generate password option
// ============================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { DataTable, type Column } from "@/shared/components/data-display/data-table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { useApiRequest } from "@/shared/lib/use-api";
import type { User, Company, Role, ApiResponse } from "@/shared/types";

function generatePassword(length = 16): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => chars[b % chars.length]).join("");
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        full_name: "",
        email: "",
        company_id: "",
        role_id: "",
        password: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    // Key-based AbortController hook for user search
    const { execute: searchUsers, cancel: cancelSearch, error: searchError } = useApiRequest<User[]>();

    const fetchData = useCallback(async () => {
        setLoading(true);

        // Fetch companies, users (scoped by active company via API), and all roles in parallel
        const [companiesRes, usersRes, rolesRes] = await Promise.all([
            fetch("/api/companies"),
            fetch("/api/admin/users"),
            fetch("/api/admin/roles"),
        ]);

        const companiesData = await companiesRes.json();
        const usersData: ApiResponse<User[]> = await usersRes.json();
        const rolesData = await rolesRes.json();

        if (companiesData.success) setCompanies(companiesData.data ?? []);
        if (usersData.success && usersData.data) setUsers(usersData.data);
        if (rolesData.success && rolesData.data) setRoles(rolesData.data);

        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Debounced search with key-based AbortController
    useEffect(() => {
        const timer = setTimeout(() => {
            const searchParam = searchTerm.trim()
                ? `?search=${encodeURIComponent(searchTerm.trim())}`
                : "";
            searchUsers(`/api/admin/users${searchParam}`).then((res) => {
                if (res?.success && res.data) setUsers(res.data);
            });
        }, 400);
        return () => {
            clearTimeout(timer);
            cancelSearch("/api/admin/users");
        };
    }, [searchTerm, searchUsers, cancelSearch]);

    function handleAutoGenerate() {
        const pw = generatePassword();
        setFormData({ ...formData, password: pw });
        setShowPassword(true);
    }

    async function handleCreate() {
        if (!formData.full_name || !formData.email || !formData.company_id || !formData.role_id || !formData.password) {
            setError("Semua field wajib diisi");
            return;
        }
        setSaving(true);
        setError(null);
        const res = await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });
        const result = await res.json();
        if (!result.success) {
            setError(result.error?.message ?? "Gagal membuat pengguna");
            setSaving(false);
            return;
        }
        setShowForm(false);
        setFormData({ full_name: "", email: "", company_id: "", role_id: "", password: "" });
        setShowPassword(false);
        setSaving(false);
        fetchData();
    }

    async function handleToggleActive(user: User) {
        if (user.is_active) {
            await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
        } else {
            await fetch(`/api/admin/users/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_active: true }),
            });
        }
        fetchData();
    }

    const inputClass = "block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] bg-white";
    const selectClass = "block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] bg-white appearance-none";
    const labelClass = "block text-sm font-medium text-gray-700 mb-2";

    const columns: Column<Record<string, unknown>>[] = [
        {
            key: "full_name",
            header: "Nama",
            render: (row) => (
                <div>
                    <span className="text-xs font-medium text-gray-900">{row.full_name as string}</span>
                    <span className="block text-[10px] text-gray-400">{row.email as string}</span>
                </div>
            ),
        },
        {
            key: "company",
            header: "Divisi (Unit PT)",
            render: (row) => {
                const company = row.company as Company | undefined;
                return <Badge variant="default">{company?.short_code ?? "—"}</Badge>;
            },
        },
        {
            key: "role",
            header: "Role",
            width: "100px",
            render: (row) => {
                const role = row.role as Role | undefined;
                const variant = role?.name === "admin" ? "primary" : role?.name === "finance" ? "warning" : "default";
                return <Badge variant={variant}>{(role?.name ?? "—").toUpperCase()}</Badge>;
            },
        },
        {
            key: "is_active",
            header: "Status",
            width: "80px",
            align: "center",
            render: (row) => (
                <Badge variant={row.is_active ? "success" : "danger"}>
                    {row.is_active ? "Aktif" : "Nonaktif"}
                </Badge>
            ),
        },
        {
            key: "actions",
            header: "",
            width: "120px",
            align: "right",
            render: (row) => (
                <Button
                    size="sm"
                    variant={row.is_active ? "danger" : "secondary"}
                    onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleToggleActive(row as unknown as User);
                    }}
                >
                    {row.is_active ? "Nonaktifkan" : "Aktifkan"}
                </Button>
            ),
        },
    ];

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Manajemen Pengguna</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Kelola akun pengguna dan hak akses</p>
                </div>
                <Button
                    icon={<span className="material-symbols-outlined text-base">person_add</span>}
                    onClick={() => setShowForm(!showForm)}
                >
                    Tambah Pengguna
                </Button>
            </div>

            {/* Search Bar */}
            <div className="mb-4">
                <div className="relative max-w-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-gray-400 text-lg">search</span>
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Cari nama pengguna..."
                        className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] bg-white transition-shadow"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm("")}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                            <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                    )}
                </div>
                {searchError && (
                    <p className="text-xs text-red-500 mt-1">{searchError}</p>
                )}
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm mb-4">{error}</div>
            )}

            {/* Create User Form */}
            {showForm && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6" style={{ boxShadow: "var(--shadow-soft)" }}>
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-blue-100 text-[var(--color-primary)] flex items-center justify-center">
                            <span className="material-symbols-outlined text-sm">person_add</span>
                        </span>
                        <h3 className="text-lg font-medium text-gray-900">Pengguna Baru</h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Nama Lengkap */}
                        <div>
                            <label className={labelClass}>
                                Nama Lengkap <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                placeholder="Masukkan nama lengkap"
                                className={inputClass}
                                required
                            />
                        </div>

                        {/* Divisi (Unit PT) */}
                        <div>
                            <label className={labelClass}>
                                Divisi (Unit PT) <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.company_id}
                                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                                className={selectClass}
                                required
                            >
                                <option value="">-- Pilih Unit PT --</option>
                                {companies.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.short_code})</option>
                                ))}
                            </select>
                        </div>

                        {/* Email */}
                        <div>
                            <label className={labelClass}>
                                Email <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-gray-400 text-sm">mail</span>
                                </div>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="email@perusahaan.com"
                                    className={`${inputClass} pl-10`}
                                    required
                                />
                            </div>
                        </div>

                        {/* Role */}
                        <div>
                            <label className={labelClass}>
                                Role <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.role_id}
                                onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                                className={selectClass}
                                required
                            >
                                <option value="">-- Pilih Role --</option>
                                {roles.map((r) => (
                                    <option key={r.id} value={r.id}>{r.name.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>

                        {/* Password */}
                        <div className="md:col-span-2">
                            <label className={labelClass}>
                                Password <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="Masukkan password atau auto-generate"
                                        className={inputClass}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                    >
                                        <span className="material-symbols-outlined text-sm">
                                            {showPassword ? "visibility_off" : "visibility"}
                                        </span>
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAutoGenerate}
                                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                                >
                                    <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                                    Auto Generate
                                </button>
                            </div>
                            {formData.password && showPassword && (
                                <p className="mt-1.5 text-xs text-gray-500 font-mono bg-gray-50 px-3 py-1.5 rounded border">
                                    {formData.password}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="px-6 pb-6 flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => { setShowForm(false); setError(null); }}>Batal</Button>
                        <Button loading={saving} onClick={handleCreate}>Simpan Pengguna</Button>
                    </div>
                </div>
            )}

            {/* Users Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <span className="material-symbols-outlined text-3xl text-gray-300 animate-spin">progress_activity</span>
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={users as unknown as Record<string, unknown>[]}
                    keyField="id"
                    emptyMessage="Belum ada pengguna terdaftar."
                />
            )}
        </div>
    );
}
