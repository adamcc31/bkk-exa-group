// ============================================
// Navbar Component — Top Bar with Company Switcher
// ============================================

"use client";

import { useState, useRef, useEffect } from "react";
import type { Company, UserRole } from "@/shared/types";
import { hasPermission } from "@/shared/lib/permissions";
import { PERMISSIONS } from "@/shared/lib/constants";

interface NavbarProps {
    companies: Company[];
    activeCompanyId: string;
    role: UserRole;
    onCompanySwitch: (companyId: string) => void;
    onLogout: () => void;
}

export function Navbar({
    companies,
    activeCompanyId,
    role,
    onCompanySwitch,
    onLogout,
}: NavbarProps) {
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const activeCompany = companies.find((c) => c.id === activeCompanyId);
    const canSwitch = hasPermission(role, PERMISSIONS.COMPANY_SWITCH);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-20">
            {/* Left — Page context */}
            <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-900">
                    {activeCompany?.name ?? "—"}
                </span>
            </div>

            {/* Right — Actions */}
            <div className="flex items-center gap-3">
                {/* Company Switcher */}
                {canSwitch && companies.length > 1 && (
                    <div className="relative" ref={dropdownRef}>
                        <button
                            id="company-switcher"
                            onClick={() => setShowDropdown(!showDropdown)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-[var(--color-primary)] hover:bg-blue-100 transition-colors"
                        >
                            <span className="material-symbols-outlined text-base">
                                swap_horiz
                            </span>
                            {activeCompany?.short_code ?? "—"}
                            <span className="material-symbols-outlined text-sm">
                                expand_more
                            </span>
                        </button>

                        {showDropdown && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50">
                                <div className="px-3 py-2 border-b border-gray-100">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                        Pindah Perusahaan
                                    </p>
                                </div>
                                {companies.map((company) => (
                                    <button
                                        key={company.id}
                                        onClick={() => {
                                            onCompanySwitch(company.id);
                                            setShowDropdown(false);
                                        }}
                                        className={`
                      w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm
                      transition-colors hover:bg-gray-50
                      ${company.id === activeCompanyId ? "bg-blue-50" : ""}
                    `}
                                    >
                                        <div
                                            className={`
                        w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold
                        ${company.id === activeCompanyId
                                                    ? "bg-[var(--color-primary)] text-white"
                                                    : "bg-gray-100 text-gray-500"
                                                }
                      `}
                                        >
                                            {company.short_code[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {company.name}
                                            </p>
                                            <p className="text-[10px] text-gray-400">
                                                {company.short_code}
                                            </p>
                                        </div>
                                        {company.id === activeCompanyId && (
                                            <span className="material-symbols-outlined text-[var(--color-primary)] text-base">
                                                check_circle
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Logout */}
                <button
                    id="logout-btn"
                    onClick={onLogout}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                    <span className="material-symbols-outlined text-base">logout</span>
                    Keluar
                </button>
            </div>
        </header>
    );
}
