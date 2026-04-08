-- ============================================
-- Migration 003: Auto-generate BKK/BKM number
-- Run this in Supabase SQL Editor
-- ============================================

-- Function to generate sequential document numbers
-- Format: [COMPANY_SHORT_CODE] [BKK/BKM] [SEQ_PADDED_3]
-- Example: SREI BKK 001, ESK BKM 002
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
