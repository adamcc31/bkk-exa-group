// ============================================
// Shared UI: Badge Component
// ============================================

import type { ReactNode } from "react";

type BadgeVariant =
    | "default"
    | "primary"
    | "success"
    | "warning"
    | "danger"
    | "info";

interface BadgeProps {
    variant?: BadgeVariant;
    children: ReactNode;
    className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    default: "bg-gray-100 text-gray-800 border-gray-200",
    primary: "bg-blue-100 text-blue-800 border-blue-200",
    success: "bg-green-100 text-green-800 border-green-200",
    warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    danger: "bg-red-100 text-red-800 border-red-200",
    info: "bg-purple-100 text-purple-800 border-purple-200",
};

export function Badge({
    variant = "default",
    children,
    className = "",
}: BadgeProps) {
    return (
        <span
            className={`
        px-2 py-0.5 inline-flex text-xs leading-5 font-semibold
        rounded-full border
        ${variantStyles[variant]}
        ${className}
      `}
        >
            {children}
        </span>
    );
}
