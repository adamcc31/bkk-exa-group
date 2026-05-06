-- ==============================================================================
-- RLS SECURITY VERIFICATION SCRIPT
-- ==============================================================================
-- Run this as superuser (postgres) to verify app_runtime restrictions.
-- Usage: psql -f scripts/verify-rls.sql

-- 1. Verifikasi role yang digunakan BUKAN superuser
-- Note: When running via npm, we expect current_user to be app_runtime
SELECT current_user AS "Current Role", 
       rolsuper AS "Is Superuser", 
       rolbypassrls AS "Can Bypass RLS" 
FROM pg_roles WHERE rolname = current_user;

-- 2. Verifikasi semua tabel punya RLS aktif dan FORCE
SELECT tablename, rowsecurity AS "RLS Enabled", forcerowsecurity AS "RLS Forced" 
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('transactions', 'transaction_items', 'users', 'auth_users', 'companies')
ORDER BY tablename;

-- 3. Verifikasi semua policy punya WITH CHECK
SELECT tablename, policyname, cmd, 
  CASE WHEN with_check IS NULL THEN '⚠️ MISSING WITH CHECK' ELSE '✅ OK' END AS status
FROM pg_policies 
WHERE schemaname = 'public'
  AND cmd IN ('ALL', 'INSERT', 'UPDATE')
ORDER BY tablename;

-- 4. Test isolasi: user dari company A tidak bisa lihat data company B
-- Menggunakan UUID dummy dari seed data awal
DO $$
DECLARE
    v_user_a UUID := '00000000-0000-0000-0000-00000000000a'; -- Ganti dengan ID user asli Anda
    v_company_a UUID := 'a1000000-0000-0000-0000-000000000001';
    v_company_b UUID := 'a1000000-0000-0000-0000-000000000002';
    v_count INT;
BEGIN
    -- Masuk ke mode app_runtime
    PERFORM set_config('role', 'app_runtime', true);
    
    -- Set context untuk User A (Company A)
    -- Menggunakan nama variabel sesuai 003_rls_functions.sql
    PERFORM set_config('app.current_user_id', v_user_a::text, true);
    PERFORM set_config('app.user_role', 'staff', true);
    PERFORM set_config('app.own_company_id', v_company_a::text, true);
    PERFORM set_config('app.active_company_id', v_company_a::text, true);
    
    -- Hitung data Company B yang terlihat oleh User A
    SELECT COUNT(*) INTO v_count FROM public.transactions WHERE company_id = v_company_b;
    
    IF v_count > 0 THEN
        RAISE EXCEPTION 'RLS FAILURE: User A saw % rows from Company B', v_count;
    ELSE
        RAISE NOTICE 'RLS SUCCESS: User A cannot see data from Company B';
    END IF;
END $$;

-- 5. Test tanpa context: harus 0 rows di semua tabel
DO $$
DECLARE
    v_count INT;
BEGIN
    PERFORM set_config('role', 'app_runtime', true);
    PERFORM set_config('app.current_user_id', '', true);
    
    SELECT COUNT(*) INTO v_count FROM public.transactions;
    IF v_count > 0 THEN RAISE EXCEPTION 'RLS FAILURE: Data visible without context in transactions'; END IF;
    
    SELECT COUNT(*) INTO v_count FROM public.users;
    IF v_count > 0 THEN RAISE EXCEPTION 'RLS FAILURE: Data visible without context in users'; END IF;
    
    RAISE NOTICE 'RLS SUCCESS: No data visible without context';
END $$;

-- 6. Test INSERT ke company lain harus ditolak
DO $$
DECLARE
    v_user_a UUID := '00000000-0000-0000-0000-00000000000a';
    v_company_a UUID := 'a1000000-0000-0000-0000-000000000001';
    v_company_b UUID := 'a1000000-0000-0000-0000-000000000002';
BEGIN
    PERFORM set_config('role', 'app_runtime', true);
    PERFORM set_config('app.current_user_id', v_user_a::text, true);
    PERFORM set_config('app.own_company_id', v_company_a::text, true);
    
    BEGIN
        INSERT INTO public.transactions (company_id, created_by, type, purpose, total_amount, status)
        VALUES (v_company_b, v_user_a, 'BKK', 'RLS VIOLATION ATTEMPT', 1000, 'draft');
        
        RAISE EXCEPTION 'RLS FAILURE: Malicious INSERT to company B succeeded!';
    EXCEPTION WHEN check_violation OR insufficient_privilege THEN
        RAISE NOTICE 'RLS SUCCESS: Malicious INSERT prevented by Policy';
    END;
END $$;
