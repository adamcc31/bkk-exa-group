-- ============================================
-- Migration 002 — Update Schema (Post-Supabase)
-- Relink public.users to public.auth_users
-- ============================================

-- 1. Remove old foreign key if exists (dynamic search for FK to auth schema)
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.table_name = 'users'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'users'
    AND ccu.table_schema = 'auth';
    
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', 
                   v_constraint_name);
  END IF;
END $$;

-- 2. Ensure id column is still UUID (should be) and add new FK
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_auth_id_fkey, -- in case it was already ran
  ADD CONSTRAINT users_auth_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES public.auth_users(id) 
  ON DELETE CASCADE;

-- 3. Update comments to reflect new ownership
COMMENT ON COLUMN public.users.id IS 'References public.auth_users(id)';
