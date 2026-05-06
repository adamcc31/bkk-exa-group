-- ============================================================
-- Migration 012 — Fix Views Security Invoker (Version Guard)
-- ============================================================

-- security_invoker = true on VIEWs is available in PostgreSQL 15+.
-- This script applies it if the version matches.

DO $$
DECLARE
    v_view_name TEXT;
    v_pg_version INT := current_setting('server_version_num')::int;
BEGIN
    IF v_pg_version >= 150000 THEN
        RAISE NOTICE 'PG 15+ detected: applying security_invoker to views';
        
        FOR v_view_name IN 
            SELECT table_name 
            FROM information_schema.views 
            WHERE table_schema = 'public'
        LOOP
            EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v_view_name);
            RAISE NOTICE 'Set security_invoker = true for view: %', v_view_name;
        END LOOP;
    ELSE
        RAISE WARNING 'PG < 15 detected: security_invoker on views NOT supported. Version: %', v_pg_version;
        RAISE WARNING 'Consider upgrading to PostgreSQL 15+ for enhanced View security.';
    END IF;
END
$$;
