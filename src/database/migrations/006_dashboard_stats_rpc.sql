-- ============================================
-- Migration 006 — Dashboard Stats RPC (DB-level aggregation)
-- Single query replaces 3 separate JS-side queries
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
