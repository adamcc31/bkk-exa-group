# Deployment Guide: RLS Migration

## Prerequisites
Pastikan dua environment variable ini tersedia di local:
- `DATABASE_ADMIN_URL` = koneksi dengan superuser postgres
- `DATABASE_APP_URL` = koneksi dengan role app_runtime (setelah migration)

## Langkah Deployment (URUTAN WAJIB DIIKUTI)

### Phase 1 — Jalankan Migration (butuh ~2 menit)
1. Set DATABASE_ADMIN_URL di terminal lokal:
   ```bash
   export DATABASE_ADMIN_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"
   ```

2. Jalankan migration:
   ```bash
   npm run db:migrate
   ```

3. Pastikan output berakhir dengan "✅ ALL MIGRATIONS COMPLETE"
   Jika ada error, BERHENTI. Jangan lanjut ke Phase 2.

### Phase 2 — Update Environment Variables di Railway

#### Yang HARUS dilakukan:
Tambahkan variable BARU di Railway Dashboard → service → Variables:

| Variable          | Value                                                              |
|-------------------|--------------------------------------------------------------------|
| DATABASE_APP_URL  | postgresql://app_runtime:ChangeMeInProduction123!@HOST:5432/PGDATABASE |

**Catatan**: Isi `HOST` dan `PGDATABASE` sesuai dengan nilai `${{RAILWAY_PRIVATE_DOMAIN}}` dan `${{PGDATABASE}}` yang bisa dilihat di Railway service variables.

#### Yang TIDAK BOLEH dilakukan:
- ❌ **Jangan** ubah atau hapus `DATABASE_URL` (Biarkan tetap menggunakan postgres).
- ❌ **Jangan** ubah `${{PGUSER}}` atau variable internal Railway lainnya.

3. Simpan → Railway otomatis trigger redeploy

### Phase 3 — Verifikasi Post-Deploy (butuh ~1 menit)
1. Tunggu redeploy selesai (~1-2 menit)
2. Jalankan verifikasi:
   ```bash
   npm run db:verify-rls
   ```
3. Semua check harus hijau ✅

### Rollback (jika ada masalah)
Kembalikan `DATABASE_URL` ke postgres superuser:
`DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway`
Railway akan otomatis redeploy ke konfigurasi lama.

## Environment Variables yang Dibutuhkan di Railway
| Variable | Value | Keterangan |
|---|---|---|
| DATABASE_URL | postgresql://app_runtime:... | Untuk aplikasi |
| DATABASE_ADMIN_URL | postgresql://postgres:... | Untuk migration saja, jangan expose ke app |
