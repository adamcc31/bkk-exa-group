// ============================================
// Shared UI: StatCard Component
// ============================================

import type { ReactNode } from "react";

interface StatCardProps {
    icon: string;
    iconBgClass?: string;
    iconColorClass?: string;
    label: string;
    value: string;
    trend?: {
        value: string;
        direction: "up" | "down" | "neutral";
    };
    variant?: "default" | "highlight";
    bottomBarColor?: string;
}

export function StatCard({
    icon,
    iconBgClass = "bg-blue-50",
    iconColorClass = "text-[var(--color-primary)]",
    label,
    value,
    trend,
    variant = "default",
    bottomBarColor = "from-blue-400 to-blue-600",
}: StatCardProps) {
    const isHighlight = variant === "highlight";

    return (
        <div
            className={`
        overflow-hidden rounded-2xl border relative group
        hover:shadow-lg transition-all duration-300
        ${isHighlight
                    ? "bg-[var(--color-primary)] border-transparent"
                    : "bg-white border-gray-100"
                }
      `}
            style={{ boxShadow: "var(--shadow-soft)" }}
        >
            {isHighlight && (
                <>
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10 blur-xl" />
                    <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 rounded-full bg-white opacity-10 blur-xl" />
                </>
            )}

            <div className={`p-5 ${isHighlight ? "relative z-10" : ""}`}>
                <div className="flex items-center justify-between mb-4">
                    <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${isHighlight ? "bg-white/20 text-white" : `${iconBgClass} ${iconColorClass}`
                            }`}
                    >
                        <span className="material-symbols-outlined">{icon}</span>
                    </div>
                    {trend && (
                        <TrendBadge
                            value={trend.value}
                            direction={trend.direction}
                            isHighlight={isHighlight}
                        />
                    )}
                </div>

                <dt
                    className={`text-sm font-medium truncate ${isHighlight ? "text-blue-100" : "text-[var(--color-text-secondary-light)]"
                        }`}
                >
                    {label}
                </dt>
                <dd
                    className={`mt-1 text-2xl font-bold ${isHighlight ? "text-white" : "text-gray-900"
                        }`}
                >
                    {value}
                </dd>
            </div>

            {!isHighlight && (
                <div
                    className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r ${bottomBarColor} opacity-0 group-hover:opacity-100 transition-opacity`}
                />
            )}
        </div>
    );
}

function TrendBadge({
    value,
    direction,
    isHighlight,
}: {
    value: string;
    direction: "up" | "down" | "neutral";
    isHighlight: boolean;
}) {
    const colors = isHighlight
        ? "bg-white/20 text-white"
        : direction === "up"
            ? "bg-green-100 text-green-700"
            : direction === "down"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-600";

    const arrowIcon =
        direction === "up"
            ? "arrow_upward"
            : direction === "down"
                ? "arrow_downward"
                : "";

    return (
        <span
            className={`text-xs font-medium px-2 py-1 rounded-full flex items-center ${colors}`}
        >
            {value}
            {arrowIcon && (
                <span className="material-symbols-outlined text-[10px] ml-0.5">
                    {arrowIcon}
                </span>
            )}
        </span>
    );
}
