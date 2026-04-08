-- ============================================
-- Seed Data — BKK Automatic V3
-- ============================================

-- 1. Insert companies
INSERT INTO companies (id, name, short_code) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'PT. SUMBER REZEKI EXATA INDONESIA', 'SREI'),
  ('a1000000-0000-0000-0000-000000000002', 'PT. EXATA SOLUSI KREATIF', 'ESK'),
  ('a1000000-0000-0000-0000-000000000003', 'PT. YANOSHI JAPAN OMIYAGE', 'YJO'),
  ('a1000000-0000-0000-0000-000000000004', 'PT. JAPAN INDO TRAVEL CONNECTION', 'JTC'),
  ('a1000000-0000-0000-0000-000000000005', 'PT PUSAT REKRUTMEN INDONESIA JEPANG', 'PRIJ')
ON CONFLICT (short_code) DO NOTHING;

-- 2. Insert roles with permissions
INSERT INTO roles (id, name, permissions) VALUES
  (
    'b1000000-0000-0000-0000-000000000001',
    'admin',
    '["user.create","user.read","user.update","user.delete","company.switch","company.read","transaction.create","transaction.read","transaction.update","transaction.delete","transaction.export_csv","transaction.export_pdf","ai_parse.upload","ai_parse.view_jobs","monitoring.view","audit.view"]'::jsonb
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'finance',
    '["company.switch","company.read","transaction.read","transaction.export_csv","transaction.export_pdf","ai_parse.upload","ai_parse.view_jobs","monitoring.view"]'::jsonb
  ),
  (
    'b1000000-0000-0000-0000-000000000003',
    'staff',
    '["company.read","transaction.create","transaction.read","transaction.update","transaction.delete","transaction.export_pdf","ai_parse.upload","ai_parse.view_jobs"]'::jsonb
  )
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 3. Auto-create public.users profile on signup
-- This trigger fires when a new user registers via Supabase Auth
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, company_id, role_id, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE(
      (NEW.raw_user_meta_data ->> 'company_id')::uuid,
      'a1000000-0000-0000-0000-000000000001'  -- default: SREI
    ),
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role_id')::uuid,
      'b1000000-0000-0000-0000-000000000001'  -- default: admin (for first user)
    ),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to avoid duplicate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 4. ADMIN ACCOUNT SETUP (manual steps)
-- ============================================
-- After running this seed, create the admin user via ONE of these methods:
--
-- METHOD A: Supabase Dashboard (Recommended)
--   1. Go to Authentication > Users > Add User
--   2. Email: admin@super.com
--   3. Password: ONCA1sxcij1SDla65812%6127
--   4. Check "Auto Confirm User"
--   5. The trigger above will auto-create the public.users profile
--
-- METHOD B: Supabase SQL Editor (after creating via Dashboard)
--   If you need to update the admin's role/company after creation:
--
--   UPDATE public.users
--   SET role_id = 'b1000000-0000-0000-0000-000000000001',
--       company_id = 'a1000000-0000-0000-0000-000000000001',
--       full_name = 'Super Admin'
--   WHERE email = 'admin@super.com';
--
-- METHOD C: Supabase Auth Admin API (via curl/Postman)
--   curl -X POST 'https://YOUR_PROJECT.supabase.co/auth/v1/admin/users' \
--     -H 'apikey: YOUR_SERVICE_ROLE_KEY' \
--     -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
--     -H 'Content-Type: application/json' \
--     -d '{
--       "email": "admin@super.com",
--       "password": "ONCA1sxcij1SDla65812%6127",
--       "email_confirm": true,
--       "user_metadata": {
--         "full_name": "Super Admin",
--         "company_id": "a1000000-0000-0000-0000-000000000001",
--         "role_id": "b1000000-0000-0000-0000-000000000001"
--       }
--     }'
