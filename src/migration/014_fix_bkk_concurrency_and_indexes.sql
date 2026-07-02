-- ============================================
-- Migration 014 — Fix BKK Concurrency & Indexes
-- ============================================

-- 1. Deduplicate any existing duplicate active BKK numbers (per company + type + bkk_number)
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER(PARTITION BY company_id, type, bkk_number ORDER BY created_at) as rn
  FROM transactions
  WHERE is_deleted = false AND bkk_number <> ''
)
UPDATE transactions t
SET bkk_number = t.bkk_number || '_DUP_' || (d.rn - 1)
FROM duplicates d
WHERE t.id = d.id AND d.rn > 1;

-- 2. Create partial unique index to enforce uniqueness of active BKK/BKM numbers per company + type
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_bkk_number 
  ON transactions (company_id, bkk_number, type) 
  WHERE (is_deleted = false AND bkk_number <> '');

-- 3. Create partial index to speed up transactions queries filtering by active status
CREATE INDEX IF NOT EXISTS idx_transactions_active 
  ON transactions (company_id, transaction_date) 
  WHERE (is_deleted = false);

-- 4. Re-create the generate_bkk_number function with locking
CREATE OR REPLACE FUNCTION generate_bkk_number(
  p_company_id UUID,
  p_type VARCHAR
)
RETURNS TEXT AS $$
DECLARE
  v_short_code VARCHAR;
  v_count INT;
  v_number TEXT;
BEGIN
  -- Lock company row to serialize number generation for this company
  PERFORM 1 FROM companies WHERE id = p_company_id FOR UPDATE;

  -- Get company short code
  SELECT short_code INTO v_short_code
  FROM companies
  WHERE id = p_company_id;

  IF v_short_code IS NULL THEN
    RAISE EXCEPTION 'Company not found: %', p_company_id;
  END IF;

  -- Count existing transactions for this company + type
  SELECT COUNT(*) INTO v_count
  FROM transactions
  WHERE company_id = p_company_id
    AND type = p_type
    AND is_deleted = false;

  -- Format: SHORT_CODE TYPE SEQ (3-digit padded)
  v_number := v_short_code || ' ' || p_type || ' ' || LPAD((v_count + 1)::TEXT, 3, '0');

  RETURN v_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
