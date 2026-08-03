# Redesain UI Menyeluruh — KENZHO POS (presentation only)

Mengikuti panduan skill "ui-ux-pro-max": pola Data-Dense / Real-Time Operations, flat design ringan, satu warna aksi utama, warna status hanya untuk status, angka tabular, kepadatan sesuai peran, plus checklist aksesibilitas.

## Arah desain global (fondasi)

- **Token warna** (`src/index.css`): pertahankan tema gelap, ganti aksen cyan terang jadi satu primary yang tenang & tepercaya (slate/teal gelap), `--success` / `--warning` / `--destructive` dipakai HANYA untuk status (lunas, stok menipis, gagal sync, retur). Hapus penggunaan `text-white` hardcoded (mis. `AppSidebar`) jadi token sidebar.
- **Tipografi**: satu keluarga sans (Inter/Public Sans) untuk UI; utilitas `.tabular-nums` untuk semua kolom harga/qty/total agar angka sejajar.
- **Density scale**: kelas tabel/kartu standar (padding, tinggi baris 40px desktop / 48px sentuh), tinggi tombol minimum 44px untuk aksi kasir.
- **Transisi**: 100–200ms, hormati `prefers-reduced-motion`.
- **Header & layout** (`src/App.tsx`): header 56px dengan nama toko + peran + jam, `<main>` tunggal, padding responsif (p-3 mobile / p-6 desktop).
- **Sidebar** (`AppSidebar.tsx`): pengelompokan menu (Operasional / Inventori / Keuangan & Laporan / Administrasi), item aktif pakai token, label sr-only saat collapsed.

## Per layar

| Layar | Perubahan visual/layout |
| --- | --- |
| `Sales.tsx` (kasir) | Layout dua kolom tetap: grid produk kiri (kartu lebih rapat, gambar aspect-square, nama 2 baris, harga tabular, badge stok status-warna), keranjang kanan jadi panel sticky dengan total besar & tombol "Selesaikan" full-width ≥56px. Search bar sticky, kategori jadi chip horizontal scroll. Dialog checkout dirapikan jadi ringkasan → metode bayar → tombol. Target tap ≥44px. |
| `Index.tsx` / `Dashboard.tsx` | Bento grid KPI: 4 StatCard atas (omzet, transaksi, profit, stok kritis) dengan angka tabular besar, di bawah grafik + daftar stok menipis. Warna hanya untuk status stok. |
| `Products.tsx` | Toolbar (search + filter kategori + tombol tambah), tabel padat dengan kolom harga/modal tabular, badge varian, aksi ikon berlabel aria. Mobile: kartu list. |
| `ProductForm.tsx`, `AddVariantDialog.tsx`, `CategoryForm.tsx` | Dialog dengan section header, grid 2 kolom di desktop, label konsisten, error inline. |
| `Inventory.tsx`, `StockPurchaseForm.tsx`, `StockUploadForm.tsx`, `StockAdjustmentForm.tsx`, `InventoryForm.tsx` | Tabel padat + zebra ringan, kolom qty tabular, warna stok (merah/kuning/normal) hanya sebagai status, picker pencarian dirapikan. |
| `StockTransfer.tsx`, `StockHistory.tsx`, `StockAdjustmentReport.tsx`, `PurchaseReport.tsx` | Pola halaman laporan seragam: bar filter (tanggal/toko/pencarian) → ringkasan → tabel → tombol ekspor kanan atas. |
| `TransactionHistory.tsx` | Date picker + ringkasan hari, baris transaksi padat, modal nota dibuat menyerupai struk (mono, lebar tetap), badge status retur/void. |
| `CashDeposits.tsx`, `StoreExpenses.tsx`, `OtherSales.tsx` | Kartu rekonsiliasi dengan angka tabular sejajar, pemisah jelas antara omzet vs kas fisik, form input pakai keypad yang sudah ada. |
| `Reports.tsx` + `ProfitDashboard.tsx`, `SalesByCategoryReport.tsx`, `MemberTransactionReport.tsx` | Tab yang konsisten, filter rentang tanggal seragam, kartu KPI + chart pakai palet token (bukan warna acak), tabel drill-down padat. |
| `Members.tsx`, `MemberCombobox.tsx`, `LoyaltyPointForm.tsx`, `PointRedemptionForm.tsx` | Tabel member padat + badge poin, form dialog seragam. |
| `Discounts.tsx`, `DiscountForm.tsx`, `BundlePromoForm.tsx` | Daftar promo jadi kartu ringkas (syarat qty/nominal sebagai badge), form panjang dibagi jadi section. |
| `Users.tsx` | Tabel pengguna dengan badge peran (warna netral, bukan status), aksi ikon berlabel. Tampilan tombol admin tetap mengikuti pengecekan peran yang ada. |
| `StoreSelection.tsx` | Grid kartu toko, kartu terpilih ditandai border primary. |
| `Attendance.tsx` | Panel kamera lebih besar, tombol check-in besar, riwayat di samping/di bawah. |
| `Settings.tsx` | Tab/section: Printer, Desain Struk, Preferensi. Pratinjau struk dalam bingkai 58mm. |
| `Auth.tsx` | Kartu login terpusat, kontras & fokus jelas. |
| `NotFound.tsx`, `OAuthConsent.tsx` | Penyelarasan gaya minor. |
| `CurrencyKeypadInput.tsx` | Tombol keypad lebih besar (≥56px), angka tabular, feedback tekan cepat. |
| `StatCard.tsx`, `ProductImage.tsx` | Varian ukuran (compact/default), angka tabular, skeleton loading. |

## Yang TIDAK disentuh (dikonfirmasi)

Rencana ini murni presentasi: JSX layout, className, token CSS, varian komponen. Tidak ada perubahan pada:
- logika bisnis (perhitungan MAC, profit, diskon, loyalty, rekonsiliasi kas, proses checkout);
- kebijakan RLS, migrasi, atau skema database;
- edge functions (`admin-create-user`, `admin-delete-user`, `admin-reset-password`, `mcp`);
- pengecekan izin peran (`RoleBasedRoute`, `ProtectedRoute`, `StoreRequiredRoute`, cek `userStoreRole` di dalam halaman) — kondisi render tetap sama persis, hanya tampilannya yang berubah;
- perilaku fitur, query, atau bentuk data.

## Layar berisiko (perlu review khusus sebelum dieksekusi)

1. **`Sales.tsx` (1.530 baris)** — checkout, split payment, bundling, loyalty menempel erat pada JSX. Risiko tertinggi; dikerjakan sendiri dan diuji end-to-end.
2. **Komponen bersama lintas peran** — `AppSidebar` (filter menu per peran), `StatCard`, `CurrencyKeypadInput`, `MemberCombobox`, `ProductImage`. Perubahan di sini terlihat di banyak layar; hanya menambah prop tampilan opsional dengan default = perilaku sekarang.
3. **`Users.tsx` & `Members.tsx`** — tombol dirender kondisional berdasarkan peran; kondisi harus disalin apa adanya.
4. **`ProfitDashboard.tsx` / `Reports.tsx`** — banyak chart & ekspor Excel/PDF; perubahan warna chart tidak boleh menyentuh pemetaan data ekspor.
5. **`Settings.tsx` + printer Bluetooth** — pratinjau struk terhubung ke logika ESC/POS; hanya bingkai pratinjau yang diubah.
6. **`CashDeposits.tsx`** — perhitungan rekonsiliasi sensitif; hanya format tampilan angka.

## Urutan rollout (aman untuk aplikasi live)

Bertahap, satu tahap per rilis, bukan sekaligus:

1. **Fondasi** — token warna, tipografi, utilitas density, header + sidebar. Perubahan global, mudah di-rollback.
2. **Layar risiko rendah, dampak tinggi** — Dashboard, Reports/Profit, StoreSelection, Auth, NotFound.
3. **Layar inventori & laporan** — Products, Inventory, StockTransfer, StockHistory, PurchaseReport, StockAdjustmentReport.
4. **Keuangan** — CashDeposits, StoreExpenses, OtherSales, TransactionHistory.
5. **Admin & pendukung** — Users, Members, Discounts, Settings, Attendance.
6. **Terakhir: `Sales.tsx`** — layar kasir, dipakai terus-menerus; dikerjakan sendirian, diverifikasi dengan uji checkout (tunai, kartu, split, diskon, bundling, member) sebelum publish, idealnya di luar jam sibuk.

Setiap tahap diakhiri checklist: kontras ≥4.5:1, fokus keyboard terlihat, target tap ≥44px, tanpa emoji sebagai ikon, angka tabular, breakpoint 375/768/1024 diperiksa.
