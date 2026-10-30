# Sistem Transaksi Manga' Travel

Aplikasi web back-office internal untuk mengelola dan melihat mutasi saldo (cashflow) agen perjalanan **Manga' Travel**, menyaring serta mencari transaksi, melihat detail, menginput transaksi manual maupun mengimpor laporan Excel/CSV, mengelola pengguna & agen, serta mencetak bukti/struk transaksi pada ukuran kertas thermal (**58mm**, **80mm**) maupun **A4**.

Sumber kebenaran spesifikasi:
- Spesifikasi fitur & aturan bisnis: [`docs/app-spec.json`](./docs/app-spec.json)
- Spesifikasi design system & komponen: [`docs/design-spec.json`](./docs/design-spec.json)

## Tech Stack

- **Framework**: Next.js 16.4 (App Router, Cache Components, Partial Prefetching & `proxy.ts`) + TypeScript
- **Styling & Design System**: Tailwind CSS v4 (CSS variables dari `design-spec.json`), Plus Jakarta Sans & JetBrains Mono
- **UI Primitives & Icons**: Radix UI + Lucide Icons
- **Validasi & Keamanan**: Zod, bcryptjs, Web Crypto HMAC-SHA256 `httpOnly` cookie session (kedaluwarsa 8 jam tidak aktif + rate limit login)
- **Parser Impor**: SheetJS (`xlsx`) untuk `.xls`, `.xlsx`, dan `.csv`
- **ORM & Database**: Prisma + **MySQL** (siap dihubungkan ke **XAMPP MySQL lokal**, dilengkapi penyimpanan lokal `.data/local-db.json` otomatis bila `DATABASE_URL` belum diatur)
- **Unit Testing**: Vitest

## Akun Bawaan (Seed)

| Peran | Username | Password | Lingkup Akses |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | Seluruh menu & seluruh agen |
| **Agen (`JKT-37287`)** | `eman` | `eman123` | Terbatas pada transaksi agen `JKT-37287` |

## Menjalankan Proyek (Tanpa XAMPP / Langsung Jalan)

Secara bawaan tanpa file `.env`, aplikasi langsung berjalan menggunakan penyimpanan lokal persisten di `.data/local-db.json` yang sudah berisi akun bawaan dan 25 transaksi contoh terverifikasi:

```bash
npm run dev
```

Buka `http://localhost:3000` (otomatis mengarahkan ke `/login` atau `/transactions`).

## Menghubungkan ke Database MySQL Lokal (XAMPP)

1. Nyalakan modul **Apache** & **MySQL** pada XAMPP Control Panel.
2. Buat database bernama `manga_travel` melalui `http://localhost/phpmyadmin` (atau biarkan `prisma db push` membuatnya).
3. Salin `.env.example` menjadi `.env`:
   ```env
   DATABASE_URL="mysql://root:@localhost:3306/manga_travel"
   SESSION_SECRET="ganti-dengan-string-acak-minimal-32-karakter"
   ```
4. Sinkronkan skema tabel dan isi data awal (seed):
   ```bash
   npm run db:push
   npm run db:seed
   ```
5. Jalankan `npm run dev` — aplikasi otomatis beralih menggunakan MySQL XAMPP tanpa perubahan kode apa pun.

## Pengujian & Pemeriksaan Kualitas

```bash
# Unit test (saldo, ekstraksi, struk grup, filter, otorisasi server, token sesi, parser Excel/CSV)
npm test

# Pemeriksaan tipe, lint, dan produksi build
npx tsc --noEmit
npm run lint
npm run build
```

## Status Fase Pengerjaan

- [x] **Fase 1 — Prototype Inti** (`F-02` Daftar Transaksi `/transactions`, `F-03` Filter Transaksi, `F-04` Pencarian Transaksi, `F-05` Detail Transaksi & Transaksi Terkait `/transactions/[id]`, `F-06` Cetak Struk Individual & Grup 58mm/80mm/A4 `/transactions/[id]/receipt`)
- [x] **Fase 2 — Login, Peran & Database MySQL** (`F-01` Autentikasi Login/Logout `/login`, Profil & Ganti Password `/account`, `F-10` Kelola Pengguna `/admin/users` & Agen `/admin/agents`, Log Audit Sistem `/admin/audit-logs`, `F-11` Pengaturan Profil Usaha & Kop Struk `/settings`)
- [x] **Fase 3 — Input Data** (`F-07` Input Manual Transaksi + Pratinjau Saldo `/transactions/new`, `F-08` Impor Excel/CSV + Pratinjau Validasi & Riwayat Batch `/import`)
- [ ] **Fase 4 — Integrasi API Eksternal** (`F-09` Menunggu spesifikasi sistem eksternal dari klien)
