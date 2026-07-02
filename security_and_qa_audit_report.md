# SECURITY & QA AUDIT REPORT
## Project: BKK Online Exata Indonesia

---

# DAFTAR TEMUAN AUDIT

## ringkasan Eksekutif
Audit menyeluruh telah dilakukan pada seluruh repositori aplikasi **BKK Online Exata Indonesia** di tingkat Security, Backend, Database, Frontend, dan Performance. Ditemukan beberapa kerentanan keamanan kritis (P0) termasuk **bypass autentikasi total** karena tidak aktifnya file middleware, **kebocoran data multi-tenant (P0)**, **kemampuan login user non-aktif**, serta bug rendering visual (P2) pada dokumen PDF/Image.

Berikut adalah rincian temuan yang dikelompokkan berdasarkan severity level.

---

## KATEGORI: CRITICAL (P0)

### Temuan 1: Bypass Autentikasi Total & Spoofing Header (Next.js Middleware Tidak Aktif)
* **Severity**: P0 - Critical
* **Lokasi**: 
  - File: [src/proxy.ts](file:///z:/03%20NEW/2026/10%20BKK%20AUTOMATIC/BKK%20AUTOMATIC%20V3/app/src/proxy.ts)
  - Komponen: Next.js Global Middleware
* **Deskripsi**:
  Aplikasi bermaksud memproteksi endpoint dan meneruskan informasi session melalui request headers (`x-user-id`, `x-active-company-id`, `x-own-company-id`, `x-user-role`) di dalam file `src/proxy.ts`. Namun, Next.js hanya mengenali file middleware jika diletakkan langsung di `src/middleware.ts` atau `/middleware.ts` di root project. Karena file tersebut bernama `proxy.ts` dan tidak di-export dari file middleware global yang sah, **Next.js mengabaikan seluruh logika autentikasi ini**. 
  
  Akibatnya, cookie `access_token` tidak pernah divalidasi, dan endpoint API maupun Server Component hanya mengandalkan keberadaan header yang dikirim oleh request. Seorang attacker dapat melewati autentikasi dan mengakses data apa pun dengan mengirimkan custom headers secara manual.
* **Root Cause**:
  File middleware global salah penamaan (`src/proxy.ts` alih-alih `src/middleware.ts`) dan tidak mengekspor fungsi default bernama `middleware`.
* **Dampak**:
  - Seluruh pengguna (termasuk anonymous attacker) dapat mengakses Dashboard Layout dan seluruh API Route tanpa kredensial/token valid.
  - Attacker dapat melakukan *Header Spoofing* (mengirim header `x-user-id` dan `x-user-role: admin` palsu) untuk mengambil alih hak akses penuh sistem.
* **Cara Reproduksi**:
  1. Hapus cookie di browser.
  2. Lakukan request menggunakan Postman/cURL ke `GET /api/transactions` dengan menambahkan header `x-user-id: [uuid-apapun]` dan `x-user-role: staff`.
  3. API akan merespon dengan data transaksi secara sukses tanpa memvalidasi token JWT.
* **Solusi**:
  1. Ubah nama file dari `src/proxy.ts` menjadi `src/middleware.ts`.
  2. Ubah nama ekspor fungsi dari `export async function proxy` menjadi `export async function middleware` (atau `export default middleware`).

---

### Temuan 2: Kebocoran Data Multi-Tenant (Bypass Validasi activeCompanyId pada Peran Non-Admin)
* **Severity**: P0 - Critical
* **Lokasi**:
  - File: [src/features/transactions/services/index.ts](file:///z:/03%20NEW/2026/10%20BKK%20AUTOMATIC/BKK%20AUTOMATIC%20V3/app/src/features/transactions/services/index.ts)
  - Fungsi: `listTransactions`, `getTransaction`, `getDashboardStats`
  - Route: `/api/transactions`, `/api/dashboard/stats`, `/api/pdf/[transactionId]`
* **Deskripsi**:
  Aplikasi menerapkan Row Level Security (RLS) di PostgreSQL berdasarkan session variable yang diset lewat `withDbContext`. Namun, fungsi `getAuthSession()` di backend langsung mengambil nilai `activeCompanyId` dari header `x-active-company-id` tanpa memvalidasi apakah pengguna non-admin (misal: `finance` atau `staff`) berhak mengakses perusahaan tersebut.
  
  Meskipun RLS `transactions_select` membatasi staff pada `company_id = public.own_company_id()`, peran **`finance`** memiliki policy:
  `WHEN public.user_role() = 'finance' THEN company_id = public.active_company_id()`
  Jika seorang pengguna dengan peran `finance` mengirim request dengan header `x-active-company-id` yang diubah ke ID Perusahaan B, RLS akan meloloskan query tersebut karena session variable `app.active_company_id` diset sesuai header yang dikirim.
* **Root Cause**:
  Tidak ada verifikasi silang (cross-validation) di layer server untuk memastikan bahwa `activeCompanyId` yang diminta oleh user non-admin harus sama dengan `ownCompanyId` (perusahaan tempat user terdaftar).
* **Dampak**:
  Pengguna dengan peran `finance` dari Perusahaan A dapat melihat seluruh data transaksi finansial, nominal, departemen, dan detail sensitif milik Perusahaan B hanya dengan menyisipkan/memodifikasi header HTTP request.
* **Cara Reproduksi**:
  1. Login sebagai user dengan peran `finance` milik Perusahaan A.
  2. Intersept request API `/api/transactions` menggunakan Developer Tools atau proxy proxying tool.
  3. Ubah nilai header `x-active-company-id` ke UUID milik Perusahaan B.
  4. Respon API akan mengembalikan daftar transaksi Perusahaan B.
* **Solusi**:
  Di dalam `getAuthSession()` (atau middleware), tambahkan pengecekan tegas:
  ```typescript
  if (role !== "admin" && activeCompanyId !== user.company_id) {
      // Non-admin dipaksa menggunakan company_id asli mereka
      activeCompanyId = user.company_id;
  }
  ```

---

## KATEGORI: HIGH (P1)

### Temuan 3: Akun Non-Aktif Tetap Bisa Login & Mengakses Data (Missing Status Check)
* **Severity**: P1 - High
* **Lokasi**:
  - File: [src/features/auth/services/auth.service.ts](file:///z:/03%20NEW/2026/10%20BKK%20AUTOMATIC/BKK%20AUTOMATIC%20V3/app/src/features/auth/services/auth.service.ts)
  - Fungsi: `login` dan `refreshAccessToken`
  - File: [src/features/auth/middleware.ts](file:///z:/03%20NEW/2026/10%20BKK%20AUTOMATIC/BKK%20AUTOMATIC%20V3/app/src/features/auth/middleware.ts)
  - Fungsi: `getAuthSession`
* **Deskripsi**:
  Admin memiliki fitur untuk menonaktifkan pengguna melalui fungsi `deactivateUser(id)` yang mengubah kolom `is_active` menjadi `false` di tabel `users`. Namun, di dalam fungsi `login()`, `refreshAccessToken()`, dan `getAuthSession()`, query SQL yang mengambil data profile user dari database **tidak memverifikasi** apakah pengguna tersebut masih aktif (`is_active = true`).
* **Root Cause**:
  Missing klausa `WHERE u.is_active = true` pada query pengambilan profil pengguna di layer autentikasi dan session verification.
* **Dampak**:
  Pengguna yang sudah di-deactive (dipecat atau dinonaktifkan) tetap bisa login menggunakan email & password mereka, me-refresh token, dan mengakses seluruh data transaksi perusahaan secara bebas.
* **Cara Reproduksi**:
  1. Ubah status user di database `users.is_active = false`.
  2. Kirim request POST ke `/api/auth/login` menggunakan kredensial user tersebut.
  3. Login berhasil dan sistem tetap mengeluarkan JWT token yang valid.
* **Solusi**:
  Tambahkan filter `AND u.is_active = true` ke semua query pencarian user di `auth.service.ts` dan `middleware.ts`, misalnya:
  ```sql
  SELECT u.id, u.email, u.full_name, u.company_id, r.name as role 
  FROM public.users u 
  JOIN public.roles r ON u.role_id = r.id 
  WHERE u.id = $1 AND u.is_active = true
  ```

---

### Temuan 4: Kerentanan CSRF Kritis pada API Perubahan Data Finansial
* **Severity**: P1 - High
* **Lokasi**:
  - File: [src/proxy.ts](file:///z:/03%20NEW/2026/10%20BKK%20AUTOMATIC/BKK%20AUTOMATIC%20V3/app/src/proxy.ts)
  - Komponen: API Route & Middleware
* **Deskripsi**:
  Aplikasi menyimpan session token di dalam cookie (`access_token` dan `refresh_token`) dengan properti `SameSite: "lax"`. Karena aplikasi tidak menggunakan token CSRF (Anti-CSRF) maupun verifikasi Origin/Referer header yang ketat pada API mutasi data (`/api/transactions` POST/PATCH/DELETE), situs pihak ketiga yang berbahaya dapat memicu request atas nama user yang sedang login.
* **Root Cause**:
  Tidak ada mekanisme validasi CSRF token atau verifikasi Origin/Referer header pada request non-GET.
* **Dampak**:
  Jika staf keuangan mengunjungi situs berbahaya saat masih login di BKK Online, situs tersebut dapat melakukan eksploitasi CSRF untuk membuat, memodifikasi, atau menghapus bukti kas keluar (BKK) tanpa sepengetahuan pengguna.
* **Cara Reproduksi**:
  1. Buka aplikasi BKK Online dan login.
  2. Di tab browser yang sama, buka file HTML lokal (malicious site) yang mengirimkan form POST otomatis ke `http://localhost:3000/api/transactions` berisi data transaksi palsu.
  3. Transaksi palsu berhasil dibuat karena browser otomatis menyertakan cookie `access_token`.
* **Solusi**:
  Lakukan verifikasi origin pada middleware (`src/middleware.ts` setelah diaktifkan):
  ```typescript
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (request.method !== "GET" && origin && !origin.includes(host)) {
      return NextResponse.json({ error: "CSRF Blocked" }, { status: 403 });
  }
  ```

---

## KATEGORI: MEDIUM (P2)

### Temuan 5: Teks Keterangan & Keperluan Terpotong pada PDF dan Image Export
* **Severity**: P2 - Medium
* **Lokasi**:
  - File PDF: [bkk-pdf-document.tsx](file:///z:/03%20NEW/2026/10%20BKK%20AUTOMATIC/BKK%20AUTOMATIC%20V3/app/src/features/pdf-export/components/bkk-pdf-document.tsx)
  - File HTML/Image: [bkk-document-html.tsx](file:///z:/03%20NEW/2026/10%20BKK%20AUTOMATIC/BKK%20AUTOMATIC%20V3/app/src/features/pdf-export/components/bkk-document-html.tsx)
* **Deskripsi**:
  1. **PDF**: `tableRow` memiliki tinggi statis (`height: 14` pt) dan `infoSection` memiliki tinggi statis (`height: 38` pt). Ketika teks deskripsi barang atau keperluan (`info.purpose`) sangat panjang, teks akan membungkus (wrap) ke baris baru, namun baris tersebut akan berada di bawah batas tinggi kontainer yang kaku. Akibatnya, teks terpotong secara visual (clipping) atau menindih elemen di bawahnya.
  2. **Image Export (HTML)**: Elemen div deskripsi menggunakan class `truncate` dari TailwindCSS (`text-overflow: ellipsis; white-space: nowrap; overflow: hidden;`). Ini memaksa teks yang panjang dipotong dengan tanda `...` dalam satu baris.
* **Root Cause**:
  - Desain layout PDF menggunakan dimensi box model statis tanpa penyesuaian dinamis (`minHeight` / auto height).
  - HTML preview menggunakan pemotongan string kaku (`truncate`) untuk menjaga layout pixel-perfect 13cm x 9cm, mengorbankan keterbacaan data.
* **Dampak**:
  Hasil print fisik, file PDF yang diunduh, dan JPG bukti transaksi tidak memuat deskripsi lengkap transaksi (misalnya rincian barang belanjaan yang panjang), sehingga tidak sah untuk audit akuntansi.
* **Cara Reproduksi**:
  1. Buat transaksi dengan deskripsi item sepanjang 100 karakter.
  2. Klik tombol "Lihat / Export Dokumen" atau "Export JPG".
  3. Perhatikan bahwa teks deskripsi terputus di tengah jalan dengan tanda `...` (di JPG) atau hilang terpotong (di PDF).
* **Solusi**:
  1. Pada PDF, ganti `height: 14` menjadi `minHeight: 14` pada `tableRow` dan `height: 38` menjadi `minHeight: 38` pada `infoSection`. Jika tinggi melebihi budget, kurangi jumlah baris kosong pengisi (padding rows) secara dinamis.
  2. Pada HTML preview, hapus class `truncate` pada deskripsi dan keperluan, lalu terapkan `break-words` atau `whitespace-normal` dengan ukuran font yang sedikit menyusut secara dinamis jika jumlah karakter sangat besar.

---

### Temuan 6: Balapan Data (Race Condition) pada Penomoran BKK/BKM
* **Severity**: P2 - Medium
* **Lokasi**:
  - Database: Fungsi [generate_bkk_number](file:///z:/03%20NEW/2026/10%20BKK%20AUTOMATIC/BKK%20AUTOMATIC%20V3/app/src/database/migrations/003_auto_bkk_number.sql)
* **Deskripsi**:
  Nomor urut dokumen dibuat menggunakan query:
  `SELECT COUNT(*) INTO v_count FROM transactions WHERE ...`
  Jika dua user melakukan submit transaksi untuk perusahaan yang sama secara konkuren (dalam waktu milidetik yang sama), keduanya akan membaca nilai `v_count` yang sama, menghasilkan nomor dokumen BKK/BKM duplikat (misal: `SREI BKK 005` untuk kedua transaksi).
  Selain itu, kolom `bkk_number` pada tabel `transactions` tidak memiliki indeks `UNIQUE` sehingga duplikasi ini lolos tanpa error database.
* **Root Cause**:
  Penomoran sequential didasarkan pada agregasi `COUNT(*)` non-blocking alih-alih sequence database atau mekanisme locking (`SELECT ... FOR UPDATE`).
* **Dampak**:
  Terjadi duplikasi nomor bukti kas di production, merusak konsistensi pembukuan dan mempersulit audit internal.
* **Cara Reproduksi**:
  Jalankan dua request POST konkuren ke `/api/transactions` secara bersamaan untuk company_id yang sama. Periksa tabel `transactions`, kedua record akan memiliki `bkk_number` yang sama.
* **Solusi**:
  1. Gunakan penguncian baris eksplisit sebelum kalkulasi nomor:
     `PERFORM 1 FROM companies WHERE id = p_company_id FOR UPDATE;`
     Ini akan menserialisasi proses penomoran per perusahaan.
  2. Tambahkan constraint `UNIQUE (company_id, bkk_number, type) WHERE (is_deleted = false)` pada tabel `transactions`.

---

### Temuan 7: Kerentanan Upload File Liar (File Size Limit & Path Traversal)
* **Severity**: P2 - Medium
* **Lokasi**:
  - Route: [src/app/api/upload/route.ts](file:///z:/03%20NEW/2026/10%20BKK%20AUTOMATIC/BKK%20AUTOMATIC%20V3/app/src/app/api/upload/route.ts)
* **Deskripsi**:
  1. API `/api/upload` menerima file upload tanpa melakukan validasi ukuran file maksimal (file size limit).
  2. Nama file yang di-upload dibersihkan menggunakan regex `file.name.replace(/[^a-zA-Z0-9._-]/g, "_")`, namun nilai `activeCompanyId` diambil langsung dari header tanpa validasi UUID. Jika attacker menyuntikkan path traversal ke dalam `x-active-company-id`, file dapat terunggah ke folder S3 yang tidak semestinya.
* **Root Cause**:
  Absennya pemeriksaan ukuran blob file (`file.size`) dan validasi format UUID pada parameter path folder tujuan.
* **Dampak**:
  - *Denial of Service (DoS)*: Attacker dapat mengunggah file berukuran sangat besar (misal 5GB) berulang kali untuk menghabiskan kuota penyimpanan S3 dan membebani server memory.
  - *Data Poisoning*: File diunggah ke namespace tenant lain.
* **Cara Reproduksi**:
  Kirim request POST multipart form-data ke `/api/upload` dengan menyertakan file dummy berukuran 2GB. Server akan mencoba memproses file tersebut ke memori tanpa batasan.
* **Solusi**:
  Terapkan validasi ukuran file sebelum memproses upload (misal maks 5MB):
  ```typescript
  if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File terlalu besar (maks 5MB)" }, { status: 400 });
  }
  ```

---

### Temuan 8: Inkonsistensi Session Setelah Token Refresh (Admin Switch Company Reset)
* **Severity**: P2 - Medium
* **Lokasi**:
  - File: [src/features/auth/services/auth.service.ts](file:///z:/03%20NEW/2026/10%20BKK%20AUTOMATIC/BKK%20AUTOMATIC%20V3/app/src/features/auth/services/auth.service.ts)
  - Fungsi: `refreshAccessToken`
* **Deskripsi**:
  Ketika Admin mengubah perusahaannya yang aktif menggunakan fitur "Switch Company", sistem mengeluarkan token baru dengan klaim `active_company_id` yang sesuai pilihan Admin. Namun, ketika token kedaluwarsa setelah 15 menit dan browser memicu refresh token (`/api/auth/refresh`), fungsi `refreshAccessToken` mengambil data profil user dari DB dan langsung menyetel kembali `active_company_id: profile.company_id` (kembali ke perusahaan asal Admin).
* **Root Cause**:
  Fungsi refresh token tidak menyimpan status `active_company_id` terakhir yang dipilih Admin, melainkan selalu melakukan reset ke `company_id` bawaan profil.
* **Dampak**:
  Admin yang sedang bekerja mengelola transaksi Perusahaan B secara tiba-tiba terlempar kembali ke tampilan Perusahaan A setiap 15 menit sekali akibat silent-refresh token.
* **Cara Reproduksi**:
  1. Login sebagai Admin (perusahaan asal: Perusahaan A).
  2. Switch company ke Perusahaan B.
  3. Tunggu 15 menit atau picu request manual ke `/api/auth/refresh`.
  4. Periksa payload token JWT baru; properti `active_company_id` telah berubah kembali menjadi Perusahaan A.
* **Solusi**:
  Simpan active company ID yang sedang aktif di database (misal di tabel session/profile) atau kirimkan `active_company_id` terakhir dari client saat memicu request refresh token untuk dimasukkan kembali ke JWT baru (setelah divalidasi).

---

### Temuan 9: Kerentanan Dual-Write / Transactional Messaging pada Job AI Parse
* **Severity**: P2 - Medium
* **Lokasi**:
  - Route: [src/app/api/ai-parse/route.ts](file:///z:/03%20NEW/2026/10%20BKK%20AUTOMATIC/BKK%20AUTOMATIC%20V3/app/src/app/api/ai-parse/route.ts)
* **Deskripsi**:
  Pemicuan worker Inngest (`inngest.send`) dilakukan di dalam callback `withDbContext` yang berstatus transaksi database aktif (`BEGIN ... COMMIT`). Jika pengiriman event ke Inngest berhasil tetapi transaksi DB gagal di-commit (misalnya karena error di iterasi file berikutnya atau koneksi database terputus sebelum COMMIT), maka event antrean Inngest tetap berjalan di background.
* **Root Cause**:
  Mengirim pesan/event ke message broker eksternal (Inngest) di dalam transaksi database sebelum transaksi tersebut dipastikan sukses ter-commit (Dual-Write anti-pattern).
* **Dampak**:
  Background worker Inngest akan berjalan, mencari ID pekerjaan (`job_id`) di database, dan langsung crash/gagal karena record pekerjaan tersebut tidak pernah ada (karena rollback database). Ini memenuhi log error sistem dengan noise kegagalan.
* **Solusi**:
  Kumpulkan semua `jobIds` dan parameter event di dalam array selama transaksi database berlangsung. Panggil `inngest.send` **hanya setelah** fungsi `withDbContext` selesai dieksekusi dengan sukses (di luar blok transaksi).

---

## KATEGORI: LOW (P3) / PERTANYAAN LAINNYA

### Temuan 10: Kode Mati (Dead Code) Image Preprocessor & Ketiadaan Dukungan PDF di Client
* **Severity**: P3 - Low
* **Lokasi**:
  - File: [image-preprocessor.ts](file:///z:/03%20NEW/2026/10%20BKK%20AUTOMATIC/BKK%20AUTOMATIC%20V3/app/src/features/ai-parser/components/image-preprocessor.ts)
  - Page: [ai-parser/page.tsx](file:///z:/03%20NEW/2026/10%20BKK%20AUTOMATIC/BKK%20AUTOMATIC%20V3/app/src/app/%28dashboard%29/ai-parser/page.tsx)
* **Deskripsi**:
  1. Proyek memiliki utilitas bagus untuk kompresi gambar di client (`image-preprocessor.ts`), namun file ini sama sekali tidak di-import atau dipanggil oleh `AiParserPage`. Halaman upload langsung mengirimkan file mentah berukuran besar ke `/api/upload`.
  2. Jika preprocessor ini kelak digunakan, fungsi `preprocessImage` langsung memanggil `createImageBitmap(file)` tanpa memeriksa tipe file. Jika user mengunggah PDF, pemanggilan ini akan crash karena PDF tidak didukung oleh browser Canvas API secara langsung.
* **Root Cause**:
  Utilitas preprocessor lupa diintegrasikan ke halaman upload UI utama.
* **Dampak**:
  Pemborosan bandwidth server dan penyimpanan S3 untuk gambar besar (3-5MB per file) yang memperlambat performa ekstraksi AI.
* **Solusi**:
  Integrasikan `uploadFilesToStorage` dari preprocessor ke `AiParserPage`, dengan menambahkan pengecekan tipe file: jika file adalah PDF, bypass kompresi Canvas dan langsung upload file aslinya.

---

### Temuan 11: Missing Database Index pada Kolom Soft Delete `is_deleted`
* **Severity**: P3 - Low
* **Lokasi**:
  - Database Table: `transactions`
* **Deskripsi**:
  Kolom `is_deleted` bertipe `BOOLEAN` digunakan di hampir semua query SQL aplikasi (seperti `listTransactions`, `getTransaction`, dan dashboard stats rpc) dengan klausa `WHERE is_deleted = false`. Namun, tidak ada indeks pada kolom `is_deleted` ini.
* **Root Cause**:
  Indeks hanya difokuskan pada foreign key dan tanggal transaksi.
* **Dampak**:
  Seiring berjalannya waktu dan bertambahnya jumlah data transaksi di database, query list dan dashboard stats akan melambat karena PostgreSQL harus memfilter baris non-deleted tanpa bantuan indeks.
* **Solusi**:
  Terapkan partial index untuk mempercepat filter record aktif:
  ```sql
  CREATE INDEX idx_transactions_active ON transactions(company_id) WHERE (is_deleted = false);
  ```

---

### Temuan 12: Broken Access Control pada API Daftar Peran (Roles Listing)
* **Severity**: P3 - Low
* **Lokasi**:
  - Route: [src/app/api/admin/roles/route.ts](file:///z:/03%20NEW/2026/10%20BKK%20AUTOMATIC/BKK%20AUTOMATIC%20V3/app/src/app/api/admin/roles/route.ts)
* **Deskripsi**:
  Endpoint `/api/admin/roles` hanya memeriksa apakah `userId` dan `role` tersedia di header. Endpoint ini tidak memeriksa apakah peran pengguna yang meminta adalah `admin`.
* **Root Cause**:
  Absennya pengecekan `role === 'admin'` pada tingkat route handler.
* **Dampak**:
  Pengguna dengan tingkat otoritas rendah (`staff` atau `finance`) dapat membaca seluruh daftar peran (roles) dan permission matrix sistem yang berpotensi memfasilitasi serangan privilege escalation berikutnya.
* **Solusi**:
  Gunakan route guard `requireAuth(PERMISSIONS.USER_READ)` atau lakukan pengecekan tegas:
  ```typescript
  if (role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  ```

---

### Temuan 13: Hardcoded Credentials pada Skema Migrasi RLS
* **Severity**: P3 - Low
* **Lokasi**:
  - File Migration: [010_create_app_runtime_role.sql](file:///z:/03%20NEW/2026/10%20BKK%20AUTOMATIC/BKK%20AUTOMATIC%20V3/app/src/migration/010_create_app_runtime_role.sql)
* **Deskripsi**:
  Password untuk PostgreSQL role `app_runtime` ditulis secara hardcoded dalam plaintext di berkas migrasi:
  `PASSWORD '@Adamleo12331'`
* **Root Cause**:
  Kurangnya otomasi penyuntikan rahasia (secret injection) saat proses inisialisasi database Railway.
* **Dampak**:
  Siapa saja yang memiliki akses ke repositori git dapat mengetahui kredensial database untuk runtime aplikasi, meningkatkan risiko kebocoran data jika repositori bocor.
* **Solusi**:
  Gunakan environment variable untuk mensubstitusi password selama proses deployment/migration, atau lakukan rotasi password pasca-migration secara aman langsung di console database production.

---

### Temuan 14: Ketiadaan API Rate Limiting
* **Severity**: P3 - Low
* **Lokasi**:
  - Komponen: Next.js API Routes (terutama `/api/ai-parse` dan `/api/pdf`)
* **Deskripsi**:
  Aplikasi tidak membatasi jumlah request yang masuk per menit (rate limit). Panggilan ke AI parser memicu request eksternal ke model Gemini, sedangkan pembuatan PDF memicu operasi rendering CPU yang cukup berat di backend.
* **Root Cause**:
  Rate limiter belum diimplementasikan di tingkat middleware atau routing.
* **Dampak**:
  Aplikasi sangat rentan terhadap serangan brute-force atau spamming upload file yang dapat menghabiskan kuota API Gemini (sehingga aplikasi tidak berfungsi bagi pengguna lain) serta membebani server (CPU spike / crash).
* **Solusi**:
  Terapkan rate limiting sederhana menggunakan memory cache (seperti `lru-cache`) atau Redis di middleware Next.js untuk membatasi request per IP per menit pada rute-rute sensitif.

---

### Temuan 15: Redundant API Requests pada Halaman Transaksi (Client Performance)
* **Severity**: P3 - Low
* **Lokasi**:
  - File: [transactions/page.tsx](file:///z:/03%20NEW/2026/10%20BKK%20AUTOMATIC/BKK%20AUTOMATIC%20V3/app/src/app/%28dashboard%29/transactions/page.tsx)
* **Deskripsi**:
  Saat halaman Transaksi dimuat, client-side component melakukan 3 panggilan fetch konkuren ke backend:
  1. `/api/transactions?...`
  2. `/api/dashboard/stats`
  3. `/api/me` (untuk mengecek peran user saat ini).
  
  Panggilan `/api/me` bersifat redundan karena server component parent (`layout.tsx`) sudah memiliki data session penuh (termasuk user role) dan dapat mendistribusikannya melalui context, state, atau props alih-alih memaksa client melakukan HTTP round-trip dan query database tambahan.
* **Root Cause**:
  Client component tidak memanfaatkan state / session yang sudah di-resolve oleh parent Server Component.
* **Dampak**:
  Peningkatan beban database PostgreSQL pada koneksi konkuren dan performa rendering awal halaman yang sedikit terhambat.
* **Solusi**:
  Teruskan data user session dari `layout.tsx` (Server Component) ke client-side pages menggunakan React Context atau simpan di global state sesaat setelah login pertama kali.
