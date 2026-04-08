// ============================================
// Sidebar Component — Dashboard Navigation
// ============================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/shared/types";
import { hasPermission } from "@/shared/lib/permissions";
import { PERMISSIONS } from "@/shared/lib/constants";

interface NavItem {
    href: string;
    label: string;
    icon: string;
    permission?: string;
}

const NAV_ITEMS: NavItem[] = [
    { href: "/transactions", label: "Transaksi", icon: "receipt_long" },
    { href: "/ai-parser", label: "AI Parser", icon: "smart_toy", permission: PERMISSIONS.AI_PARSE_UPLOAD },
    {
        href: "/reports",
        label: "Laporan",
        icon: "bar_chart",
        permission: PERMISSIONS.MONITORING_VIEW,
    },
    {
        href: "/admin/users",
        label: "Pengguna",
        icon: "group",
        permission: PERMISSIONS.USER_READ,
    },
    {
        href: "/admin/audit",
        label: "Audit Trail",
        icon: "history",
        permission: PERMISSIONS.AUDIT_VIEW,
    },
];

interface SidebarProps {
    role: UserRole;
    userName: string;
    companyShortCode: string;
}

export function Sidebar({ role, userName, companyShortCode }: SidebarProps) {
    const pathname = usePathname();

    const visibleItems = NAV_ITEMS.filter(
        (item) =>
            !item.permission ||
            hasPermission(role, item.permission as typeof PERMISSIONS[keyof typeof PERMISSIONS])
    );

    return (
        <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col z-30">
            {/* Brand */}
            <div className="h-16 flex items-center px-6 border-b border-gray-100">
                <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm mr-3"
                    style={{ backgroundColor: "var(--color-primary)" }}
                >
                    E
                </div>
                <div>
                    <p className="text-sm font-bold text-gray-900 leading-none">EXATA GROUP</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                        {companyShortCode}
                    </p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {visibleItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150
                ${isActive
                                    ? "bg-blue-50 text-[var(--color-primary)]"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                }
              `}
                        >
                            <span
                                className="material-symbols-outlined text-xl"
                                style={isActive ? { fontVariationSettings: '"FILL" 1' } : {}}
                            >
                                {item.icon}
                            </span>
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* User */}
            <div className="p-4 border-t border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                        {userName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                            {userName}
                        </p>
                        <p className="text-[10px] text-gray-400 uppercase">{role}</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
