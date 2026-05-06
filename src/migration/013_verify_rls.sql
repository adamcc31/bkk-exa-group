-- ============================================================
-- RLS Verification Script
-- ============================================================

-- INSTRUCTIONS:
-- Run this script to verify that RLS is working correctly.
-- This script should be run by a superuser (postgres).

DO $$
DECLARE
    v_company_a UUID := 'a1000000-0000-0000-0000-000000000001';
    v_company_b UUID := 'a1000000-0000-0000-0000-000000000002';
    v_user_a UUID := '00000000-0000-0000-0000-00000000000a';
    v_user_b UUID := '00000000-0000-0000-0000-00000000000b';
    v_row_count INT;
BEGIN
    RAISE NOTICE '--- STARTING RLS VERIFICATION ---';

    -- 1. Test: No Context (Should return 0 rows)
    SET ROLE app_runtime;
    SELECT count(*) INTO v_row_count FROM public.transactions;
    IF v_row_count > 0 THEN
        RAISE EXCEPTION 'FAILED: Data visible without context! (Count: %)', v_row_count;
    ELSE
        RAISE NOTICE 'SUCCESS: No data visible without context.';
    END IF;
    RESET ROLE;

    -- 2. Setup Dummy Data (as superuser)
    DELETE FROM public.transactions WHERE purpose = 'RLS TEST';
    INSERT INTO public.transactions (id, company_id, created_by, purpose, total_amount, type, status)
    VALUES 
        (uuid_generate_v4(), v_company_a, v_user_a, 'RLS TEST', 100, 'BKK', 'draft'),
        (uuid_generate_v4(), v_company_b, v_user_b, 'RLS TEST', 200, 'BKK', 'draft');

    -- 3. Test: Company Isolation (Login as User A / Company A)
    SET ROLE app_runtime;
    PERFORM set_config('app.current_user_id', v_user_a::text, true);
    PERFORM set_config('app.user_role', 'staff', true);
    PERFORM set_config('app.own_company_id', v_company_a::text, true);
    PERFORM set_config('app.active_company_id', v_company_a::text, true);

    SELECT count(*) INTO v_row_count FROM public.transactions WHERE purpose = 'RLS TEST';
    IF v_row_count != 1 THEN
        RAISE EXCEPTION 'FAILED: Company isolation failed! Expected 1 row, got %', v_row_count;
    ELSE
        RAISE NOTICE 'SUCCESS: Company isolation working. Only saw 1 relevant row.';
    END IF;

    -- 4. Test: Cross-Company INSERT (Should FAIL)
    BEGIN
        INSERT INTO public.transactions (company_id, created_by, purpose, total_amount, type, status)
        VALUES (v_company_b, v_user_a, 'RLS TEST MALICIOUS', 500, 'BKK', 'draft');
        RAISE EXCEPTION 'FAILED: Cross-company INSERT succeeded! WITH CHECK is not working.';
    EXCEPTION WHEN insufficient_privilege OR check_violation THEN
        RAISE NOTICE 'SUCCESS: Cross-company INSERT prevented by RLS (WITH CHECK).';
    END;

    RESET ROLE;
    
    -- Cleanup
    DELETE FROM public.transactions WHERE purpose = 'RLS TEST';
    
    RAISE NOTICE '--- RLS VERIFICATION COMPLETE: ALL TESTS PASSED ---';
END
$$;
