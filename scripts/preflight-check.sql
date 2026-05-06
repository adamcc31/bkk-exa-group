-- ============================================
-- PRE-FLIGHT CHECK: Jalankan ini sebelum migration
-- Expected: semua baris menunjukkan ✅
-- ============================================

SELECT '--- ENVIRONMENT CHECK ---' AS section;

-- 1. Verifikasi ini benar-benar superuser
SELECT 
  current_user AS role_name,
  CASE WHEN rolsuper THEN '✅ SUPERUSER (aman untuk migration)' 
       ELSE '❌ BUKAN SUPERUSER - migration akan gagal!' 
  END AS superuser_status,
  CASE WHEN rolbypassrls THEN '⚠️ BYPASSRLS aktif' 
       ELSE '✅ NOBYPASSRLS' 
  END AS bypassrls_status
FROM pg_roles 
WHERE rolname = current_user;

-- 2. Verifikasi versi PostgreSQL (butuh minimal PG 15 untuk security_invoker pada view)
SELECT 
  version() AS pg_version,
  CASE WHEN current_setting('server_version_num')::int >= 150000 
       THEN '✅ PG 15+ (security_invoker on views didukung)'
       WHEN current_setting('server_version_num')::int >= 120000
       THEN '⚠️ PG 12-14 (security_invoker hanya untuk functions, bukan views - perlu workaround)'
       ELSE '❌ Versi terlalu lama'
  END AS version_status;

-- 3. Verifikasi role app_runtime belum ada (migration_010 akan CREATE, bukan ALTER)
SELECT
  CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime')
       THEN '⚠️ app_runtime SUDAH ADA - migration_010 perlu IF NOT EXISTS check'
       ELSE '✅ app_runtime belum ada, aman untuk dibuat'
  END AS role_exists_check;

-- 4. Verifikasi database yang aktif
SELECT 
  current_database() AS database_name,
  pg_size_pretty(pg_database_size(current_database())) AS database_size;

-- 5. Cek apakah ada active connections dari app yang perlu diperhatikan
SELECT 
  count(*) AS total_connections,
  count(*) FILTER (WHERE state = 'active') AS active_queries,
  count(*) FILTER (WHERE usename != current_user) AS other_user_connections
FROM pg_stat_activity
WHERE datname = current_database();

-- 6. Verifikasi tabel utama exist sebelum RLS policy diaplikasikan
SELECT 
  relname AS tablename,
  CASE WHEN relrowsecurity THEN '✅ RLS enabled' ELSE '⚠️ RLS belum aktif' END AS rls_status,
  CASE WHEN relforcerowsecurity THEN '✅ FORCE aktif' ELSE '⚠️ FORCE belum aktif' END AS force_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND relname IN ('transactions', 'users')
ORDER BY relname;
