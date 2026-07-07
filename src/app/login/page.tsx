// ============================================
// Login Page — BKK Automatic V3 (Post-Supabase)
// ============================================

"use client";

import { useState, type FormEvent } from "react";
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

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Login failed");
            }

            // Success: redirect to dashboard
            router.push("/");
            router.refresh();
        } catch (authError: any) {
            setError(authError.message);
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-light)]">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex flex-col items-center mb-8">
                    <img
                        src="/bkk-logo.svg"
                        alt="BKK Logo"
                        className="w-16 h-16 mb-4"
                        style={{
                            filter: "drop-shadow(0 0 12px rgba(37, 99, 235, 0.35))",
                        }}
                    />
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
