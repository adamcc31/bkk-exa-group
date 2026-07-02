-- ============================================
-- Migration 007 — Fix get_dashboard_stats: SECURITY DEFINER → SECURITY INVOKER
--
-- ROOT CAUSE (Bug A):
--   SECURITY DEFINER menyebabkan fungsi berjalan sebagai pemilik fungsi (admin/postgres),
--   bukan sebagai app_runtime. RLS policy transactions_select di-bypass,
--   sehingga staff melihat aggregate seluruh perusahaan bukan hanya miliknya.
--
-- FIX:
--   1. Ganti SECURITY DEFINER → SECURITY INVOKER: fungsi berjalan sebagai caller (app_runtime),
--      RLS policy transactions_select aktif kembali saat SELECT dari transactions.
--   2. Tidak perlu filter manual created_by di query: RLS sudah handle itu.
--   3. p_company_id filter tetap dipertahankan (defense in depth untuk admin/finance).
--
-- IMPLIKASI PER ROLE (setelah fix):
--   - admin  : RLS → company_id = active_company_id()  → aggregate 1 company (sesuai)
--   - finance : RLS → company_id = active_company_id() → aggregate 1 company (sesuai)
--   - staff  : RLS → created_by = current_user_id() AND company_id = own_company_id()
--              → aggregate HANYA transaksi milik staff itu (fix bug A)
--
-- DEPLOYMENT: Jalankan langsung via Railway psql atau migration runner.
--             Tidak ada downtime — CREATE OR REPLACE bersifat atomic.
-- ============================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(
    p_company_id UUID,
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
    total_bkm DECIMAL(18,2),
    total_bkk DECIMAL(18,2),
    total_transactions BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN t.type = 'BKM' THEN t.total_amount ELSE 0 END), 0) AS total_bkm,
        COALESCE(SUM(CASE WHEN t.type = 'BKK' THEN t.total_amount ELSE 0 END), 0) AS total_bkk,
        COUNT(*)::BIGINT AS total_transactions
    FROM transactions t
    WHERE t.company_id = p_company_id
      AND t.is_deleted = false
      AND (p_date_from IS NULL OR t.transaction_date >= p_date_from)
      AND (p_date_to IS NULL OR t.transaction_date <= p_date_to);
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;
-- ^^^^^^^^^^^^^^^^^^^ CHANGED: SECURITY DEFINER → SECURITY INVOKER
-- RLS policy transactions_select sekarang diterapkan saat fungsi ini berjalan.
-- Staff hanya melihat aggregate transaksi milik mereka sendiri.
