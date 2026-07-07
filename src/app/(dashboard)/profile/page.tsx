// ============================================
// Profile Page — Change Password & View Profile
// ============================================

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";

interface ProfileData {
    id: string;
    email: string;
    full_name: string;
    role: string;
    company_name: string;
    is_active: boolean;
    created_at: string;
}

export default function ProfilePage() {
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);

    // Password form
    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [pwLoading, setPwLoading] = useState(false);
    const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Admin edit form
    const [editEmail, setEditEmail] = useState("");
    const [editName, setEditName] = useState("");
    const [editLoading, setEditLoading] = useState(false);
    const [editMessage, setEditMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        async function fetchProfile() {
            try {
                const res = await fetch("/api/profile");
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        setProfile(data.data);
                        setEditEmail(data.data.email);
                        setEditName(data.data.full_name);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch profile:", e);
            } finally {
                setLoading(false);
            }
        }
        fetchProfile();
    }, []);

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault();
        setPwMessage(null);

        if (newPw.length < 8) {
            setPwMessage({ type: "error", text: "Password baru minimal 8 karakter" });
            return;
        }
        if (newPw !== confirmPw) {
            setPwMessage({ type: "error", text: "Konfirmasi password tidak cocok" });
            return;
        }

        setPwLoading(true);
        try {
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "change_password",
                    current_password: currentPw,
                    new_password: newPw,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setPwMessage({ type: "success", text: "Password berhasil diubah. Silakan login kembali." });
                setCurrentPw("");
                setNewPw("");
                setConfirmPw("");
            } else {
                setPwMessage({ type: "error", text: data.error?.message || "Gagal mengubah password" });
            }
        } catch {
            setPwMessage({ type: "error", text: "Terjadi kesalahan jaringan" });
        } finally {
            setPwLoading(false);
        }
    }

    async function handleUpdateProfile(e: React.FormEvent) {
        e.preventDefault();
        setEditMessage(null);
        setEditLoading(true);

        try {
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update_profile",
                    email: editEmail,
                    full_name: editName,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setEditMessage({ type: "success", text: "Profil berhasil diperbarui" });
                if (profile) {
                    setProfile({ ...profile, email: editEmail, full_name: editName });
                }
            } else {
                setEditMessage({ type: "error", text: data.error?.message || "Gagal memperbarui profil" });
            }
        } catch {
            setEditMessage({ type: "error", text: "Terjadi kesalahan jaringan" });
        } finally {
            setEditLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <span className="material-symbols-outlined text-3xl text-gray-300 animate-spin">
                    progress_activity
                </span>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="text-center py-20 text-gray-500 text-sm">
                Gagal memuat profil.
            </div>
        );
    }

    const isAdmin = profile.role === "admin";

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-xl font-bold text-gray-900">Profil Saya</h1>
                <p className="text-xs text-gray-500 mt-0.5">
                    Kelola informasi akun dan keamanan
                </p>
            </div>

            {/* Profile Info Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-gray-400">person</span>
                    Informasi Akun
                </h2>

                {isAdmin ? (
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                            <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Nama Lengkap</label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                                required
                            />
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Role: <strong className="text-gray-900 uppercase">{profile.role}</strong></span>
                            <span>Perusahaan: <strong className="text-gray-900">{profile.company_name}</strong></span>
                        </div>
                        {editMessage && (
                            <p className={`text-xs ${editMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                                {editMessage.text}
                            </p>
                        )}
                        <Button type="submit" size="sm" disabled={editLoading}>
                            {editLoading ? "Menyimpan..." : "Simpan Perubahan"}
                        </Button>
                    </form>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                            <span className="text-xs text-gray-500">Email</span>
                            <span className="text-sm text-gray-900 font-medium">{profile.email}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                            <span className="text-xs text-gray-500">Nama Lengkap</span>
                            <span className="text-sm text-gray-900 font-medium">{profile.full_name}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                            <span className="text-xs text-gray-500">Role</span>
                            <span className="text-sm text-gray-900 font-medium uppercase">{profile.role}</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-xs text-gray-500">Perusahaan</span>
                            <span className="text-sm text-gray-900 font-medium">{profile.company_name}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">
                            Email dan nama hanya dapat diubah oleh admin.
                        </p>
                    </div>
                )}
            </div>

            {/* Change Password Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-gray-400">lock</span>
                    Ubah Password
                </h2>

                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Password Saat Ini</label>
                        <input
                            type="password"
                            value={currentPw}
                            onChange={(e) => setCurrentPw(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                            required
                            autoComplete="current-password"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Password Baru</label>
                        <input
                            type="password"
                            value={newPw}
                            onChange={(e) => setNewPw(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                            required
                            minLength={8}
                            autoComplete="new-password"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Minimal 8 karakter</p>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Konfirmasi Password Baru</label>
                        <input
                            type="password"
                            value={confirmPw}
                            onChange={(e) => setConfirmPw(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                            required
                            minLength={8}
                            autoComplete="new-password"
                        />
                    </div>
                    {pwMessage && (
                        <p className={`text-xs ${pwMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                            {pwMessage.text}
                        </p>
                    )}
                    <Button type="submit" size="sm" disabled={pwLoading}>
                        {pwLoading ? "Menyimpan..." : "Ubah Password"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
