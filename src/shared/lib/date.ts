// ============================================
// Date Utilities — Timezone-safe (Asia/Jakarta)
// Uses date-fns + date-fns-tz
// ============================================

import { format, startOfMonth, endOfMonth } from "date-fns";
import { toZonedTime } from "date-fns-tz";

/** Business timezone — source of truth for all date calculations */
const BUSINESS_TZ = "Asia/Jakarta";

/**
 * Get "now" in Asia/Jakarta (WIB), regardless of server/client runtime timezone.
 */
export function nowWIB(): Date {
    return toZonedTime(new Date(), BUSINESS_TZ);
}

/**
 * Format Date as YYYY-MM-DD string.
 */
export function toDateString(date: Date): string {
    return format(date, "yyyy-MM-dd");
}

/**
 * Default date range for dashboard analytics.
 * Returns 1st of current month to end of current month in WIB.
 */
export function getDefaultDateRange(): {
    dateFrom: string;
    dateTo: string;
} {
    const now = nowWIB();
    return {
        dateFrom: toDateString(startOfMonth(now)),
        dateTo: toDateString(endOfMonth(now)),
    };
}
