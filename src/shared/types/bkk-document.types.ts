// ============================================
// BKK Document Shared Types
// ============================================

export interface BkkDocumentHeader {
    company_name: string;
    transaction_type: string; // "BKK" or "BKM"
    doc_number: string;
    payment_type: string; // "BANK" or "CASH"
    transaction_date: string;
}

export interface BkkDocumentInfo {
    paid_to: string;
    division: string;
    department: string;
    total_amount: number;
    purpose: string;
}

export interface BkkDocumentRow {
    no: number;
    description: string;
    account_code: string;
    amount: number;
}

export interface BkkDocumentSignatories {
    received_by: string;
    paid_by: string;
    approved_by: string;
}

export interface StandardizedBkkData {
    header: BkkDocumentHeader;
    info: BkkDocumentInfo;
    rows: BkkDocumentRow[];
    signatories: BkkDocumentSignatories;
}
