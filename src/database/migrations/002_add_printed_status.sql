-- ============================================
-- Migration 002: Add 'printed' status to transactions
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop existing constraint and re-create with 'printed' status
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('draft', 'printed', 'submitted', 'approved'));
