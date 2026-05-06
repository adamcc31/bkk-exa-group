#!/bin/bash
# Usage: DATABASE_ADMIN_URL=<superuser-url> ./app/scripts/run-migrations.sh
# 
# Script ini HARUS dijalankan dengan DATABASE_ADMIN_URL (superuser)
# SEBELUM mengganti DATABASE_URL di Railway dashboard

set -e  # exit on any error

echo "=== PHASE 0: PRE-FLIGHT CHECK ==="
npm run db:preflight
echo ""
echo "Pre-flight selesai. Periksa output di atas."
echo "Pastikan semua tanda centang (✅) sudah sesuai."
if [ "$SKIP_CONFIRM" = "true" ]; then
  CONFIRM="y"
else
  echo "Lanjut migration? (y/n)"
  read -r CONFIRM
fi

if [ "$CONFIRM" != "y" ]; then
  echo "Migration dibatalkan."
  exit 0
fi

echo ""
echo "=== PHASE 1: RUNNING MIGRATIONS ==="
echo "Running as: $(psql $DATABASE_ADMIN_URL -tAc 'SELECT current_user')"

# Safety check: pastikan ini benar-benar superuser
CURRENT_USER=$(psql $DATABASE_ADMIN_URL -tAc 'SELECT current_user')
if [ "$CURRENT_USER" != "postgres" ]; then
  echo "❌ ERROR: Harus dijalankan dengan superuser postgres, bukan $CURRENT_USER"
  exit 1
fi

echo ""
echo "Step 1/4: Creating app_runtime role..."
psql $DATABASE_ADMIN_URL -f app/src/migration/010_create_app_runtime_role.sql
echo "✅ Role created/verified"

echo ""
echo "Step 2/4: Fixing RLS policies WITH CHECK..."
psql $DATABASE_ADMIN_URL -f app/src/migration/011_fix_rls_policies_with_check.sql
echo "✅ Policies updated"

echo ""
echo "Step 3/4: Fixing views security invoker..."
psql $DATABASE_ADMIN_URL -f app/src/migration/012_fix_views_security_invoker.sql
echo "✅ Views secured"

echo ""
echo "Step 4/4: Running verification..."
psql $DATABASE_ADMIN_URL -f app/scripts/verify-rls.sql
echo "✅ Verification complete"

echo ""
echo "============================================"
echo "✅ ALL MIGRATIONS COMPLETE"
echo ""
echo "LANGKAH SELANJUTNYA (manual di Railway dashboard):"
echo "Ganti DATABASE_URL dari:"
echo "  postgresql://postgres:...@host:port/railway"
echo "Menjadi:"
echo "  postgresql://app_runtime:ChangeMeInProduction123!@host:port/railway"
echo ""
echo "Setelah mengganti DATABASE_URL, redeploy aplikasi."
echo "============================================"
