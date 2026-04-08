// ============================================
// FilterBar Component
// ============================================

"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";

export interface FilterField {
    key: string;
    label: string;
    type: "select" | "date" | "text";
    options?: { value: string; label: string }[];
    placeholder?: string;
}

interface FilterBarProps {
    fields: FilterField[];
    onApply: (filters: Record<string, string>) => void;
    onReset: () => void;
}

export function FilterBar({ fields, onApply, onReset }: FilterBarProps) {
    const [values, setValues] = useState<Record<string, string>>({});

    function handleChange(key: string, value: string) {
        setValues((prev) => ({ ...prev, [key]: value }));
    }

    function handleApply() {
        const nonEmpty = Object.fromEntries(
            Object.entries(values).filter(([, v]) => v !== "")
        );
        onApply(nonEmpty);
    }

    function handleReset() {
        setValues({});
        onReset();
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex items-center gap-4 flex-wrap">
                {fields.map((field) => (
                    <div key={field.key} className="flex-1 min-w-[140px] max-w-[200px]">
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                            {field.label}
                        </label>
                        {field.type === "select" ? (
                            <select
                                value={values[field.key] ?? ""}
                                onChange={(e) => handleChange(field.key, e.target.value)}
                                className="block w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                            >
                                <option value="">Semua</option>
                                {field.options?.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        ) : field.type === "date" ? (
                            <input
                                type="date"
                                value={values[field.key] ?? ""}
                                onChange={(e) => handleChange(field.key, e.target.value)}
                                className="block w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                            />
                        ) : (
                            <input
                                type="text"
                                value={values[field.key] ?? ""}
                                onChange={(e) => handleChange(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                className="block w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                            />
                        )}
                    </div>
                ))}

                <div className="flex items-end gap-2 pt-4">
                    <Button size="sm" onClick={handleApply}>
                        Terapkan
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleReset}>
                        Reset
                    </Button>
                </div>
            </div>
        </div>
    );
}
