-- ============================================
-- Migration: Update document_type CHECK constraint
-- for ai_processing_jobs table
-- Aligns with unified AI extraction values
-- ============================================

-- Step 1: Drop the old CHECK constraint
ALTER TABLE ai_processing_jobs
  DROP CONSTRAINT IF EXISTS ai_processing_jobs_document_type_check;

-- Step 2: Migrate existing data to new values
UPDATE ai_processing_jobs SET document_type = 'BANK_TRANSFER' WHERE document_type = 'transfer';
UPDATE ai_processing_jobs SET document_type = 'BPN'           WHERE document_type = 'bpn_pajak';
UPDATE ai_processing_jobs SET document_type = 'TIDAK_DIKENALI' WHERE document_type = 'unrecognized';

-- Step 3: Add the new CHECK constraint with updated values
ALTER TABLE ai_processing_jobs
  ADD CONSTRAINT ai_processing_jobs_document_type_check
  CHECK (document_type IS NULL OR document_type IN ('BPN', 'BANK_TRANSFER', 'TIDAK_DIKENALI'));
