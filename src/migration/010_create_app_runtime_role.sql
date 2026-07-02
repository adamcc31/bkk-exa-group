-- ============================================================
-- Migration 010 — Create App Runtime Role (Idempotent)
-- ============================================================

-- Gunakan DO block agar idempotent
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime WITH
      LOGIN
      PASSWORD '${APP_RUNTIME_PASSWORD}'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION
      NOBYPASSRLS;
    RAISE NOTICE 'Role app_runtime berhasil dibuat';
  ELSE
    -- Role sudah ada, pastikan attributnya benar
    ALTER ROLE app_runtime WITH
      NOSUPERUSER
      NOBYPASSRLS;
    RAISE NOTICE 'Role app_runtime sudah ada, attribute diverifikasi';
  END IF;
END
$$;

-- 2. Grant Schema Usage
GRANT USAGE ON SCHEMA public TO app_runtime;

-- 3. Grant Table Permissions
-- Grant permissions on all existing tables in public schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;

-- Ensure future tables also have these permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;

-- 4. Grant Sequence Permissions (Required for SERIAL/Identity columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- 5. Grant Function Permissions
-- Specifically for our RLS helper functions and existing extensions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO app_runtime;

-- 6. Comments
COMMENT ON ROLE app_runtime IS 'Dedicated role for application runtime with RLS enforced';
