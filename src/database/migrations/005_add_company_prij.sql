-- ============================================
-- Migration 005 — Add company PT PUSAT REKRUTMEN INDONESIA JEPANG
-- ============================================

INSERT INTO companies (id, name, short_code) VALUES
  ('a1000000-0000-0000-0000-000000000005', 'PT PUSAT REKRUTMEN INDONESIA JEPANG', 'PRIJ')
ON CONFLICT (short_code) DO NOTHING;
