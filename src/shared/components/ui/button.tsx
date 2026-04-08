// ============================================
// Shared UI: Button Component
// ============================================

import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: ReactNode;
    loading?: boolean;
    children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary:
        "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] shadow-sm",
    secondary:
        "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm",
    ghost: "text-[var(--color-primary)] hover:bg-blue-50",
    danger: "bg-[var(--color-accent-red)] text-white hover:bg-red-600 shadow-sm",
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-sm",
};

export function Button({
    variant = "primary",
    size = "md",
    icon,
    loading,
    children,
    className = "",
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            className={`
        inline-flex items-center justify-center font-medium rounded-lg
        transition-all duration-150
        disabled:opacity-60 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <span className="material-symbols-outlined text-base mr-2 animate-spin">
                    progress_activity
                </span>
            ) : icon ? (
                <span className="mr-2">{icon}</span>
            ) : null}
            {children}
        </button>
    );
}
