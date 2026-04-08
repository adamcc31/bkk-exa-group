-- ============================================
-- Migration 004 — pg_trgm + GIN index for user search
-- Enables efficient ILIKE '%keyword%' queries on full_name
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm
  ON users USING GIN (full_name gin_trgm_ops);
