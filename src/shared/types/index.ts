// ============================================
// Shared Domain Types — BKK Automatic V3
// ============================================

// ---- Enums ----

export type UserRole = "admin" | "finance" | "staff";

export type TransactionType = "BKM" | "BKK";

export type PaymentType = "CASH" | "BANK";

export type TransactionStatus = "draft" | "printed" | "submitted" | "approved";

export type AiJobStatus =
    | "pending"
    | "queued"
    | "processing"
    | "completed"
    | "failed";

export type DocumentType = "BPN" | "BANK_TRANSFER" | "TIDAK_DIKENALI";

// ---- Core Entities ----

export interface Company {
    id: string;
    name: string;
    short_code: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Role {
    id: string;
    name: UserRole;
    permissions: string[];
    created_at: string;
}

export interface User {
    id: string;
    company_id: string;
    role_id: string;
    email: string;
    full_name: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    created_by: string | null;
    // Joined
    role?: Role;
    company?: Company;
}

export interface Transaction {
    id: string;
    company_id: string;
    created_by: string;
    type: TransactionType;
    payment_type: PaymentType;
    transaction_date: string;
    total_amount: number;
    purpose: string;
    division: string;
    department: string;
    paid_to_name: string;
    bkk_number: string;
    received_by: string;
    paid_by: string;
    approved_by: string;
    note: string | null;
    status: TransactionStatus;
    is_deleted: boolean;
    created_at: string;
    updated_at: string;
    // Joined
    items?: TransactionItem[];
    creator?: User;
}

export interface TransactionItem {
    id: string;
    transaction_id: string;
    item_order: number;
    description: string;
    account_code: string;
    amount: number;
}

export interface AiProcessingJob {
    id: string;
    company_id: string;
    initiated_by: string;
    status: AiJobStatus;
    document_type: DocumentType | null;
    original_filename: string;
    file_path: string;
    raw_ai_output: Record<string, unknown> | null;
    standardized_data: StandardizedBkkData | null;
    total_amount: number | null;
    error_message: string | null;
    trace_id: string;
    fallback_log: Record<string, unknown>[] | null;
    queued_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface PdfArtifact {
    id: string;
    transaction_id: string;
    file_path: string;
    render_engine: "react-pdf";
    generated_at: string;
}

export interface AuditLog {
    id: string;
    company_id: string;
    user_id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
    ip_address: string | null;
    created_at: string;
}

// ---- BKK Standardized Data (AI Output) ----

export interface StandardizedBkkData {
    header: {
        company_name: string;
        transaction_type: string; // "BKK" or "BKM"
        doc_number: string; // e.g. "SREI BKK 001"
        payment_type: string; // "BANK" or "CASH"
        transaction_date: string;
    };
    info: {
        paid_to: string;
        division: string;
        department: string;
        total_amount: number;
        purpose: string;
    };
    rows: Array<{
        no: number;
        description: string;
        account_code: string;
        amount: number;
    }>;
    signatories: {
        received_by: string;
        paid_by: string;
        approved_by: string;
    };
}

// ---- API Response ----

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
    meta?: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

// ---- Auth Context ----

export interface AuthSession {
    user: User;
    activeCompanyId: string;
    role: UserRole;
}
