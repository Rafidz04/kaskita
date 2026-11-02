# 💸 KasKita — Modern Petty Cash & Dues Tracker

Aplikasi buku kas kecil (petty cash) & pencatatan iuran kas bulanan dengan stack **React.js + Express.js + Node.js (v24.22.1) + MongoDB Atlas**. Backend dan frontend terintegrasi dalam **1 server** dengan tampilan super responsif di segala skala (desktop, tablet, mobile) serta estetika modern ala Gen Z (glassmorphism, bento grid, neon accent & dark/light mode).

---

## 🌟 Fitur Utama

1. **Dashboard Eksekutif Lengkap & Live**:
   - **Hero Card Saldo Kas**: Menampilkan sisa kas berjalan real-time (Rp 610.700 sesuai spreadsheet).
   - **Target & Setoran Bulan Ini**: Indikator persentase ketercapaian iuran bulan berjalan.
   - **Pantauan Belum Setor (Wall of Unpaid)**: Menampilkan siapa saja anggota yang belum bayar kas beserta rincian bulan apa saja yang tertunggak.
   - **Arus Kas Bulanan**: Grafik batang & garis interaktif (Pemasukan, Pengeluaran, dan Saldo Berjalan).
   - **Matriks Iuran Interaktif (Heatmap)**: Tabel status iuran per bulan (Lunas, Cicil, Belum Bayar, Belum Bergabung).
   - **Komposisi Pengeluaran & Pemasukan (Donut Chart)**: Visualisasi proporsi kategori transaksi.
   - **Leaderboard Top Setor**: Peringkat anggota paling rajin dan taat bayar kas.
   - **Daftar Jajan Terbesar & Metode Pembayaran**: Analisa pengeluaran tertinggi dan channel transaksi favorit (Tunai, BCA, ShopeePay, dll).

2. **Sistem Role & Akses Tamu (Guest Mode)**:
   - **👑 Super Admin**: Akses penuh ke seluruh fitur, kelola akun pengguna (tambah/edit/hapus Admin & Super Admin), serta konfigurasi parameter kas (nominal iuran default, saldo awal, periode, dll).
   - **🛡️ Admin**: Akses pencatatan kas, edit/hapus transaksi, pencatatan iuran, dan pengelolaan anggota.
   - **👀 Mode Tamu (Login as Guest)**: Siapapun tanpa akun bisa masuk dengan 1 klik untuk melihat dashboard estetis, transparansi kas, dan daftar siapa saja yang belum bayar iuran.

3. **Form Pembayaran Kas Pintar**:
   - Nominal iuran **paten default Rp 20.000 per bulan** (bisa disesuaikan nominalnya langsung di form saat input).
   - Mendukung pembayaran sekaligus banyak bulan (multi-month selection) otomatis membuat voucher berurutan.
   - Auto-suggest bulan tunggakan tertua atau nominal kekurangan jika statusnya mencicil.

4. **Fitur Tagih Santai via WhatsApp**:
   - Generator pesan WhatsApp otomatis dengan gaya bahasa ramah ala Gen Z untuk mengingatkan anggota yang belum setor kas.

5. **Responsif di Semua Skala**:
   - **Desktop**: Glass sidebar navigasi penuh + bento grid 12 kolom.
   - **Tablet**: Sidebar otomatis berubah menjadi compact icon-rail.
   - **Mobile (Smartphone)**: Floating bottom navigation bar, touch-friendly horizontal swipe matrix, dan bottom-sheet modal.

---


## 🚀 Cara Menjalankan

### Persyaratan:
- Node.js versi 24.22.1 (atau v20+)
- Koneksi internet untuk MongoDB Atlas

### 1. Mode Production (Satu Server Backend + Frontend)
```bash
# Build frontend React ke folder dist/
npm run build

# Jalankan server Express (otomatis serve API dan Frontend di port 5050)
npm start
```
Buka di browser: **[http://localhost:5050](http://localhost:5050)**

### 2. Mode Development (Hot-Reload)
```bash
npm run dev
```
Perintah ini menjalankan server backend (`node --watch server/index.js`) di port 5050 dan Vite dev server di **[http://localhost:5173](http://localhost:5173)** secara bersamaan dengan auto-proxy.

### 3. Reset Data ke Data Spreadsheet Awal
Jika ingin mengembalikan seluruh data kas persis seperti di Google Spreadsheet:
```bash
npm run seed:reset
```

---

## 📁 Struktur Direktori

```
KasKita/
├── .env                  # Konfigurasi MongoDB URI & JWT Secret
├── package.json          # Dependency frontend & backend jadi satu
├── vite.config.js        # Konfigurasi build React ke dist/
├── server/               # Backend Express.js
│   ├── index.js          # Entry point server (API + Static Frontend)
│   ├── routes.js         # Endpoint REST API & Auth JWT
│   ├── models.js         # Mongoose Schema (User, Member, Transaction, Settings)
│   ├── dashboard.js      # Agregasi data & perhitungan iuran
│   ├── seed.js           # Normalisasi data Google Sheets 2026
│   └── utils.js          # Helper tanggal & bulan (Asia/Jakarta)
└── client/               # Frontend React.js
    ├── index.html        # Shell HTML dengan font Google Inter/Space Grotesk
    └── src/
        ├── index.css     # Design System (tokens, bento, glassmorphism, responsive)
        ├── main.jsx      # React Root mount
        ├── App.jsx       # Routing & Protected / Guest routes
        ├── components/
        │   ├── Layout.jsx    # Glass sidebar / Bottom nav layout
        │   ├── Forms.jsx     # Form transaksi & modal bayar kas (Rp 20.000 default)
        │   ├── Charts.jsx    # Cashflow chart, donut, ring progress, dues heatmap
        │   └── ui.jsx        # Modal, MoneyInput, Confirm, Avatar, TagInput
        ├── pages/
        │   ├── Dashboard.jsx    # Dashboard utama
        │   ├── Transactions.jsx # Buku kas & filter transaksi + export CSV
        │   ├── Dues.jsx         # Matriks iuran & WhatsApp reminder
        │   ├── Members.jsx      # Kelola 12 anggota kas
        │   ├── Settings.jsx     # Pengaturan kas & kelola pengguna
        │   └── Login.jsx        # Split-screen login & tombol Tamu
        └── lib/
            ├── api.js        # Fetch client dengan token auth
            ├── context.jsx   # Auth, Theme, dan Toast provider
            └── format.js     # Helper Rupiah, compact number, Indonesian month
```
