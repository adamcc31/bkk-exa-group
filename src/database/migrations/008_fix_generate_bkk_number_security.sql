-- ============================================
-- Migration 008 — Fix generate_bkk_number Security Guard
--
-- ROOT CAUSE (Temuan Otorisasi):
--   generate_bkk_number menggunakan SECURITY DEFINER, menerima p_company_id,
--   dan dapat dipanggil secara bebas dengan argument company_id milik tenant lain.
--   Hal ini membocorkan short_code dan count transaksi tenant lain.
--
-- FIX:
--   Tambahkan check di dalam fungsi: jika user bukan 'admin' dan mencoba
--   meminta nomor dokumen untuk company_id yang berbeda dengan active_company_id()
--   dari sesi mereka, lemparkan SQL exception.
-- ============================================

CREATE OR REPLACE FUNCTION public.generate_bkk_number(p_company_id uuid, p_type character varying)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_short_code VARCHAR;
  v_count INT;
  v_number TEXT;
  v_session_role TEXT;
  v_session_active_co UUID;
BEGIN
  -- 1. Validasi Sesi (Security Guard)
  v_session_role := public.user_role();
  v_session_active_co := public.active_company_id();

  IF v_session_role != 'admin' AND p_company_id != v_session_active_co THEN
    RAISE EXCEPTION 'Access Denied: Tidak dapat generate nomor dokumen untuk tenant lain. Sesi: %, Target: %', 
      v_session_active_co, p_company_id;
  END IF;

  -- 2. Lock company row to serialize number generation for this company
  PERFORM 1 FROM companies WHERE id = p_company_id FOR UPDATE;

  -- 3. Get company short code
  SELECT short_code INTO v_short_code
  FROM companies
  WHERE id = p_company_id;

  IF v_short_code IS NULL THEN
    RAISE EXCEPTION 'Company not found: %', p_company_id;
  END IF;

  -- 4. Count existing transactions for this company + type
  SELECT COUNT(*) INTO v_count
  FROM transactions
  WHERE company_id = p_company_id
    AND type = p_type
    AND is_deleted = false;

  -- Format: SHORT_CODE TYPE SEQ (3-digit padded)
  v_number := v_short_code || ' ' || p_type || ' ' || LPAD((v_count + 1)::TEXT, 3, '0');

  RETURN v_number;
END;
$function$;
