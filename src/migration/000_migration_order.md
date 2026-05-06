# Migration Execution Order

Lakukan eksekusi sesuai urutan berikut untuk memastikan integritas skema dan keamanan RLS di infrastruktur Railway PostgreSQL.

## Phase 1: Core Extensions
Dijalankan pertama kali untuk mendukung UUID dan pencarian teks.
- `001_auth_users.sql` (Section 1: Setup Extensions)

## Phase 2: Original Supabase Tables (Infrastruktur Railway)
Sebelum menjalankan file original, lakukan modifikasi manual berikut:

1. **`app/src/database/migrations/001_initial_schema.sql`**:
   - Cari baris yang mengandung `REFERENCES auth.users(id)`.
   - Hapus atau comment-out constraint tersebut (FK akan ditangani oleh Phase 3).
   - Jalankan file setelah diedit.

2. **Jalankan file lainnya secara berurutan**:
   - `app/src/database/migrations/002_add_printed_status.sql`
   - `app/src/database/migrations/002_update_document_type_check.sql`
   - `app/src/database/migrations/004_add_user_search_index.sql`
   - `app/src/database/migrations/005_add_company_prij.sql`

## Phase 3: Infrastructure Adaptation (Railway Core)
File baru yang menggantikan fungsi internal Supabase dan merapikan skema.
1. `app/src/migration/001_auth_users.sql` (Lanjutkan ke pembuatan tabel & index)
2. `app/src/migration/002_update_schema.sql` (Relinking FK ke `public.auth_users` secara dinamis)
3. `app/src/migration/005_refresh_tokens.sql` (Tabel session)

## Phase 4: Business Logic & RPC
Fungsi-fungsi pembantu untuk aplikasi.
1. `app/src/database/migrations/003_auto_bkk_number.sql`
2. `app/src/database/migrations/006_dashboard_stats_rpc.sql`

## Phase 5: Security Layer (RLS)
Sangat kritis dijalankan terakhir untuk memastikan semua tabel sudah ada.
1. `app/src/migration/003_rls_functions.sql` (Rewritten helper functions)
2. `app/src/migration/004_rls_policies.sql` (Rewritten security policies)

## Phase 6: Seed Data
Opsional, untuk data awal.
1. `app/src/database/seed.sql`
   - *Penting*: Hapus/Comment trigger `on_auth_user_created` pada `auth.users` karena skema `auth` tidak ada di Railway.
