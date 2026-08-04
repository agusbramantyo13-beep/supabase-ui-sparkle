# Redesain Setoran Kas — Filter Periode + Agregasi Sisi Database

## 1. Kondisi saat ini (hasil pembacaan kode & database)

`src/pages/CashDeposits.tsx` memuat semuanya sekali jalan di `loadData()`, tanpa filter periode:

- `cash_deposits`: ambil semua baris toko (`select *`), lalu total Disetujui & Menunggu dihitung di React (`.reduce()`).
- `sales`: ambil SEMUA transaksi cash/split sepanjang sejarah dengan paginasi manual 1000 baris/halaman (loop `while(true)`), lalu difilter `status !== 'returned'` di klien, lalu dijumlahkan di klien. Untuk `split`, porsi tunai diambil dari `payment_details.cash_amount` (JSON).
- `other_sales`: ambil semua baris, dijumlahkan di klien.
- `store_expenses`: ambil semua baris berstatus `approved`, dijumlahkan di klien.
- "Kas Fisik Hari Ini" dihitung dengan memfilter array hasil fetch di klien.
- Tabel riwayat menampilkan seluruh pengajuan, tanpa paginasi UI.

Artinya: 100% agregasi dilakukan di browser. Dengan jutaan transaksi ini akan gagal (memori + waktu unduh).

Fakta database yang dikonfirmasi:
- `sales`: 1.499 baris, 4 split, 0 status NULL. Kolom waktu: `created_at`.
- `other_sales` (14), `store_expenses` (128), `cash_deposits` (58).
- Kolom tanggal: `other_sales.sale_date`, `store_expenses.expense_date`, `cash_deposits.deposit_date` (tapi UI sekarang mengurut/menampilkan `submitted_at`).
- Index yang sudah ada: `sales(store_id, created_at DESC)`, `sales(store_id)`, `cash_deposits(store_id)`, `(status)`, `(deposit_date)`. **`other_sales` dan `store_expenses` tidak punya index sama sekali selain primary key.**

## 2. Yang akan dibangun

**Filter periode global** di atas halaman: Hari Ini, Kemarin, Minggu Ini, Bulan Ini, Tahun Ini, Semua, Custom (tanggal awal + akhir). Label periode aktif ditampilkan jelas di sebelahnya ("1 Agustus 2026 – 31 Agustus 2026").

Semua angka mengikuti filter: Total Penjualan Tunai, Sudah Disetor, Menunggu, Belum Disetor, dan tabel riwayat pengajuan. Kartu "Kas Fisik Hari Ini" tetap selalu hari ini (kartu terpisah yang memang bermakna harian) — sisanya periode-scoped.

Rumus tidak berubah, hanya jendela waktunya:
`Belum Disetor = Penjualan Tunai (periode) − Setoran Disetujui (periode) − Belanja Toko Approved (periode)`

## 3. Pendekatan query: RPC, bukan agregat PostgREST

Rekomendasi: **satu fungsi Postgres `get_cash_deposit_summary(p_store_id, p_start, p_end)`** yang mengembalikan satu baris berisi semua total.

Alasan:
- Porsi tunai transaksi `split` harus diambil dari JSON (`payment_details->>'cash_amount'`). Agregat PostgREST tidak bisa melakukan ekspresi CASE + cast JSON ini; RPC bisa.
- Empat tabel berbeda = empat request PostgREST terpisah; RPC = satu request, satu round-trip, angka-angka konsisten pada satu titik waktu.
- Pola ini sudah dipakai di proyek (`get_profit_summary`, dll) dengan `SECURITY DEFINER` + pengecekan otorisasi eksplisit, jadi konsisten dengan arsitektur yang ada.
- Filter status (`status IS DISTINCT FROM 'returned'`) aman ditulis di SQL tanpa jebakan NULL.

Otorisasi: fungsi memeriksa keanggotaan toko (`store_members` / `is_developer`) — **tidak** mengubah RLS yang ada, hanya menegakkan aturan yang sama di dalam fungsi.

Tabel riwayat pengajuan tetap query PostgREST biasa dengan `.gte()/.lte()` pada rentang tanggal + `.range()` untuk paginasi (paginasi UI ditambahkan, mis. 20 baris/halaman) — bukan agregat, jadi tidak perlu RPC.

### Bentuk keluaran RPC
`total_cash_sales, total_other_sales, total_approved_deposits, total_pending_deposits, total_approved_expenses, today_cash` — Belum Disetor dihitung dari ini (di SQL atau di UI, satu baris aritmetika).

## 4. Migrasi index yang diusulkan

```sql
-- sales: sudah ada (store_id, created_at DESC) → cukup untuk rentang tanggal.
-- Tambahan opsional untuk mempersempit ke transaksi tunai saja:
CREATE INDEX idx_sales_store_cash_created
  ON public.sales (store_id, created_at DESC)
  WHERE payment_method IN ('cash','split');

-- other_sales: belum ada index sama sekali
CREATE INDEX idx_other_sales_store_date
  ON public.other_sales (store_id, sale_date);

-- store_expenses: belum ada index sama sekali
CREATE INDEX idx_store_expenses_store_status_date
  ON public.store_expenses (store_id, status, expense_date);

-- cash_deposits: ada index terpisah per kolom; komposit lebih efektif
CREATE INDEX idx_cash_deposits_store_submitted
  ON public.cash_deposits (store_id, submitted_at DESC);
CREATE INDEX idx_cash_deposits_store_status_date
  ON public.cash_deposits (store_id, status, deposit_date);
```

Alasan: setiap query selalu difilter `store_id` + rentang tanggal (+ status untuk expenses/deposits). Index komposit dengan urutan itu membuat Postgres melakukan index range scan, bukan sequential scan yang biayanya tumbuh linear terhadap jutaan baris. Index parsial pada `sales` menghindari memindai transaksi non-tunai.

## 5. Risiko yang perlu dicatat (halaman keuangan aktif)

- **Kolom tanggal untuk setoran ambigu**: `deposit_date` (tanggal setoran) vs `submitted_at` (waktu pengajuan). UI sekarang memakai `submitted_at`. Saya akan memakai `submitted_at` untuk konsistensi dengan tampilan sekarang, kecuali Anda minta sebaliknya — ini bisa mengubah angka jika keduanya sering berbeda hari.
- **Zona waktu**: `created_at` adalah timestamptz, sedangkan filter berbasis tanggal lokal (WIB). Batas hari harus dihitung eksplisit di WIB agar transaksi malam tidak jatuh ke hari berikutnya. Ini area paling rawan salah hitung.
- **Perubahan makna angka**: "Belum Disetor" saat ini all-time. Setelah periode-scoped, angkanya akan tampak lebih kecil dan bisa dikira uang hilang. Perlu label jelas, dan opsi "Semua" tetap tersedia sebagai pembanding.
- **Split payment**: hanya 4 baris hari ini, tapi logika JSON harus persis sama dengan versi klien agar tidak ada selisih.
- Alur persetujuan, hak akses, RLS, dan `Sales.tsx` tidak disentuh sama sekali.

## 6. Rollout & verifikasi

1. Buat index + RPC lebih dulu (tidak mengubah UI, tidak berdampak ke pengguna).
2. Verifikasi paritas: jalankan RPC dengan periode "Semua" dan bandingkan angkanya dengan angka yang tampil di halaman sekarang — harus identik rupiah demi rupiah.
3. Uji silang beberapa periode (hari ini, kemarin, bulan ini) dengan query SQL manual sebagai kontrol.
4. Baru kemudian ganti UI, dengan default filter "Bulan Ini".
5. Cek visual di preview (termasuk tampilan mobile) sebelum publish.

Setujui, dan saya mulai dari migrasi index + RPC, lalu verifikasi paritas angka sebelum menyentuh UI.
