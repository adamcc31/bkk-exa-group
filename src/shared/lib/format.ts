// ============================================
// Formatters — BKK Automatic V3
// ============================================

/**
 * Format number as Indonesian Rupiah currency.
 * e.g. 1500000 → "1,500,000"
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Format number with "Rp" prefix.
 * e.g. 1500000 → "Rp 1,500,000"
 */
export function formatRupiah(amount: number): string {
    return `Rp ${formatCurrency(amount)}`;
}

/**
 * Format date string to Indonesian locale.
 * e.g. "2026-02-13" → "13/02/2026"
 */
export function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

/**
 * Format date to long Indonesian format.
 * e.g. "2026-02-13" → "13 Februari 2026"
 */
export function formatDateLong(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

/**
 * Truncate text per SSOT spec.
 * If > maxChars, truncate to truncateAt and append "..."
 */
export function truncateDescription(
    text: string,
    maxChars: number = 55,
    truncateAt: number = 52
): string {
    if (text.length <= maxChars) return text;
    return text.slice(0, truncateAt) + "...";
}

/**
 * Convert nominal to spelled-out Indonesian text (terbilang).
 * e.g. 13296000 → "Tiga Belas Juta Dua Ratus Sembilan Puluh Enam Ribu Rupiah"
 */
export function terbilang(n: number): string {
    if (n === 0) return "Nol Rupiah";

    const units = [
        "", "Satu", "Dua", "Tiga", "Empat", "Lima",
        "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas",
    ];

    function convert(num: number): string {
        if (num < 12) return units[num] ?? "";
        if (num < 20) return convert(num - 10) + " Belas";
        if (num < 100)
            return convert(Math.floor(num / 10)) + " Puluh" + (num % 10 ? " " + convert(num % 10) : "");
        if (num < 200)
            return "Seratus" + (num - 100 ? " " + convert(num - 100) : "");
        if (num < 1000)
            return convert(Math.floor(num / 100)) + " Ratus" + (num % 100 ? " " + convert(num % 100) : "");
        if (num < 2000)
            return "Seribu" + (num - 1000 ? " " + convert(num - 1000) : "");
        if (num < 1_000_000)
            return convert(Math.floor(num / 1000)) + " Ribu" + (num % 1000 ? " " + convert(num % 1000) : "");
        if (num < 1_000_000_000)
            return convert(Math.floor(num / 1_000_000)) + " Juta" + (num % 1_000_000 ? " " + convert(num % 1_000_000) : "");
        if (num < 1_000_000_000_000)
            return convert(Math.floor(num / 1_000_000_000)) + " Miliar" + (num % 1_000_000_000 ? " " + convert(num % 1_000_000_000) : "");
        return convert(Math.floor(num / 1_000_000_000_000)) + " Triliun" + (num % 1_000_000_000_000 ? " " + convert(num % 1_000_000_000_000) : "");
    }

    return convert(Math.round(n)) + " Rupiah";
}

/**
 * Generate a short trace ID for AI processing jobs.
 */
export function generateTraceId(): string {
    return `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
