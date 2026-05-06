-- ============================================
-- Migration 001 — Auth Users Table (Railway)
-- Replacement for Supabase auth.users
-- ============================================

-- 1. Setup Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create auth_users table in public schema
CREATE TABLE IF NOT EXISTS public.auth_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  hashed_password TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON public.auth_users(email);

-- 3. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_auth_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auth_users_updated_at ON public.auth_users;
CREATE TRIGGER trg_auth_users_updated_at
  BEFORE UPDATE ON public.auth_users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_auth_users_updated_at();

-- 4. Comments
COMMENT ON TABLE public.auth_users IS 'Replacement for Supabase auth.users managed schema';
COMMENT ON COLUMN public.auth_users.hashed_password IS 'Argon2 or BCrypt hashed password from application layer';
