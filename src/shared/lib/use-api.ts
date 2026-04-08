// ============================================
// useApiRequest — Fetch hook with key-based AbortController
// Cancels in-flight requests per unique endpoint key
// ============================================

"use client";

import { useCallback, useRef, useState } from "react";
import type { ApiResponse } from "@/shared/types";

/**
 * Custom hook for API requests with:
 * - Key-based AbortController (per pathname, not global)
 * - Loading + error state
 * - Auto-cancel on duplicate requests to same endpoint
 */
export function useApiRequest<T>() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const controllersRef = useRef<Map<string, AbortController>>(new Map());

    const execute = useCallback(
        async (
            url: string,
            options?: RequestInit
        ): Promise<ApiResponse<T> | null> => {
            // Derive key from URL pathname (ignoring query params for identity)
            const key = new URL(url, "http://localhost").pathname;

            // Cancel previous request with same key
            controllersRef.current.get(key)?.abort();
            const controller = new AbortController();
            controllersRef.current.set(key, controller);

            setLoading(true);
            setError(null);

            try {
                const res = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                });
                const data: ApiResponse<T> = await res.json();
                if (!data.success) {
                    setError(data.error?.message ?? "Terjadi kesalahan");
                }
                return data;
            } catch (err: unknown) {
                if (
                    err instanceof DOMException &&
                    err.name === "AbortError"
                ) {
                    return null; // Silently ignore aborted requests
                }
                setError("Gagal menghubungi server");
                return null;
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                    controllersRef.current.delete(key);
                }
            }
        },
        []
    );

    const cancel = useCallback((url?: string) => {
        if (url) {
            const key = new URL(url, "http://localhost").pathname;
            controllersRef.current.get(key)?.abort();
            controllersRef.current.delete(key);
        } else {
            // Cancel all in-flight requests
            controllersRef.current.forEach((c) => c.abort());
            controllersRef.current.clear();
        }
    }, []);

    return { execute, cancel, loading, error, setError };
}
