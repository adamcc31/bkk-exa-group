-- ============================================
-- Migration 003 — RLS Functions (Post-Supabase)
-- Decoupled from auth.* schema
-- Optimized with session-level caching
-- ============================================

-- 1. Helper: extract role
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
DECLARE
  v_session_role TEXT;
BEGIN
  -- Fast path: session variable
  v_session_role := NULLIF(current_setting('app.user_role', true), '');
  IF v_session_role IS NOT NULL THEN
    RETURN v_session_role;
  END IF;

  RETURN 'anon';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Helper: extract user's assigned company_id
CREATE OR REPLACE FUNCTION public.own_company_id()
RETURNS UUID AS $$
DECLARE
  v_session_own_id TEXT;
BEGIN
  -- Fast path: session variable
  v_session_own_id := NULLIF(current_setting('app.own_company_id', true), '');
  IF v_session_own_id IS NOT NULL THEN
    RETURN v_session_own_id::uuid;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Helper: extract active company_id (with session override)
CREATE OR REPLACE FUNCTION public.active_company_id()
RETURNS UUID AS $$
DECLARE
  v_override_id UUID;
BEGIN
  -- Check for session override (equivalent to Supabase app_metadata)
  v_override_id := NULLIF(current_setting('app.active_company_id', true), '')::uuid;
  
  IF v_override_id IS NOT NULL THEN
    RETURN v_override_id;
  END IF;

  -- Fallback to user's assigned company
  RETURN public.own_company_id();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. Comments
COMMENT ON FUNCTION public.user_role() IS 'Extracts role from app.user_role session variable';
COMMENT ON FUNCTION public.own_company_id() IS 'Extracts assigned company from app.own_company_id session variable';
COMMENT ON FUNCTION public.active_company_id() IS 'Extracts active company from app.active_company_id session variable';
