# Audit diskon, profit, dan WIB — temuan dahulu, rencana kemudian

**Status: analisis saja. Tidak ada kode aplikasi, migration, data, RPC, atau view yang diubah.** Bukti SQL dibaca langsung dari Supabase produksi melalui `read_query`, `pg_get_functiondef`, dan `pg_get_viewdef` pada 10 Oktober 2026 sekitar 16:01–16:03 UTC. Rencana di bagian D belum dijalankan.

## A. Diskon saat checkout

### 1. Jenis diskon yang benar-benar diterapkan

- **Diskon nota ada:** `getDiscountAmount()` menghitung diskon terpilih atas seluruh subtotal, atau subtotal produk/kategori yang cocok, dengan syarat jumlah/nominal. Walaupun ditargetkan ke produk/kategori, hasilnya tetap dikurangkan pada tingkat nota, **tidak dialokasikan ke item** (`Sales.tsx:583–622`).
- **Penukaran poin juga potongan nota:** persen dari subtotal (dengan batas `max_discount`) atau nominal tetap (`Sales.tsx:346–366`). Pemilihan member sendiri tidak menambah potongan terpisah pada rumus total.
- **Bundle berbeda:** item gratis masuk keranjang dengan `price: 0`, `subtotal: 0`, tetapi tetap punya jumlah dan biaya modal. Tidak masuk nominal `discount_total` (`Sales.tsx:448–462`). Dampak item gratis terhadap profit sudah tercermin melalui pendapatan nol dan modalnya.
- Jalur checkout saat ini **tidak menulis diskon item bernominal**: `sale_items.discount` selalu `0`. Ini tidak berarti SQL mengabaikan diskon item historis; lihat B.

### 2. Rumus nota: ada perbedaan online versus offline

Definisikan `S = jumlah item.subtotal`, `D = getDiscountAmount()`, `R = getRedemptionDiscount()`.

```ts
// Sales.tsx:579–581, 624–626
return cart.reduce((total, item) => total + item.subtotal, 0);
return getSubtotal() - getDiscountAmount() - getRedemptionDiscount();

// Online: Sales.tsx:742–745, 792–796
const discountAmount = getDiscountAmount();
subtotal: subtotal,
total: total,
discount_total: discountAmount,
tax_total: 0,

// Offline: Sales.tsx:651–653, 685–689
const discountTotal = getDiscountAmount() + getRedemptionDiscount();
discount_total: discountTotal,
tax_total: 0,
redeemed_points: redemption?.points_required || 0,
```

| Kolom | Online | Offline/sync |
|---|---|---|
| `sales.subtotal` | `S` | `S` |
| `sales.discount_total` | `D` saja | `D + R` |
| `sales.tax_total` | `0` | `0` dari POS |
| `sales.total` | `S − D − R` | `S − D − R` |

**Jadi online tidak selalu memenuhi `total = subtotal − discount_total + tax_total`: ketika ada redemption, nominal R tidak masuk `discount_total`.** Offline memenuhi rumus itu dan RPC memvalidasinya:

```sql
-- public.sync_offline_sale, definisi produksi
IF abs(v_subtotal - v_computed_subtotal) > 0.01
 OR v_discount_total < 0 OR v_tax_total < 0
 OR abs(v_total - (v_subtotal - v_discount_total + v_tax_total)) > 0.01
 OR v_total < 0 THEN
 RAISE EXCEPTION 'Ringkasan total transaksi tidak konsisten';
END IF;
```

`discount_total` **bukan** jumlah `sale_items.discount`. Ia menyimpan potongan nota, dengan kekurangan pencatatan redemption pada jalur online.

### 3. Item, modal, dan alokasi

```ts
// Sales.tsx:819–830, online
unit_price: item.product.price,
cost_price: item.product.average_cost ?? item.product.cost_price ?? 0,
total: item.subtotal,
discount: 0,
```

Item berbayar: `item.subtotal = price × quantity` (`Sales.tsx:564`). Item bundle gratis: harga dan total nol. **Total item saat ini belum dipotong diskon nota/poin.** Tidak ada alokasi diskon nota ke item.

RPC offline juga mensyaratkan `item.total = quantity × unit_price` (toleransi 0,01), lalu menyimpan:

```sql
v_cost := COALESCE(v_variant.average_cost, v_variant.cost_price, 0);
-- INSERT sale_items: cost_price, discount, total
-- nilainya:
v_cost, 0, v_item_total
```

Modal online berasal dari varian yang dimuat POS; offline mengambil moving-average **saat sync**. Keduanya disimpan sebagai snapshot `sale_items.cost_price`; laporan tidak membaca ulang modal varian sekarang. Jangan mengubah snapshot modal historis dalam perbaikan profit.

### 4. Poin ditukar tersimpan di mana?

- Mengurangi total sebesar `R` pada kedua jalur.
- Online mengurangi `members.points` dengan `points_required`, menambah poin diperoleh, dan menyimpan `sales.member_points_after` (`Sales.tsx:862–907`). **Tidak menyimpan nominal redemption atau jumlah poin ditukar pada kolom sale/payment_details.** Snapshot saldo akhir tidak cukup untuk merekonstruksi rincian redemption dengan pasti.
- Offline menyimpan `redeemed_points` dalam payload antrean. RPC mengurangi poin sebanyak `LEAST(redeemed_points, saldo sebelum sync)`, menghitung poin diperoleh, lalu menyimpan saldo akhir. Nominal uangnya tergabung dalam `sales.discount_total`; jumlah poin ditukar tidak disimpan sebagai kolom khusus sales.
- Definisi kolom sales produksi dan isi `payment_details` yang diperiksa mengonfirmasi tidak ada catatan khusus redemption tersebut.

## B. SQL profit produksi dan selisih nyata

### Definisi yang dipakai semua laporan profit

Potongan aktual `v_sale_item_profit`:

```sql
SELECT ..., si.quantity, si.cost_price, si.unit_price,
       si.discount, si.total,
       si.total - si.cost_price * si.quantity AS profit,
       CASE WHEN si.total > 0
         THEN (si.total - si.cost_price * si.quantity) / si.total * 100
         ELSE 0 END AS margin_pct
FROM sale_items si
JOIN sales s ON s.id = si.sale_id
LEFT JOIN variants v ON v.id = si.variant_id
LEFT JOIN products p ON p.id = v.product_id
-- juga LEFT JOIN profiles dan categories
WHERE s.status IS DISTINCT FROM 'returned';
```

Semua lima RPC memakai view ini dan rumus agregasi yang sama:

```sql
COALESCE(SUM(x.total), 0)                       -- revenue
COALESCE(SUM(x.cost_price * x.quantity), 0)     -- cost
COALESCE(SUM(x.profit), 0)                      -- profit
CASE WHEN SUM(x.total) > 0
 THEN SUM(x.profit) / SUM(x.total) * 100
 ELSE 0 END                                   -- margin agregat
```

| Objek/signature | Pengelompokan/perbedaan | Filter tanggal |
|---|---|---|
| `v_sale_item_profit` | per item; tidak punya filter tanggal sendiri | tidak ada |
| `get_profit_summary(uuid,date,date)` | semua item; transaksi `COUNT(DISTINCT sale_id)` | `>= p_start::timestamptz`, `< (p_end+1)::timestamptz` |
| `get_profit_by_period(uuid,date,date,text)` | `date_trunc(day/week/month, sale_created_at)`; transaksi distinct | batas sama, dibuat lewat dynamic SQL |
| `get_profit_by_category(uuid,date,date)` | kategori; jumlah qty | batas sama |
| `get_profit_by_cashier(uuid,date,date)` | kasir; transaksi distinct | batas sama |
| `get_top_products_profit(uuid,date,date,text,integer)` | produk+varian; ranking profit/margin; `below_cost` hanya profit `<0`; limit | batas sama |

**Status semua sama melalui view:** hanya `returned` dikecualikan; null dan status lain masuk. Data produksi yang diperiksa hanya mempunyai `completed` (3.463) dan `returned` (20). Transaksi tanpa item tidak masuk profit. Retur saat ini mengembalikan semua item dan menandai seluruh nota `returned` (`SalesReturnDialog.tsx:101–145`); SQL ini tidak mempunyai model/filter retur parsial.

**Diskon item:** profit memakai `si.total` langsung. Bila total item sudah net, diskon item sudah tercermin; SQL tidak mengurangi `si.discount` lagi. Pada checkout sekarang, `discount=0`, total item masih sebelum potongan nota. **Diskon nota/poin tidak diperhitungkan oleh profit.** Gratis bundle sudah tercermin; jangan dipotong ulang.

### Hasil produksi 30 hari terakhir

Rentang bergulir query: sekitar **10 September 2026 16:01 UTC sampai 10 Oktober 2026 16:01 UTC**, bukan 30 tanggal kalender. Mengecualikan `returned`, memakai agregasi item per sale sebelum join agar total nota tidak terduplikasi.

| Toko | SUM(total − tax_total) | SUM(item.total) | Selisih item − nota |
|---|---:|---:|---:|
| SEMPOLAN | Rp60.674.000 | Rp60.774.000 | **Rp100.000** |
| SALSA | Rp29.540.000 | Rp29.630.000 | **Rp90.000** |
| MAINAN | Rp1.215.500 | Rp1.234.000 | **Rp18.500** |

Toko lain tidak muncul pada hasil selisih nonnol. Bukti bentuk query:

```sql
WITH ss AS (
 SELECT * FROM sales
 WHERE created_at >= now() - interval '30 days' AND created_at < now()
   AND status IS DISTINCT FROM 'returned'
), it AS (
 SELECT si.sale_id, SUM(si.total) AS item_net
 FROM sale_items si JOIN ss ON ss.id=si.sale_id GROUP BY si.sale_id
)
SELECT s.store_id,
 SUM(s.total-s.tax_total) AS sale_net,
 SUM(COALESCE(it.item_net,0)) AS item_net
FROM ss s LEFT JOIN it ON it.sale_id=s.id
GROUP BY s.store_id
HAVING SUM(COALESCE(it.item_net,0)-(s.total-s.tax_total)) <> 0;
```

**Selisih tidak semuanya bisa disebut diskon:**

- SALSA: tepat Rp90.000 = jumlah diskon nota; tidak ada nota tanpa item atau pelanggaran rumus.
- SEMPOLAN: nota **`RCP-1790752828852`**, 30 September: subtotal/item Rp155.000, total Rp55.000, pajak/diskon tersimpan Rp0. **Potongan tak tercatat Rp100.000.** Kode redemption online menjelaskan kemungkinan pola ini, tetapi penyebab transaksi spesifik tidak bisa dipastikan tanpa catatan redemption; jangan menyebutnya pasti poin.
- MAINAN: nota yang punya item menunjukkan selisih **Rp28.500**, sama dengan diskon tercatat. Ada satu nota tanpa item, **`RCP-1789372713698`**, 14 September, total Rp10.000; menyebabkan selisih semua nota menjadi Rp18.500. Online memang menyimpan sales dan sale_items dalam permintaan terpisah, tetapi penyebab nota kehilangan item ini belum terbukti.
- Dengan populasi **yang sama-sama punya item**, selisih revenue/profit lama versus net nota adalah Rp100.000 / Rp90.000 / Rp28.500. Cost tidak berubah. Dua sale offline produksi tidak memiliki diskon; rumus total keduanya konsisten, belum membuktikan jalur offline redemption dari data nyata.

## C. Zona waktu: Setoran sudah sebagian WIB, frontend belum eksplisit

`current_setting('TimeZone')` produksi = **UTC**. Semua cast tanggal dan `date_trunc` RPC profit mengikuti session ini; belum mengunci WIB.

Bukti `get_cash_deposit_summary` produksi:

```sql
v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
v_today_start := v_today::timestamp AT TIME ZONE 'Asia/Jakarta';
v_today_end := (v_today+1)::timestamp AT TIME ZONE 'Asia/Jakarta';
v_start_date := (p_start AT TIME ZONE 'Asia/Jakarta')::date;
v_end_date := (p_end AT TIME ZONE 'Asia/Jakarta')::date;
-- sales: created_at >= p_start AND created_at < p_end
-- other_sales/expenses: sale_date/expense_date memakai tanggal WIB di atas
```

**Nuansa penting:** `today_cash` pasti WIB; rentang sales/setoran mengikuti timestamp yang dikirim frontend, bukan otomatis dinormalisasi RPC ke tengah malam WIB. `PeriodFilter.tsx:42–85` memakai `setHours`, `getDay`, dan konstruktor Date lokal; `CashDeposits.tsx:125–134` mengirim `range.*.toISOString()`. Jadi preset periode benar WIB hanya jika browser berada di WIB. Pola SQL eksplisit di atas bisa digunakan ulang, bukan menyalin asumsi frontendnya.

Frontend profit (`ProfitDashboard.tsx`):
- `toDateStr = format(d,'yyyy-MM-dd')` (37), `startOfToday/Week/Month` (204–206): bergantung timezone browser.
- `buildDetailQuery` (343–350): awal memakai `startDate.toISOString()` **termasuk jam default saat halaman dibuka**, akhir memakai akhir hari browser.
- `openDrillForRange` (385–397): timestamp absolut dari Date browser, berbeda dengan hari UTC RPC. Label chart/export juga memakai format browser.
- `discountReporting.ts:15–20` sengaja menggunakan batas UTC; harus ikut berubah jika kontrak profit menjadi WIB.
- `Reports.tsx:69–100`: Overview memakai rentang bergulir sampai jam sekarang; chart dikelompokkan menurut browser; parameter profit memakai `toISOString().split('T')[0]` (**tanggal UTC**, bukan tanggal lokal). Periode Overview dan profit belum persis sama, bahkan sebelum perubahan.
- `TransactionHistory.tsx:77–115`: hari browser; belanja berdasarkan `approved_at`. Cash RPC belanja berdasarkan `expense_date`—perbedaan terpisah dari timezone, jangan diubah diam-diam.
- `get_store_expenses_summary` masih memakai `date_trunc('day',now())` UTC dan `approved_at`; perlu audit konsumen bila ingin semua ringkasan WIB. `get_dashboard_sales_summary` menerima batas timestamp apa adanya; tidak butuh mengganti formula, tetapi pemanggil periodenya perlu WIB.

**Dampak nyata WIB:** dalam 30 hari tadi, dua sale MAINAN (`RCP-1791158128878`, `RCP-1791158286276`) terjadi 4 Oktober 23:55/23:58 UTC = **5 Oktober 06:55/06:58 WIB**, total gabungan Rp88.000. Keduanya pindah hari dan minggu (Minggu ke Senin); tidak ada perpindahan bulan pada sampel ini. Nominal profit yang berpindah mengikuti modal/itemnya, bukan otomatis Rp88.000.

## D. Rencana perubahan aman — belum dieksekusi

### 1. Rekonsiliasi tanpa diskon dihitung dua kali

Pertahankan semua penjumlahan sekarang. Pembayaran tunggal memakai `sales.total` (sudah net); split memakai komponen `payment_details` (`TransactionHistory.tsx:366–393`). Tambahkan baris **“Diskon diberikan — sudah termasuk dalam total net”** sebagai informasi, tidak menjadi pengurang lagi pada Total Omzet/Kas Fisik.

Catatan split: checkout mengizinkan komponen bayar lebih besar daripada total dan menyimpan change terpisah; rekonsiliasi menjumlah komponen mentah. Sampel produksi 30 hari: 12 split, semuanya komponen=total. Jangan sekaligus mengubah kebijakan kembalian split dalam pekerjaan diskon.

### 2. Profit aktual: versi baru dahulu, bukan mengganti langsung

- Buat migration baru untuk **view profit v2 dan lima RPC v2**, kontrak hasil serupa, keamanan/grants setara. Biarkan objek lama dan semua laporan lama tetap berjalan; jangan mengubah harga, checkout, stok, poin, struk, atau data historis pada fase ini.
- Gunakan pendapatan nyata nota tanpa pajak `N = sales.total − tax_total`, snapshot modal tetap. Untuk membagi ke produk/kategori, mulai dari total item `I = SUM(si.total)`, selisih `G = I − N`; alokasikan G proporsional total net item. Ini menangkap potongan nota dan pengurangan tak tercatat tanpa mengurangi diskon item dua kali.
- Jangan mengurangi `sales.discount_total` begitu saja: ada redemption online yang tidak tercatat dan bundle gratis yang sudah nol. Jangan otomatis menyebut seluruh G “diskon” jika data tidak konsisten.
- Kebijakan wajib sebelum implementasi: item gratis tetap revenue nol/modal penuh; pembulatan allocation menyisakan residu pada satu item deterministik agar jumlah tepat N; `I=0`, selisih negatif, nota tanpa item, dan data rusak masuk pengecualian yang terlihat—jangan membagi nol, menebak modal, atau diam-diam membuangnya.
- Nota tanpa item MAINAN tetap perlu ditelusuri; profitnya belum bisa dihitung andal. Laporan aktual harus menunjukkan jumlah/nilai nota bermasalah, bukan mengarang profit.
- Alihkan **semua** kartu/grafik/kategori/kasir/top produk/detail/drill/export v2 bersama ke sumber yang sama. `Reports` KPI profit ikut; pendapatan lain-lain tetap tidak masuk profit. Jangan menggabungkan ringkasan v2 dengan rincian lama.
- Data lama tidak ditulis ulang, tetapi laporan v2 akan menghitung ulang seluruh sejarah sesuai pendapatan net; angka profit historis dan peringkat/margin dapat berubah. Versi lama tetap tersedia sebagai pembanding.

### 3. WIB sebagai perubahan terpisah

Pada versi baru, semua lima RPC memakai:
```sql
sale_created_at >= (p_start::timestamp AT TIME ZONE 'Asia/Jakarta')
AND sale_created_at < ((p_end+1)::timestamp AT TIME ZONE 'Asia/Jakarta')
-- bucket, tetap menghasilkan timestamptz:
date_trunc(p_group_by, sale_created_at AT TIME ZONE 'Asia/Jakarta')
  AT TIME ZONE 'Asia/Jakarta'
```
Minggu mulai Senin. Gunakan tanggal kalender WIB dan batas `[start,end)` yang sama untuk frontend Profit, diskon tambahan, drill-down, detail, export, serta label. `sale_created_at`/`created_at` historis tidak diubah.

Audit lanjutan terpisah: PeriodFilter/pemanggil Setoran dan Dashboard, tanggal Riwayat, grouping Overview, serta `get_store_expenses_summary`. Perubahan shared PeriodFilter berdampak lintas halaman, sehingga jangan digabung tanpa pengujian. Overview juga perlu keputusan eksplisit: mempertahankan rolling-window atau memakai hari kalender; status returned saat ini tidak difilter di Overview, jangan disamakan diam-diam.

WIB hanya menggeser keanggotaan periode/bucket, bukan nilai sale/modal. Seluruh sejarah dengan rentang tak terbatas tidak berubah karena timezone saja; hari/minggu/bulan atau rentang terbatas bisa berubah.

### 4. Rollout dan rollback

1. Tetapkan kebijakan alokasi/pengecualian, telusuri dua nota anomali; simpan definisi SQL lama dan hasil baseline spesifik untuk perbandingan.
2. Tambahkan v2 dengan **profit net tetapi UTC dahulu**; pengujian diskon/item gratis/poin/retur/null/pembulatan dan isolasi toko. Bandingkan seluruh agregasi dan detail pada periode/toko identik.
3. Tambahkan/aktifkan WIB pada v2 secara terpisah; uji batas 23:59:59–00:00 WIB, Senin, pergantian bulan/tahun, browser UTC/WIB/WITA/WIT, dan sale offline terlambat sync. Pastikan pagination tidak memotong pembandingan.
4. Validasi owner dengan laporan lama dan aktual berdampingan; kemudian alihkan satu set laporan konsisten. Uji Excel/PDF, drill-down, HP dan build/TypeScript sebelum rollout. Pengujian kasir terautentikasi perlu akses pengujian yang sah; saat ini tidak diasumsikan tersedia.
5. **Rollback:** kembalikan seluruh laporan ke RPC/view lama dan helper periode lama sekaligus; v2 boleh tetap tidak dipakai. Bila kelak memilih `CREATE OR REPLACE` signature lama, lakukan hanya setelah validasi v2 dan siapkan migration pemulihan definisi asli. Tidak perlu rollback data transaksi karena rencana ini tidak menulis ulangnya.

**Rekomendasi:** jangan langsung mengganti profit lama. Temuan produksi menunjukkan bukan hanya diskon, tetapi juga pengurangan tak tercatat dan nota tanpa item; pisahkan koreksi profit, WIB, dan perbaikan pencatatan checkout sebagai keputusan berbeda.