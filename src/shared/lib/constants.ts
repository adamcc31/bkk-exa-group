// ============================================
// Application Constants — BKK Automatic V3
// ============================================

import type { UserRole } from "@/shared/types";

// ---- Companies (seed reference) ----

export const COMPANIES = [
    { name: "PT. SUMBER REZEKI EXATA INDONESIA", short_code: "SREI" },
    { name: "PT. EXATA SOLUSI KREATIF", short_code: "ESK" },
    { name: "PT. YANOSHI JAPAN OMIYAGE", short_code: "YJO" },
    { name: "PT. JAPAN INDO TRAVEL CONNECTION", short_code: "JITC" },
    { name: "PT PUSAT REKRUTMEN INDONESIA JEPANG", short_code: "PRIJ" },
] as const;

// ---- RBAC Permission Matrix ----

export const PERMISSIONS = {
    USER_CREATE: "user.create",
    USER_READ: "user.read",
    USER_UPDATE: "user.update",
    USER_DELETE: "user.delete",
    COMPANY_SWITCH: "company.switch",
    COMPANY_READ: "company.read",
    TRANSACTION_CREATE: "transaction.create",
    TRANSACTION_READ: "transaction.read",
    TRANSACTION_UPDATE: "transaction.update",
    TRANSACTION_DELETE: "transaction.delete",
    TRANSACTION_EXPORT_CSV: "transaction.export_csv",
    TRANSACTION_EXPORT_PDF: "transaction.export_pdf",
    AI_PARSE_UPLOAD: "ai_parse.upload",
    AI_PARSE_VIEW_JOBS: "ai_parse.view_jobs",
    MONITORING_VIEW: "monitoring.view",
    AUDIT_VIEW: "audit.view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    admin: Object.values(PERMISSIONS),
    finance: [
        PERMISSIONS.COMPANY_SWITCH,
        PERMISSIONS.COMPANY_READ,
        PERMISSIONS.TRANSACTION_READ,
        PERMISSIONS.TRANSACTION_EXPORT_CSV,
        PERMISSIONS.TRANSACTION_EXPORT_PDF,
        PERMISSIONS.AI_PARSE_UPLOAD,
        PERMISSIONS.AI_PARSE_VIEW_JOBS,
        PERMISSIONS.MONITORING_VIEW,
    ],
    staff: [
        PERMISSIONS.COMPANY_READ,
        PERMISSIONS.TRANSACTION_CREATE,
        PERMISSIONS.TRANSACTION_READ,
        PERMISSIONS.TRANSACTION_UPDATE,
        PERMISSIONS.TRANSACTION_DELETE,
        PERMISSIONS.TRANSACTION_EXPORT_PDF,
    ],
};

// ---- Form Options ----

export const TRANSACTION_TYPES = [
    { value: "BKK", label: "BUKTI KAS KELUAR (BKK)" },
    { value: "BKM", label: "BUKTI KAS MASUK (BKM)" },
] as const;

export const PAYMENT_TYPES = [
    { value: "CASH", label: "CASH" },
    { value: "BANK", label: "BANK TRANSFER" },
] as const;

export const DIVISIONS = [
    "FINANCE",
    "HR & GA",
    "OPERATIONS",
    "IT",
    "ACCOUNTING",
    "ASISTEN UMUM",
    "DIREKTUR",
    "INTERNSHIP",
    "LEADER",
    "MULTIMEDIA",
    "PRODUKSI",
    "SALES",
    "HAPPY SERVICE",
] as const;

export const DEPARTMENTS = [
    "GENERAL",
] as const;

export const PAID_BY_OPTIONS = [
    "BU NURUL",
    "PAK NOVI",
    "BU SABRINA",
    "MBA RINA",
] as const;

export const APPROVED_BY_OPTIONS = [
    "PAK NOVI",
] as const;

// ---- AI Parser ----

export const AI_CONFIG = {
    MODEL: "gemini-2.5-flash-lite",
    MAX_CONCURRENT_WORKERS: 3,
    MAX_BATCH_SIZE: 20,
    PER_FILE_TIMEOUT_MS: 30_000,
    MAX_RETRIES: 2,
    POLLING_INTERVAL_MS: 3_000,
    IMAGE_MAX_DIMENSION: 1600,
    IMAGE_JPEG_QUALITY: 0.8,
} as const;

// ---- PDF Specs (from SSOT) ----

export const PDF_SPECS = {
    // 13cm x 9cm in points (1cm = 28.35pt) — landscape
    PAGE_WIDTH: 369,
    PAGE_HEIGHT: 255,
    MARGIN: 4, // nearly marginless
    BORDER_WIDTH: 0.75,
    ROW_HEIGHT: 14,
    MAX_DATA_ROWS: 6,
    SIGNATORY_HEIGHT: 45,
    GRID_RATIOS: {
        NO: "8%",
        DESCRIPTION: "52%",
        ACCOUNT_CODE: "14%",
        AMOUNT: "26%",
    },
    DESCRIPTION_MAX_CHARS: 55,
    DESCRIPTION_TRUNCATE_AT: 52,
} as const;
