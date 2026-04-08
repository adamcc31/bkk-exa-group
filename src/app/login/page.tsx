// ============================================
// Login Page — BKK Automatic V3
// ============================================

"use client";

import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleLogin(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const supabase = createSupabaseBrowserClient();
        const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }

        router.push("/");
        router.refresh();
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-light)]">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex flex-col items-center mb-8">
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mb-4"
                        style={{
                            backgroundColor: "var(--color-primary)",
                            boxShadow: "var(--shadow-glow)",
                        }}
                    >
                        E
                    </div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-primary-light)]">
                        EXATA
                    </h1>
                    <p className="text-sm text-[var(--color-text-secondary-light)] mt-1">
                        Financial Dashboard
                    </p>
                </div>

                {/* Login Card */}
                <div
                    className="bg-white rounded-2xl p-8 border border-gray-100"
                    style={{ boxShadow: "var(--shadow-soft)" }}
                >
                    <h2 className="text-xl font-bold text-[var(--color-text-primary-light)] mb-6">
                        Masuk ke Akun Anda
                    </h2>

                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-secondary-light)] uppercase tracking-wider mb-2">
                                Email
                            </label>
                            <input
                                id="email-input"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="email@exata.co.id"
                                required
                                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-secondary-light)] uppercase tracking-wider mb-2">
                                Password
                            </label>
                            <input
                                id="password-input"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-colors"
                            />
                        </div>

                        <button
                            id="login-submit"
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{
                                backgroundColor: loading
                                    ? "var(--color-primary-light)"
                                    : "var(--color-primary)",
                                boxShadow: loading
                                    ? "none"
                                    : "0 4px 14px 0 rgba(37, 99, 235, 0.35)",
                            }}
                            onMouseEnter={(e) => {
                                if (!loading)
                                    e.currentTarget.style.backgroundColor =
                                        "var(--color-primary-dark)";
                            }}
                            onMouseLeave={(e) => {
                                if (!loading)
                                    e.currentTarget.style.backgroundColor =
                                        "var(--color-primary)";
                            }}
                        >
                            {loading ? "Memproses..." : "Masuk"}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-[var(--color-text-secondary-light)] mt-6">
                    © 2026 Exata Indonesia. All rights reserved.
                </p>
            </div>
        </div>
    );
}
