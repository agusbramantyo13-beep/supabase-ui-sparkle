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

## Langkah 2 — pemeriksaan awal 10 Oktober 2026, penerapan dihentikan

Tidak ada migration atau objek v2 dibuat. Pemeriksaan baca-saja menemukan kegagalan pada kebijakan alokasi yang diminta; sesuai instruksi, penerapan dihentikan sebelum menyentuh database atau frontend.

### Penghalang yang harus diputuskan

1. Pembulatan biasa ke dua desimal + seluruh residu ke satu item dapat menghasilkan pendapatan item negatif. CTE produksi: empat item masing-masing 0,01, I=0,04, N=0,02. ROUND tiap alokasi menghasilkan 0,01; residu -0,02 pada item pertama menghasilkan [-0,01; 0,01; 0,01; 0,01]. Jumlah tepat N tetapi satu item negatif.
2. Identitas N=I tidak selalu terjaga untuk data pecahan di bawah dua desimal: dua item masing-masing 0,006, N=I=0,012 menghasilkan [0,002; 0,01], dua item berbeda dari lama. Data produksi saat audit tidak mempunyai pecahan item di bawah dua desimal, tetapi kebijakan umum masih gagal.
3. N yang memiliki pecahan di bawah dua desimal tidak dapat sekaligus memiliki semua item dua desimal dan jumlah persis N: I=1, N=1,005 berada dalam toleransi 0,01, namun residu membuat item 1,005. Jangan mengubah kebijakan tanpa persetujuan.
4. Role alat read_query adalah supabase_read_only_user. Pemanggilan langsung get_profit_summary ditolak `permission denied for function get_profit_summary`. Tidak menambah grant, memalsukan sesi, atau melewati akses. Pembandingan di bawah adalah SQL simulasi/CTE, bukan eksekusi RPC v2.

### Bukti objek lama tidak berubah selama audit

MD5 pg_get_viewdef/pg_get_functiondef sebelum dan sesudah pemeriksaan sama:

| Objek | MD5 |
|---|---|
| v_sale_item_profit | 835430e5863e97d584812e8a49a5d1cb |
| get_profit_summary | 213f7e0e0586dea2e2a5022c4a3cbd79 |
| get_profit_by_period | edc7eba9d317433f625def7ce7a0c5ee |
| get_profit_by_category | 86dc254c75f850539f63c13da6074bac |
| get_profit_by_cashier | 59c8fba05cc38497b073abcf8323def7 |
| get_top_products_profit | c76fbb196187ab308d43224ab2c35488 |

Produksi UTC. View security_invoker=true; owner postgres; grants semua hak view untuk postgres, anon, authenticated, service_role. RPC STABLE SECURITY DEFINER, search_path=public; EXECUTE hanya postgres, authenticated, service_role. Definisi dibaca langsung dari katalog produksi, bukan migration lama.

### Simulasi data nyata — bukan RPC v2

30 tanggal kalender UTC: [2026-09-11 00:00 UTC, 2026-10-11 00:00 UTC), sesuai input date RPC; tidak disebut rentang 30 hari bergulir. Seluruh riwayat juga dibandingkan dengan view lama menggunakan [2025-09-02, 2026-10-11) UTC. Status returned dikecualikan. Modal dan transaksi simulasi sama dengan agregasi view lama yang dibaca terpisah.

| Periode | Toko | Revenue lama | Revenue simulasi | Cost sama | Profit lama | Profit simulasi | Transaksi sama | Penurunan revenue/profit |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 30 tanggal | MAINAN | 1234000 | 1205500 | 760881,10 | 473118,90 | 444618,90 | 52 | 28500 |
| 30 tanggal | SALSA | 29630000 | 29540000 | 22892650 | 6737350 | 6647350 | 274 | 90000 |
| 30 tanggal | SEMPOLAN | 60774000 | 60674000 | 45080004,07 | 15693995,93 | 15593995,93 | 640 | 100000 |
| 30 tanggal | TIRIS | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Seluruh | MAINAN | 4532000 | 4397500 | 2871836,10 | 1660163,90 | 1525663,90 | 172 | 134500 |
| Seluruh | SALSA | 41935000 | 41785000 | 32374600 | 9560400 | 9410400 | 384 | 150000 |
| Seluruh | SEMPOLAN | 290224000 | 289779003 | 193808798,15 | 96415201,85 | 95970204,85 | 2862 | 444997 |
| Seluruh | TIRIS | 2150000 | 2050000 | 1290000 | 860000 | 760000 | 15 | 100000 |

Pada kedua periode, simulasi data nyata menghasilkan 0 item negatif, 0 selisih jumlah alokasi terhadap N >0,005, 0 item berbeda saat N=I, dan 0 nota anomali dengan item. Ini tidak menghapus kegagalan uji sintetis. Jumlah aktif seluruh riwayat: MAINAN 173 (172 dengan item), SALSA 384, SEMPOLAN 2862, TIRIS 15.

Seluruh nota tanpa item (termasuk pemeriksaan semua status): satu, MAINAN RCP-1789372713698, 2026-09-14 07:58:37.11355 UTC, completed, subtotal=total=N=10000, pajak=0, tidak muncul dalam view profit. Tidak memperbaiki atau menulis ulang nota ini.

Uji CTE wajib: item gratis [100,0], N=70 -> [70,0]; I=0 -> anomaly, nilai tetap nol; tiga item [100,100,100], N=100 -> [33,34;33,33;33,33]; N=0 dengan [100,50,0] -> seluruh alokasi nol. Semua empat kasus dasar lulus. Kasus empat item kecil gagal nonnegatif dan kasus identitas subcent gagal identik.

Belum diverifikasi: eksekusi lima RPC v2, kontrak runtime/grants v2, agregasi by_category/by_cashier/by_period/top_products versus summary v2, performa view/RPC v2, verifikasi sesudah migration. Objeknya belum dibuat; panggilan RPC lama juga terhalang izin role audit. Frontend, checkout, data, dan profit lama tidak diubah; tidak ada pemeriksaan build/TypeScript baru karena tidak ada perubahan kode aplikasi.

### Draf rollback v2 saja — belum dijalankan, belum ada migration

```sql
/* ROLLBACK — jalankan hanya bila objek additive ini kelak dibuat.
DROP FUNCTION public.get_profit_summary_v2(uuid,date,date);
DROP FUNCTION public.get_profit_by_period_v2(uuid,date,date,text);
DROP FUNCTION public.get_profit_by_category_v2(uuid,date,date);
DROP FUNCTION public.get_profit_by_cashier_v2(uuid,date,date);
DROP FUNCTION public.get_top_products_profit_v2(uuid,date,date,text,integer);
DROP VIEW public.v_sale_item_profit_v2;
DROP FUNCTION public.profit_period_bounds(date,date);
DROP FUNCTION public.profit_period_bucket(text,timestamptz);
*/
```

Pilihan aman untuk diputuskan sebelum melanjutkan: pertahankan gross persis ketika N=I; bila pembulatan-residu menghasilkan nilai negatif atau N bukan kelipatan 0,01, tandai anomaly dan pertahankan gross lama. Alternatif pembulatan ke bawah + residu positif menjaga nonnegatif tetapi mengubah kebijakan pembulatan yang diminta. Tidak ada pilihan tersebut diterapkan sekarang.

## Langkah 2 — keputusan final dan percobaan migration, 10 Oktober 2026 setelah 16:16 UTC

Kebijakan pengguna disetujui: seluruh alokasi berada dalam satu fungsi SQL IMMUTABLE profit_allocate_sale(n numeric, totals numeric[]), tanpa akses tabel. Guard NULL/nonfinite/negatif/empty/I=0 mendahului cabang identitas. |N-I|<=0,005 atau I<N<=I+0,01 mengembalikan totals asli sebelum pemeriksaan subcent. Di luar cabang identitas, subcent adalah anomaly; alokasi ROUND dua desimal + residu pada item pertama menolak hasil negatif. View mengurutkan total DESC,id ASC dan memakai modal snapshot. UTC tetap; helper bounds/bucket mengunci UTC. Kebijakan ini disimpan, tetapi belum berhasil diterapkan.

### Hasil percobaan — dihentikan, tidak diulang

Satu SQL additive dikirim melalui tool migration. Tool mengembalikan error:

```text
ERROR: 55000: record "p" is not assigned yet
DETAIL: The tuple structure of a not-yet-assigned record is indeterminate.
CONTEXT: SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
PL/pgSQL function inline_code_block line 4 at FOR over SELECT rows
```

Penyebab: nama record PL/pgSQL `p` berbenturan dengan alias katalog `pg_proc p` di blok penyalinan RPC. Perbaikan yang dibutuhkan pada percobaan berikutnya adalah alias berbeda (misalnya `proc`) untuk query FOR, tanpa mengubah rancangan keuangan. Karena instruksi meminta berhenti saat verifikasi gagal, tidak ada retry migration pada giliran ini.

Read_query sesudah kegagalan memastikan rollback transaksi migration: tidak ada v_sale_item_profit_v2, profit_allocate_sale, profit_period_bounds, profit_period_bucket, atau lima RPC v2 di katalog. Enam hash objek lama tetap sama dengan tabel hash di atas dan baseline sebelum percobaan. Tidak ada berkas migration baru tercipta di supabase/migrations; tidak ada perubahan kode frontend. Build log terbaru 2026-10-10T16:17:00Z = build OK; tidak ada TypeScript mandiri dijalankan.

Verifikasi a lulus: enam hash lama identik sebelum/sesudah percobaan. Verifikasi b/c/d/e tidak dapat dijalankan atas objek v2 karena objek belum ada; tidak mengklaim hasil simulasi sebelumnya sebagai hasil view atau fungsi produksi. Verifikasi f memastikan objek lama utuh dan objek v2 belum ada. Sembilan objek additive yang masih perlu dibuat: profit_allocate_sale, profit_period_bounds, profit_period_bucket, v_sale_item_profit_v2, get_profit_summary_v2, get_profit_by_period_v2, get_profit_by_category_v2, get_profit_by_cashier_v2, get_top_products_profit_v2.

Percobaan SQL menyertakan 19 assertion sintetis terhadap fungsi yang sama dengan produksi serta komentar rollback, tetapi blok assertion belum tercapai akibat error penyalinan RPC. Uji tersebut belum boleh dilaporkan lulus. Data nyata/baseline dan nota tanpa item dari pemeriksaan sebelumnya tetap hanya hasil audit baca-saja.

### Salinan komentar rollback untuk kebijakan final — belum dijalankan

```sql
/* ROLLBACK — v2 objects only; legacy objects and transaction data stay untouched.
DROP FUNCTION public.get_profit_summary_v2(uuid,date,date);
DROP FUNCTION public.get_profit_by_period_v2(uuid,date,date,text);
DROP FUNCTION public.get_profit_by_category_v2(uuid,date,date);
DROP FUNCTION public.get_profit_by_cashier_v2(uuid,date,date);
DROP FUNCTION public.get_top_products_profit_v2(uuid,date,date,text,integer);
DROP VIEW public.v_sale_item_profit_v2;
DROP FUNCTION public.profit_period_bounds(date,date);
DROP FUNCTION public.profit_period_bucket(text,timestamptz);
DROP FUNCTION public.profit_allocate_sale(numeric,numeric[]);
*/
```

Risiko untuk verifikasi lanjutan: pure helpers sengaja callable PUBLIC karena tidak mengakses data dan view invoker/auditor perlu memanggilnya; RPC v2 tetap hanya role yang sama dengan produksi. Helper periode UTC mempertahankan produksi sesi UTC, bukan browser timezone. MATERIALIZED agregasi per nota perlu pemeriksaan performa sebelum pemakaian. Cabang toleransi sengaja boleh meninggalkan SUM item berbeda dari N sampai toleransi final; jangan memaksa kesamaan di cabang identitas. Tidak ada dashboard dialihkan.

## Langkah 2 — migration berhasil, penggunaan dihentikan pada pemeriksaan performa

Migration baru `supabase/migrations/20261010162002_7139bd34-8c4a-4762-9fc9-28bb441e4989.sql` berhasil diterapkan pada Supabase terhubung; file otomatis tersimpan dan sudah dibaca. Tidak ada migration lama diubah. Tidak ada frontend/checkout/struk/retur/stok/poin/data transaksi diubah. Definisi produksi dibaca langsung; alias record/katalog terpisah. Guard awal/akhir hash, assertion sumber v2/bounds/format placeholder/kolom prefix, dan 19 assertion fungsi produksi semuanya dilewati dengan sukses.

### a–b. Katalog dan diff

Keenam hash lama sebelum/sesudah tetap tepat seperti tabel hash sebelumnya. Lima perbandingan programatik menghasilkan `exact_expected_diff=true`, `acl_equal=true`, `security_equal=true`, `volatility_equal=true`, `config_equal=true`, `contract_equal=true`. Metadata RPC tetap STABLE SECURITY DEFINER, search_path=public, owner postgres, ACL postgres/authenticated/service_role EXECUTE; guard developer/owner ada pada seluruh lima RPC. View options dan ACL persis sama: security_invoker=true, seluruh privilege view sesuai produksi. Prefix 20 nama/tipe dasar kolom lama sama; tambahan posisi 21–23 gross_total, allocated_discount, anomaly. Total v2 numeric tanpa typmod untuk menghindari pemotongan hasil; gross_total tetap numeric(12,2).

Baris berbeda yang disengaja (nomor pg_get_functiondef):
- cashier/category: 1 nama *_v2; 24 FROM view v2; 26 batas awal helper; 27 batas akhir helper.
- summary: 1 nama *_v2; 22 FROM view v2; 24 batas awal helper; 25 batas akhir helper.
- top products: 1 nama *_v2; 31 FROM view v2; 33 batas awal helper; 34 batas akhir helper.
- period: 1 nama *_v2; 21 date_trunc -> public.profit_period_bucket; 30 FROM view v2; 32/33 batas helper; 36 format args menjadi v_trunc,p_store_id,p_start,p_end,p_start,p_end (6 %L).

Perubahan batas non-period persis:
```sql
-- lama
x.sale_created_at >= p_start::timestamptz
x.sale_created_at < (p_end + 1)::timestamptz
-- baru
x.sale_created_at >= (SELECT start_ts FROM public.profit_period_bounds(p_start, p_end))
x.sale_created_at < (SELECT end_ts_exclusive FROM public.profit_period_bounds(p_start, p_end))
```
Perubahan period persis:
```sql
-- lama
date_trunc(%L, x.sale_created_at)
x.sale_created_at >= %L::timestamptz
x.sale_created_at < (%L::date + 1)::timestamptz
-- baru
public.profit_period_bucket(%L, x.sale_created_at)
x.sale_created_at >= (SELECT start_ts FROM public.profit_period_bounds(%L::date, %L::date))
x.sale_created_at < (SELECT end_ts_exclusive FROM public.profit_period_bounds(%L::date, %L::date))
```
Tidak ada perbedaan lain setelah normalisasi programatik. Functiondef secara normal ditampilkan pg_get_functiondef sebagai CREATE OR REPLACE; migration tidak menjalankan CREATE OR REPLACE objek lama maupun baru, melainkan CREATE untuk target baru.

### c. Pengujian fungsi produksi yang sama — 19/19 lulus

| Kasus | N | Input totals | Output |
|---|---:|---|---|
| residu negatif | 0,02 | [0,01;0,01;0,01;0,01] | NULL |
| identitas subcent | 0,012 | [0,006;0,006] | [0,006;0,006] |
| toleransi atas | 1,005 | [1] | [1] |
| gratis | 70 | [100;0] | [70;0] |
| tiga pembulatan | 100 | [100;100;100] | [33,34;33,33;33,33] |
| net nol | 0 | [100;50;0] | [0;0;0] |
| sum nol | 0 | [0;0] | NULL |
| identitas | 150 | [100;50] | [100;50] |
| lebih batas | 100,02 | [100] | NULL |
| null item | 1 | [1;NULL] | NULL |
| negatif item | 1 | [2;-1] | NULL |
| NaN item | 1 | [NaN] | NULL |
| infinity item | 1 | [Infinity] | NULL |
| net negatif | -1 | [100] | NULL |
| net NULL | NULL | [100] | NULL |
| net NaN | NaN | [100] | NULL |
| array kosong | 0 | [] | NULL |
| diskon subcent | 0,013 | [0,02] | NULL |
| item subcent bukan identitas | 0 | [0,006;0,006] | NULL |

Identitas/toleransi dievaluasi sebelum subcent sesuai keputusan final, sehingga contoh dua subcent tidak anomali. Fungsi tidak membaca tabel.

### d–e. Angka view produksi dan konsistensi

Query langsung v2 berhasil dengan role read-only. Semua 8 baris tabel simulasi di bagian sebelumnya sekarang dikonfirmasi persis melalui view produksi v2: revenue/cost/profit/transaksi sama dengan tabel itu, bukan lagi hanya simulasi. Untuk kedua periode dan semua toko: anomaly rows=0, item negatif=0, allocation mismatch >0,005=0, identity item changes=0. Tidak ada nota anomaly ber-item. Satu nota tanpa item tetap MAINAN RCP-1789372713698, completed, 2026-09-14 07:58:37.11355 UTC, total/net Rp10000 pajak0; tetap tidak muncul view.

Replikasi SQL kategori, kasir, day/week/month, dan top produk tanpa limit: masing-masing revenue/cost/profit sama dengan summary, seluruh selisih maksimum 0. Ada 42 pembandingan kelompok nonkosong (7 kombinasi toko/periode x 6). TIRIS 30 tanggal tidak memiliki item/kelompok; summary seluruh metrik nol (ditangani sebagai set kosong, bukan kegagalan). SQL kategori/kasir/top mempertahankan kunci pengelompokan dan rumus produksi; date bucket memakai helper yang sama.

### Performa — ambang relatif gagal; tidak dioptimasi

EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON), agregasi sama untuk SEMPOLAN, query langsung sebagai role baca-saja:

| Periode | Lama ms | v2 ms | Rasio |
|---|---:|---:|---:|
| 30 tanggal | 7,537 | 196,789 | 26,11x |
| Seluruh riwayat | 10,040 | 270,838 | 26,98x |

Keduanya masih <1 detik, tetapi >5x batas pengguna. Tidak ada optimasi atau migration lanjutan dilakukan; v2 tetap terpasang tetapi tidak dipakai frontend. Sampel tunggal pada server hidup, bukan benchmark beban/median atau RPC owner. Plan menunjukkan kedua query v2 mengalokasikan 3450 nota / 5053 item sebelum filter; dua CTE MATERIALIZED menghalangi pushdown store/periode. Semua pembacaan blok pada plan sampel hit cache, bukan cold disk.

Pilihan optimasi untuk persetujuan terpisah: alokasi LATERAL per sale setelah filter toko/tanggal (view baru atau perubahan v2 saja); atau RPC v2 melakukan filter sale sebelum agregasi; uji opsi NOT MATERIALIZED dengan EXPLAIN karena bisa mengulang fungsi per item. Tetap satu fungsi alokasi produksi, data tak ditulis ulang, objek lama tidak berubah. Jangan mengalihkan dashboard sebelum pengukuran ulang memenuhi keputusan performa.

### f. Objek, keamanan, keterbatasan

Sembilan objek ada: v_sale_item_profit_v2, profit_allocate_sale, profit_period_bounds, profit_period_bucket, get_profit_summary_v2, get_profit_by_period_v2, get_profit_by_category_v2, get_profit_by_cashier_v2, get_top_products_profit_v2. Rollback lengkap sudah dalam migration dan salinan bagian sebelumnya. Helper periode/bucket eksplisit UTC; contoh 2026-10-04 23:55 UTC memberi bucket day 2026-10-04, week 2026-09-28, month 2026-10-01, persis date_trunc UTC lama.

Linter menghasilkan 5 warning authenticated SECURITY DEFINER untuk RPC v2. Dokumentasi resmi 0029 ditelaah: opsi intentional exposure berlaku; pemeriksaan katalog membuktikan guard developer/owner + store_id tetap persis lama, anon/PUBLIC tidak mendapat EXECUTE RPC. Warning tetap ada sebagai konsekuensi rancangan yang diminta, bukan diklaim hilang. Tidak mencabut akses yang diperlukan atau mengubah SECURITY tanpa izin. Tiga helper murni tanpa data sengaja EXECUTE PUBLIC untuk view invoker/audit. Ada 23 finding lama, tidak diubah: 4 public definer,16 authenticated definer, OTP expiry,password leak protection,patch Postgres.

Eksekusi RPC sebagai owner, uji akses end-to-end lintas akun, beban serentak/cold cache, dan tampilan/export tidak diverifikasi; Supabase eksternal dan dashboard belum dialihkan. Tidak ada pemeriksaan TypeScript mandiri; frontend tidak diedit. Berkas tambahan non-aplikasi: AGENTS.md aturan struktur, roadmap dan rencana. Staff tetap melihat angka profit lama. Tugas penerapan/verifikasi finansial selesai, penggunaan v2 tertahan keputusan optimasi performa.

## Optimasi Profit v2 — kandidat diterapkan, promosi dihentikan (10 Oktober 2026 ~16:29 UTC)

**Status terkini:** migration kandidat berhasil, ekuivalensi lulus; target performa relatif gagal. Tidak ada migration kedua/drop/rename v2. Frontend tetap lama, UTC tetap, kebijakan alokasi/fungsi/5 RPC v2 tidak diubah, tidak ada data transaksi ditulis. Bagian status historis di atas bukan status terkini.

### Berkas/objek
- Migration additive `supabase/migrations/20261010162712_a03c1fff-bedf-4255-bafc-f7c7c357e531.sql`: hanya view baru `public.v_sale_item_profit_v2b`, guard enam hash lama, penurunan dari pg_get_viewdef produksi dengan assertion pola, kontrak seluruh 23 kolom termasuk urutan/typmod/collation sama dengan v2, owner postgres, security_invoker=true, ACL sama.
- Kandidat menjadikan sales penggerak, array_agg item per nota ORDER BY total DESC,id ASC, LATERAL fungsi alokasi yang sama, OFFSET 0 pada hasil fungsi agar tidak diekspansi berulang per ekspresi item, unnest WITH ORDINALITY dan join item. Tidak memakai MATERIALIZED dalam view; CTE MATERIALIZED hanya dipakai query audit ekuivalensi untuk snapshot konsisten.
- `supabase/tests/profit_v2_candidate.sql`: regresi baca-saja 19 kasus alokasi yang sama dan EXCEPT ALL dua arah. Pengujian identik dijalankan melalui read_query: 19 passed, 0 failed.
- Dokumentasi AGENTS.md, roadmap.md, dan rencana diperbarui. Tidak mengubah frontend atau migration existing.

### Indeks
Indeks sudah ada: idx_sale_items_sale_id (sale_id), idx_sales_store_created_at (store_id,created_at DESC), sale_items_pkey dan sales_pkey. Tidak menambah indeks. Ukuran total tabel saat inspeksi: sales 1952 kB, sale_items 1432 kB; reltuples merupakan estimasi lama (3163/4701), bukan hitungan aktual.

### Ekuivalensi dan keamanan
EXCEPT ALL atas SEMUA 23 kolom, semua toko/seluruh data: kedua arah 0 baris. Snapshot pertama v2=v2b=5053 item; snapshot akhir keduanya 5054 item. Produksi bertambah satu item/nota selama pembacaan terpisah; jangan menyebut pertambahan ini akibat migration atau membandingkan snapshot berbeda sebagai kegagalan ekuivalensi. Query audit akhir satu statement: 0 anomaly, 0 item negatif, 0 mismatch SUM alokasi vs N >0,005, 0 perubahan item saat N=I.

Agregasi seluruh riwayat snapshot pertama, identik v2 dan v2b:
| Toko | Item | Nota | Revenue | Cost | Profit |
|---|---:|---:|---:|---:|---:|
| MAINAN |230|172|4397500|2871836,10|1525663,90|
| SALSA |511|384|41785000|32374600|9410400|
| SEMPOLAN |4280|2862|289779003|193808798,15|95970204,85|
| TIRIS |15|15|2050000|1290000|760000|

View v2 hash tetap 3774a73bbe091248c017d9564158aac9. Kandidat hash 3af9c4adf6a6531f63e4868b1968d0c7. Fungsi alokasi sebelum/sesudah hash 29c0be76bc75fcd1dfa3bd74c8a038c0 (IMMUTABLE tetap). Enam hash lama tepat sama dengan tabel baseline di atas. Lima RPC v2 tetap STABLE SECURITY DEFINER, search_path=public, EXECUTE postgres/authenticated/service_role dan tetap membaca v_sale_item_profit_v2. Tidak ada RPC dialihkan.

### Performa — STOP pada gate pertama yang gagal
SEMPOLAN, 30 tanggal UTC [2026-09-11,2026-10-11), sum(total),sum(cost_price*quantity),sum(profit),count(distinct sale_id), EXPLAIN ANALYZE BUFFERS. Tiga sampel tiap view, bukan waktu request/network:
| Sumber | Sampel ms | Median ms | Rasio vs lama |
|---|---|---:|---:|
| Lama |110,863 / 3,409 / 3,330|3,409|1x|
| v2 sekarang |242,641 / 202,471 / 191,913|202,471|59,39x|
| Kandidat v2b |70,712 / 40,007 / 29,646|40,007|11,74x|

Kandidat ~5,06x lebih cepat daripada v2 sekarang, median <50ms, tetapi target <=~3x lama GAGAL (11,74x). Sampel lama pertama outlier besar dipertahankan, tidak dibuang. Query di server hidup, tidak cold-cache atau concurrent-load terkontrol; batch pembacaan independen bisa berbagi beban server. Tidak mengklaim benchmark RPC owner.

Bukti plan kandidat:
```text
Index Scan using sales_pkey on sales s ... rows=640 loops=1
Filter: status IS DISTINCT FROM returned AND created_at >= 2026-09-11 AND created_at < 2026-10-11 AND store_id=SEMPOLAN
Rows Removed by Filter: 2843 (snapshot berikut 2844)
Aggregate ... rows=1 loops=640
Index Scan using idx_sale_items_sale_id ... Index Cond: sale_id=s.id ... loops=640
Memoize allocation ... Hits:481 Misses:159
Result (allocation) ... rows=1 loops=159
Function Scan on unnest ... loops=640
Index Scan using sale_items_pkey ... loops=906
```
Filter sales didorong SEBELUM agregasi/alokasi: 640 nota terpilih/906 item, bukan seluruh 3450/3451 nota. Fungsi benar-benar dievaluasi 159 kali berkat memoize input identik. Namun planner memilih sales_pkey (memindai semua sales sambil menyaring), bukan indeks store/tanggal, dan banyak lookup/memoize item; kandidat 8569/8570 shared hit blocks vs lama 150. Ini hambatan tersisa, bukan bukti perlu indeks baru (indeks relevan sudah ada).

### Keanehan, batas verifikasi, langkah berikut
Satu nota tanpa item tetap MAINAN RCP-1789372713698, completed, 2026-09-14 07:58:37.11355 UTC, subtotal=total=10000, tax=0; tidak muncul kedua view. Tidak memperbaiki data ini.
Sesuai stop-on-failure, tidak meneruskan benchmark seluruh riwayat/toko kecil/detail/count/category/cashier/sale_id, tidak cek dependency untuk drop/rename, tidak menjalankan tahap pascapenggantian atau konsistensi RPC lengkap ulang. Tidak ada penggantian terjadi. Eksekusi RPC sebagai owner, akses lintas akun, cold cache/beban serentak/tampilan/export belum terverifikasi. Diagnostics CLI tidak tersedia pada backend external; read_query Supabase berhasil. Eksperimen query_to_xml(EXPLAIN) ditolak karena EXPLAIN tidak diizinkan dalam non-volatile function; tidak menambahkan helper benchmark atau privilege baru.
28 finding linter sudah ada sebelum migration, tidak ada finding baru. Frontend tidak berubah; tidak menjalankan build/TypeScript manual. Log build ditinjau, status terbaru dilaporkan terpisah.
Saran terpisah: uji kandidat berikut mengurangi lookup balik item dengan array komposit terurut, atau RPC v2 prefilter sales dan batch allocation; tetap fungsi alokasi sama, guard/EXCEPT/performa penuh sebelum promosi. Jangan mengubah kandidat sekarang tanpa keputusan lanjutan.

### Rollback kandidat (tidak dieksekusi)
```sql
DROP VIEW public.v_sale_item_profit_v2b;
```
Rollback lengkap objek v2 tetap komentar migration: lima DROP FUNCTION RPC v2, DROP VIEW v2b dan v2, lalu DROP FUNCTION profit_period_bounds, profit_period_bucket, profit_allocate_sale. Objek lama/data tidak termasuk. Frontend belum dialihkan, sehingga tidak perlu rollback frontend pada tahap ini.


## Pengukuran lima sampel — 11 Oktober 2026, STOP pada gate baru


## Keputusan
STOP; tidak membuat/menerapkan migration penggantian, tidak drop/rename, tidak mengubah frontend, UTC/WIB, RPC, alokasi, objek lama, atau data transaksi.
Kriteria terbaru menggantikan batas 3x lama: SEMUA bentuk harus median lima sampel <~100 ms dan v2b tidak lebih lambat daripada v2.
**Gagal absolut:** agregasi harian yang memakai `profit_period_bucket` seperti RPC v2 mempunyai median **111,392 ms**. Seluruh lima sampelnya di atas 100 ms. Bahkan tanpa membandingkan v2, syarat gabungan tidak terpenuhi.
**Cakupan belum lengkap:** bukan seluruh matriks yang diminta telah diuji; jangan menganggap bentuk lain lulus atau tahap 1 selesai penuh.

## Metode
EXPLAIN (ANALYZE, BUFFERS), produksi aktif, waktu Execution Time dalam ms, bukan latency jaringan atau Actual Total Time node pertama. Tidak membuang outlier. Sampel dipanggil lewat alat baca-saja; batch independen tidak membuktikan lingkungan beban/cold-cache terkontrol. Tidak menguji RPC sebagai owner terautentikasi.
Seluruh hasil lima sampel di tabel berikut untuk SEMPOLAN. Bentuk 30 hari memakai [2026-09-11 00:00+00,2026-10-11 00:00+00); lainnya seluruh riwayat kecuali disebutkan. Query bounds 1900–2100 adalah eksperimen batas luas, bukan pengganti matriks RPC lengkap.

| Bentuk / sumber | Sampel 1–5 (ms) | Median (ms) |
|---|---|---:|
| Ringkasan seluruh riwayat — lama | 266.263 / 10.323 / 10.289 / 10.168 / 10.361 | 10.323 |
| Ringkasan seluruh riwayat — v2 | 238.228 / 225.561 / 231.097 / 227.373 / 263.578 | 231.097 |
| Ringkasan seluruh riwayat — v2b | 90.485 / 86.460 / 90.180 / 87.384 / 86.755 | 87.384 |
| Ringkasan seluruh riwayat, batas 1900–2100 — v2b | 100.213 / 87.548 / 90.177 / 90.563 / 100.820 | 90.563 |
| Per hari date_trunc + count distinct — v2b | 86.739 / 88.485 / 85.428 / 82.974 / 88.861 | 86.739 |
| Per hari helper RPC + count distinct + margin — v2b (GAGAL) | 116.764 / 111.392 / 112.387 / 110.678 / 109.323 | 111.392 |
| Per kategori + margin — v2b | 85.111 / 86.035 / 86.583 / 105.491 / 85.101 | 86.035 |
| Per kasir + margin — v2b | 92.852 / 93.047 / 94.598 / 109.810 / 96.117 | 94.598 |
| Per kasir tanpa margin — v2b | 127.347 / 94.121 / 97.490 / 94.644 / 102.745 | 97.490 |
| Top produk + margin — v2b | 100.703 / 93.176 / 89.472 / 105.357 / 92.717 | 93.176 |
| Top produk tanpa margin — v2b | 90.159 / 111.269 / 111.124 / 87.768 / 90.958 | 90.958 |
| Detail 30 hari OFFSET 250 LIMIT 25 — v2b | 17.644 / 14.907 / 15.351 / 15.835 / 15.402 | 15.402 |
| Satu nota 13 item SELECT * — v2b | 7.719 / 2.409 / 2.325 / 2.419 / 2.589 | 2.419 |
| Per kategori batch awal — v2b | 290.028 / 87.456 / 88.786 / 85.783 / 104.133 | 88.786 |

Ringkasan seluruh riwayat: rasio median v2b/lama **8.465x**; v2b/v2 **0.378x**. Bentuk lain tidak punya pembanding lima sampel lengkap; rasionya **belum terverifikasi**, bukan nol atau lulus.

Sampel count exact 30 hari yang tersedia: lama **5,249 ms**; v2 **186,249 ms**; v2b **9,670 ms** (masing-masing satu sampel, tidak cukup untuk median lima sampel). Percobaan dua EXPLAIN dalam satu panggilan hanya mengembalikan hasil terakhir, lama **1,880 ms**; tidak dihitung sebagai dua sampel.
Pengukuran awal ringkasan v2b 108,909 / 85,658 / 96,106 / 97,120 / 109,322 ms dan grouping day awal tersimpan hanya dalam rangkuman sesi, tidak ada raw plan lengkap yang dapat dicocokkan di sandbox ini; tidak dicampur dengan tabel Execution Time yang terverifikasi. Nilai awal kemungkinan waktu node teratas, sehingga tidak dipakai untuk keputusan.

## Bukti plan dan temuan
- Ringkasan v2b seluruh riwayat: 2.863 nota yang diagregasi itemnya, 4.282 baris item keluaran; `Index Scan sales_pkey`, menyaring 622 sales; allocation Memoize hit=2.380/miss=483, jadi fungsi dievaluasi 483 kali, bukan 2.863 kali; shared hit=25.266.
- Ringkasan lama: merge join; sales_pkey dan idx_sale_items_sale_id, shared hit=6.976. Outlier 266,263 ms dipertahankan.
- Ringkasan v2: CTE sale_totals/allocations menghitung **3.452 nota lintas toko / 5.056 item eligible** sebelum filter toko; shared hit=7.534; tidak ada Memoize alokasi.
- Per hari `date_trunc` langsung: shared hit=12.654, 148 bucket, 2.863 nota / 4.282 item.
- Per hari helper RPC: shared hit=12.533, 148 bucket, 2.863 nota / 4.282 item, sales_pkey menyaring 622 baris, allocation Memoize 2.380/483. Helper SQL memiliki SET TimeZone=UTC dan search_path=public; plan mempertahankan pemanggilan fungsi, bukan inline date_trunc. Perbedaan waktu menunjukkan overhead helper dapat relevan, tetapi tidak membuktikan penyebab tunggal dan **helper tidak diubah**.
- Kategori dengan margin: idx_sales_store, 2.863 nota, 4.282 item, 17 grup, Memoize 2.380/483, shared hit=9.206.
- Kasir dengan margin: idx_sales_user_id menyaring toko/status (622 dibuang), 2.863 nota, 4.282 item, 3 grup, incremental sort; shared hit=22.129, allocation Memoize 2.380/483.
- Top produk dengan margin: seq scan sales dengan filter toko/status, 2.863 nota, 4.282 item, 509 grup sebelum top-N heapsort LIMIT 10; shared hit=9.210; allocation Memoize 2.380/483. Top-N memang memerlukan seluruh baris eligible untuk agregasi, bukan pagination detail.
- Detail OFFSET 250: **tidak menghitung seluruh 906 item sebelum LIMIT**. idx_sales_store_created_at membaca 194 nota, membentuk 275 item, membuang 250 untuk mengembalikan 25; Memoize alokasi 118/76, shared hit=2.623. Count exact terpisah tetap membaca seluruh 640 nota / 906 item; v2b count dapat menghilangkan evaluasi allocation karena nilai profit tidak digunakan (plan Result nol biaya), jadi count cepat bukan bukti detail/agregasi cepat.
- Satu nota banyak item: RCP-1779104377654, sale_id 3e9c49ab-778e-4373-8b57-996977bc8a01; sales_pkey lookup 1 nota, 13 item, allocation Result loops=1, shared hit=607. Dua nota calon lain ditemukan (10 dan 9 item), belum dibenchmark.

Bentuk query gagal yang diuji:
```sql
SELECT public.profit_period_bucket('day', sale_created_at),
       SUM(total), SUM(cost_price * quantity), SUM(profit),
       COUNT(DISTINCT sale_id),
       CASE WHEN SUM(total)>0 THEN SUM(profit)/SUM(total)*100 ELSE 0 END
FROM public.v_sale_item_profit_v2b
WHERE store_id='2a57e905-edba-4182-bb06-21c6d71c3ff7'
GROUP BY 1 ORDER BY 1;
```
Grouping `date_trunc` langsung lulus batas absolut pada sampelnya, tetapi **tidak cukup** mewakili RPC v2 yang memakai helper. Tidak mengedit 5 RPC v2 untuk menghindari biaya helper.

## Checksum akhir
Sama dengan baseline awal pada seluruh 14 objek yang dicatat; view memakai md5(pg_get_viewdef(oid,true)), fungsi memakai md5(pg_get_functiondef(oid)).
| Objek | MD5 |
|---|---|
| v_sale_item_profit | 835430e5863e97d584812e8a49a5d1cb |
| get_profit_summary | 213f7e0e0586dea2e2a5022c4a3cbd79 |
| get_profit_by_period | edc7eba9d317433f625def7ce7a0c5ee |
| get_profit_by_category | 86dc254c75f850539f63c13da6074bac |
| get_profit_by_cashier | 59c8fba05cc38497b073abcf8323def7 |
| get_top_products_profit | c76fbb196187ab308d43224ab2c35488 |
| profit_allocate_sale | 29c0be76bc75fcd1dfa3bd74c8a038c0 |
| v_sale_item_profit_v2 | 3774a73bbe091248c017d9564158aac9 |
| v_sale_item_profit_v2b | 3af9c4adf6a6531f63e4868b1968d0c7 |
| get_profit_summary_v2 | 2971b94bbdb424f8f8c3db6a964252f3 |
| get_profit_by_period_v2 | 5d0a5265596486aab318ed36a9bf444b |
| get_profit_by_category_v2 | e30536f74fc9c84491f0d7a2d487f1f9 |
| get_profit_by_cashier_v2 | 0f13447ddaac608c7a6251b0ffd415c2 |
| get_top_products_profit_v2 | 57b631000f0d29417ab7bb73570f420f |

## Yang belum diverifikasi / tidak dilakukan
MAINAN/SALSA seluruh bentuk, SEMPOLAN ringkasan 30 hari lima sampel lengkap tiga view, detail halaman 1, kategori/kasir filter pada detail dan count, tiga nota lengkap, semua pembanding lama/v2 untuk grouping, plan/count lengkap matriks, dan kriteria relatif tiap bentuk belum selesai. Dihentikan saat median helper harian terbukti gagal.
Tahap 2 **tidak dijalankan**: tidak ada migration promosi/rollback baru, tidak cek dependency untuk drop/rename, tidak ada verifikasi pascapenggantian/19 kasus/security/konsistensi ulang. Hasil tes lama tidak diklaim sebagai tes ulang saat ini.
Log otomatis build 2026-10-11T00:30:12Z: build OK; tidak ada build/TypeScript manual atau perubahan kode aplikasi, sehingga ini bukan verifikasi build setelah implementasi baru.
Dokumentasi audit/rencana/checklist saja diperbarui. Risiko: pertumbuhan transaksi, variasi beban produksi, overhead helper bucket UTC, dan hasil benchmark privileged tidak menjamin performa RLS pengguna nyata. Dashboard staff tetap sumber lama; WIB tetap belum dikerjakan.


## Keputusan penggantian bersyarat — audit 11 Oktober 2026 01:12 UTC

# Profit v2 — hasil gate penggantian, 11 Oktober 2026

## Keputusan: STOP, v2b tidak menggantikan v2

Penggantian bersyarat telah disetujui, tetapi gate relatif gagal pada **top produk seluruh riwayat SEMPOLAN, memakai batas dari helper RPC**. Median v2b **274,131 ms**, v2 **248,821 ms**, rasio **1,101720x**: kandidat sekitar **10,17% lebih lambat**. Keduanya di bawah 300 ms, tetapi syarat v2b <= v2 tidak terpenuhi. Sesuai instruksi berhenti pada kegagalan, tidak membuat/menerapkan migration, DROP/RENAME, rollback, atau perubahan DB apa pun. Matriks belum lengkap dan tidak diklaim selesai/lulus.

Semua src/**, checkout, nota, retur, stok, poin, login/sesi, penugasan/pemilihan toko, policy/role/GRANT, UTC/helper dan transaksi tidak diedit. Perubahan proyek hanya roadmap.md dan tambahan laporan pada .lovable/plan.md. Memori persyaratan gate diperbarui; AGENTS.md tidak berubah karena tidak ada keputusan struktur baru.

## Metode dan gate

- Satu SQL per panggilan Supabase read_query; waktu yang dipakai **Execution Time**, bukan waktu node teratas atau jaringan.
- Lima sampel nyata per baris lengkap di tabel. Tidak mengisi hasil panggilan yang ditolak sebagai sampel.
- Rentang bulanan tepat `[2026-09-11 00:00+00,2026-10-11 00:00+00)`; helper dipanggil dengan tanggal akhir inklusif 2026-10-10.
- Bentuk seluruh riwayat gaya RPC menggunakan profit_period_bounds('1900-01-01','2100-01-01'). MIN/MAX sales SEMPOLAN yang dibaca: 2026-05-17 07:22:38.078848+00 sampai 2026-10-11 00:10:05.950094+00. Batas luas ini mencakup semua data saat pengukuran, bukan mengubah UTC atau helper.
- Gate kandidat: median <100 ms sampai satu bulan, <300 ms seluruh riwayat; median v2b <= median v2 setiap bentuk. Batas absolut diterapkan pada kandidat, bukan menjadikan v2 pembanding yang lambat sebagai kegagalan kandidat.
- Produksi aktif; bukan cold-cache atau beban serentak terkontrol. Panggilan independen dibatch; tool menyelesaikan hasil secara terpisah, bukan satu multi-statement. Variasi beban dapat memengaruhi angka. Tidak mengulangi kelompok gagal untuk memilih hasil yang lebih baik.

## Lima sampel lengkap — SEMPOLAN

Angka ms memakai titik desimal agar bisa dihitung ulang; tidak membuang outlier.

| Bentuk | View | Sampel 1–5 ms | Median ms | Rasio v2b/v2 | Gate kandidat |
|---|---|---|---:|---:|---|
| Per hari 30 hari, helper bucket + bounds | v2b | 76.610 / 90.005 / 69.538 / 70.371 / 68.609 | 70.371 | 0.251411 | Lulus bentuk ini |
| Sama | v2 | 305.245 / 314.131 / 275.889 / 279.772 / 279.904 | 279.904 | — | Pembanding |
| Per hari seluruh riwayat, helper bucket + bounds | v2b | 287.708 / 267.099 / 256.895 / 296.138 / 254.680 | 267.099 | 0.855834 | Lulus bentuk ini |
| Sama | v2 | 296.948 / 337.570 / 340.731 / 312.092 / 291.695 | 312.092 | — | Pembanding |
| Ringkasan seluruh riwayat, helper bounds | v2b | 228.119 / 239.687 / 254.413 / 214.132 / 214.164 | 228.119 | 0.949934 | Lulus bentuk ini |
| Sama | v2 | 240.142 / 252.510 / 231.384 / 228.899 / 246.335 | 240.142 | — | Pembanding |
| Top produk LIMIT 10 seluruh riwayat, helper bounds | v2b | 274.131 / 260.915 / 273.391 / 285.616 / 274.679 | **274.131** | **1.101720** | **GAGAL relatif** |
| Sama | v2 | 253.284 / 247.915 / 248.821 / 249.382 / 246.756 | **248.821** | — | Pembanding |

Hasil lama 111,392 ms adalah per hari seluruh riwayat **tanpa helper bounds** pada sesi sebelumnya. Itu tidak lagi gagal batas absolut 300 ms, tetapi tidak menggantikan benchmark bentuk RPC yang memakai bounds. Perbedaan plan nyata membuat pengukuran ulang penting.

## Sampel tambahan yang belum cukup untuk gate

| Bentuk | View | Sampel nyata ms | Median 5 / rasio |
|---|---|---|---|
| MAINAN count exact 30 hari | v2b | 1.447 | Belum tersedia |
| MAINAN count exact 30 hari | v2 | 192.602 | Belum tersedia |
| SEMPOLAN detail kategori 12, LIMIT 25 | v2b | 48.170 | Belum tersedia |
| SEMPOLAN detail kasir, LIMIT 25 | v2b | 4.926 | Belum tersedia |
| SEMPOLAN agregasi kategori 30 hari + bounds | v2b | 56.575 | Belum tersedia |
| SEMPOLAN top produk 30 hari + bounds | v2b | 62.782 | Belum tersedia |
| SEMPOLAN agregasi kasir seluruh riwayat, tanpa bounds | v2b | 95.414 | Belum tersedia |
| SEMPOLAN agregasi kasir seluruh riwayat + bounds | v2b | 217.919 / 224.726 | Belum tersedia |

Eksperimen awal per hari 30 hari dengan **TIMING OFF** menghasilkan 206.247 ms. Ini tetap dilaporkan, tetapi tidak dicampurkan ke lima sampel standar TIMING ON: opsi instrumennya berbeda. Tiga panggilan byte-identik dalam satu batch ditolak oleh tool dan **tidak dihitung**. Lima sampel kandidat standar benar-benar dijalankan dalam panggilan berbeda.

## SQL bentuk gagal

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT product_id, variant_id, product_name, variant_name,
       SUM(quantity), SUM(total), SUM(cost_price * quantity), SUM(profit),
       CASE WHEN SUM(total)>0 THEN SUM(profit)/SUM(total)*100 ELSE 0 END
FROM public.v_sale_item_profit_v2b
WHERE store_id='2a57e905-edba-4182-bb06-21c6d71c3ff7'
  AND sale_created_at >= (SELECT start_ts FROM public.profit_period_bounds('1900-01-01','2100-01-01'))
  AND sale_created_at < (SELECT end_ts_exclusive FROM public.profit_period_bounds('1900-01-01','2100-01-01'))
GROUP BY product_id,variant_id,product_name,variant_name
ORDER BY SUM(profit) DESC LIMIT 10;
```
Pembanding identik, hanya sumber diganti public.v_sale_item_profit_v2. Semua SUM/revenue/cost/profit/margin memakai rumus existing.

## Bukti plan dan keanehan

- Per hari 30 hari kandidat: idx_sales_store_created_at, 640 nota eligible, 2 returned dibuang, 906 item, 30 grup, shared hit=5.042. Allocation Result loops=640; **tidak ada Memoize untuk fungsi alokasi** pada plan ini. Memoize unnest 0 hit/640 miss dan lookup item 0/906.
- Per hari seluruh riwayat kandidat dengan helper bounds: estimasi sales 15 tetapi aktual 2.863 nota, 16 returned dibuang, 4.282 item, 148 grup, allocation Result loops=2.863, shared hit=21.983. Semua item perlu dibaca untuk grouping.
- Top seluruh riwayat kandidat: membaca 4.282 item/2.863 nota, 509 grup sebelum top-N heapsort LIMIT 10; allocation Result per nota (bukan memoized berdasarkan totals). Helper bounds mengubah estimasi/planner dibanding bentuk tanpa bounds. Ini bukti overhead nyata, bukan alasan mengubah helper yang dilarang.
- v2 pembanding tetap menghitung CTE MATERIALIZED 3.452 nota/5.056 item lintas toko sebelum filter. Per hari 30 hari shared hit=9.294. Bentuk top v2 menggunakan grouping/sort dan LIMIT setelah agregasi.
- Detail filter kategori 12 menghasilkan hanya **2 item**: idx_sales_store_created_at membaca semua 640 nota/906 item sebelum mengembalikan 2. Bukan karena sort semua data sebelum LIMIT, melainkan filter kategori jarang cocok sehingga tidak dapat berhenti setelah 25. Shared hit=6.468; alokasi baru dievaluasi untuk 2 item eligible. Jangan menggeneralisasi hasil OFFSET 250 sesi lama ke semua filter.
- Detail kasir: 18 nota →25 item, 13 sales lain dibuang; berhenti saat 25 terpenuhi. Memoize alokasi hit=4/miss=14, shared hit=728.
- MAINAN count: 53 nota eligible termasuk satu tanpa item →78 item; kandidat count menghilangkan evaluasi alokasi (Result biaya 0.01), shared hit=418. Count cepat tidak membuktikan agregasi finansial cepat.
- Nilai filter nyata: SEMPOLAN kategori 12, cashier e3fa496e-10d7-4fa3-b6f0-2147b86cd595; MAINAN kategori 38, cashier b982c61c-89f8-4f8b-8d5a-4ecabe9eab1b; SALSA kategori 44, cashier 47efbb63-598e-488f-b8c1-86ffcdbdedb6. Tidak mengubah penugasan akun tersebut.
- Nota ditemukan: 13 item RCP-1779104377654 / 3e9c49ab-778e-4373-8b57-996977bc8a01; 10 item RCP-1780745527411 / df25fcdf-8eea-41ff-b3b1-4421a155904a; 9 item RCP-1785324437265 / 66f22d04-5949-4191-aeda-c1e5c6ce9877. Dua terakhir dikonfirmasi lewat count aktual; benchmark tiga nota belum dijalankan dalam sesi ini.
- Kontrak view **tidak mempunyai kolom id**; kolom pertama sale_id. Karena itu rumus checksum pengguna `string_agg(id::text...)` tidak dapat dijalankan langsung pada view. Jika tahap B kelak lolos, checksum item perlu join sale_items dengan kunci item deterministik atau CTE definisi yang membawa raw.id tanpa mengubah kontrak view. Tidak menebak id=sale_id (bisa duplikat antar item). Belum mengerjakan checksum/swap.

## Verifikasi objek baca-saja setelah STOP

Enam hash lama, hash alokasi, dua view dan lima RPC v2 cocok dengan baseline yang ditetapkan pengguna. View v2/v2b hash juga diperiksa saat awal dan akhir.

| Objek | MD5 akhir |
|---|---|
| v_sale_item_profit | 835430e5863e97d584812e8a49a5d1cb |
| get_profit_summary | 213f7e0e0586dea2e2a5022c4a3cbd79 |
| get_profit_by_period | edc7eba9d317433f625def7ce7a0c5ee |
| get_profit_by_category | 86dc254c75f850539f63c13da6074bac |
| get_profit_by_cashier | 59c8fba05cc38497b073abcf8323def7 |
| get_top_products_profit | c76fbb196187ab308d43224ab2c35488 |
| profit_allocate_sale | 29c0be76bc75fcd1dfa3bd74c8a038c0 |
| v_sale_item_profit_v2 | 3774a73bbe091248c017d9564158aac9 |
| v_sale_item_profit_v2b | 3af9c4adf6a6531f63e4868b1968d0c7 |
| get_profit_summary_v2 | 2971b94bbdb424f8f8c3db6a964252f3 |
| get_profit_by_period_v2 | 5d0a5265596486aab318ed36a9bf444b |
| get_profit_by_category_v2 | e30536f74fc9c84491f0d7a2d487f1f9 |
| get_profit_by_cashier_v2 | 0f13447ddaac608c7a6251b0ffd415c2 |
| get_top_products_profit_v2 | 57b631000f0d29417ab7bb73570f420f |
| profit_period_bounds | 0554370e03819474fe10c13b8192786e |
| profit_period_bucket | 2984dc0fe9ce0658a3eb77ce4fea881e |

Helper hashes baru dicatat sesi ini, bukan diklaim dibanding baseline awal yang belum diambil sesi ini.

Lima RPC produksi terbukti **PL/pgSQL**, STABLE, SECURITY DEFINER, search_path=public, ACL EXECUTE postgres/authenticated/service_role; masing-masing guard developer/owner dan referensi public.v_sale_item_profit_v2 bernilai true. Review latar berdasarkan file sempat menyatakan SQL-language/dependen RPC; **klaim itu dibantah katalog produksi dan tidak dipakai**. pg_depend hanya menunjukkan type v2 dan rule _RETURN internal (deptype i); lima RPC tidak menjadi dependen tercatat, sesuai harapan pengguna. Tidak melakukan rename-swap alternatif yang menyisakan view retired atau mengubah RPC.

Kedua view owner=postgres, security_invoker=true, ACL sama persis saat dibaca: postgres/anon/authenticated/service_role masing-masing arwdDxtm/postgres. Tidak menambah/mencabut hak. Nama/urutan 23 kolom identik; typmod/collation/type full assertion belum dijalankan karena tidak swap.

## Tidak diverifikasi / tidak dilakukan

- Sisa matriks MAINAN/SALSA, ringkasan 30 hari lengkap, halaman 1/OFFSET dan filter kategori/kasir beserta pembanding lengkap, count lima sampel, tiga nota, kategori/kasir semua periode/toko: **belum selesai**, dihentikan oleh gate relatif.
- Tahap B tidak dijalankan: tidak ada migration/guard transaksi/rollback baru, checksum jendela tetap sebelum/sesudah, EXCEPT ulang, 19 tes alokasi ulang, konsistensi kategori/kasir/day-week-month/top vs summary ulang, EXPLAIN pascaswap, atau cek yatim pascaswap.
- Tidak mengambil baseline/akhir hash daftar policy/GRANT tabel sales/sale_items/stores, auth/store/role. Tidak ada perintah tulis terhadapnya, tetapi **jangan menyebut hash tersebut sudah dibandingkan sama**.
- Linter tidak dijalankan sesi ini karena tahap B tidak berlangsung; finding baru tidak dapat dinyatakan nol berdasarkan linter sesi sebelumnya.
- RPC sebagai owner, cold-cache, beban serentak dan tampilan dashboard belum terverifikasi. Frontend tidak dialihkan. Build/TypeScript manual tidak dijalankan; tidak ada src berubah.

## Risiko dan saran

Kandidat belum aman dipromosikan menurut gate pengguna, meskipun hasil ekuivalensi sesi sebelumnya lulus. Input bounds melalui helper dapat menyebabkan estimasi 15 nota yang jauh di bawah aktual dan kehilangan Memoize alokasi. Pertumbuhan data dan variasi beban dapat memperburuknya. Saran: tahan swap; jika disetujui terpisah, optimasi kandidat saja dengan menjaga helper/aturan/RPC/objek lama tetap, lalu ukur kembali seluruh matriks. Jangan melewati gate atau menganggap source tanpa bounds mewakili RPC berbounds.


## Pembaruan keputusan 11 Oktober 2026 01:24 UTC

Untuk pekerjaan ini saja: median kandidat <100 ms sampai satu bulan, <300 ms seluruh riwayat dan rasio median v2b/v2 <=1,15. Top produk seluruh riwayat SEMPOLAN sebelumnya 274,131/248,821 ms (1,101720x) kini lulus, tanpa mengulang sampel. Selesaikan sisa matriks tepat sesuai daftar pengguna, satu EXPLAIN per panggilan dan lima sampel nyata per view/bentuk. Berhenti pada kegagalan tanpa mengulang untuk memilih hasil lebih baik. Swap atomik dan seluruh pengaman/verifikasi tahap B hanya jika seluruh gate lulus. Semua larangan objek/data/frontend/auth/toko/ACL/UTC tetap berlaku. Checksum memakai concat_ws dan urutan string deterministik tanpa kolom id.


# Putaran terarah — 13 Oktober 2026, baca-saja

## Keputusan terbaru
**BELUM seluruh gate lulus. STOP EXPLAIN pada sampel pertama kategori SEMPOLAN seluruh riwayat: 576.548 ms, melebihi 300 ms.** Instruksi “bila ada angka melanggar, berhenti” diterapkan konservatif pada sampel tunggal; ini **bukan bukti median lima sampel gagal**. Hanya **1/50 EXPLAIN** dilakukan, 49 sisanya tidak dijalankan. Tidak membuang outlier, mengulang sampel, migration atau swap. Pemeriksaan kapasitas dan hash akhir tetap dilakukan, semuanya SELECT; tidak mengubah objek/data/src/auth/toko/hak akses. Bagian ini menggantikan kesimpulan status historis sebelumnya, bukan menghapus buktinya.

## 1. Tabel pengukuran putaran ini
Angka Execution Time dalam ms dengan titik desimal. “—” = tidak diukur, bukan nol. Lima sampel tiap view diperlukan untuk median/rasio/gate.

| Bentuk | Toko | Sampel v2b 1..5 (ms) | Sampel v2 1..5 (ms) | Median v2b | Median v2 | Rasio | Lulus gate? |
|---|---|---|---|---:|---:|---:|---|
| Kategori seluruh riwayat | SEMPOLAN | 576.548 / — / — / — / — | — / — / — / — / — | — | — | — | STOP sampel >300; median belum tersedia |
| Kasir seluruh riwayat | SEMPOLAN | — / — / — / — / — | — / — / — / — / — | — | — | — | Belum lengkap |
| Ringkasan 30 hari | SEMPOLAN | — / — / — / — / — | — / — / — / — / — | — | — | — | Belum lengkap |
| Detail halaman 1, 30 hari | SEMPOLAN | — / — / — / — / — | — / — / — / — / — | — | — | — | Belum lengkap |
| Ringkasan seluruh riwayat | SALSA | — / — / — / — / — | — / — / — / — / — | — | — | — | Belum lengkap |

Query pertama:
```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT category_id,category_name,SUM(quantity),SUM(total),SUM(cost_price*quantity),SUM(profit),CASE WHEN SUM(total)>0 THEN SUM(profit)/SUM(total)*100 ELSE 0 END
FROM public.v_sale_item_profit_v2b
WHERE store_id='2a57e905-edba-4182-bb06-21c6d71c3ff7'
AND sale_created_at>=(SELECT start_ts FROM public.profit_period_bounds('1900-01-01','2100-01-01'))
AND sale_created_at<(SELECT end_ts_exclusive FROM public.profit_period_bounds('1900-01-01','2100-01-01'))
GROUP BY category_id,category_name;
```
Bukti asli: tool-results://supabase--read_query/20261013-003955-238049; Execution Time diekstrak skrip, bukan Actual Total Time 575.631 ms. Planning Time 45.483 ms terpisah. Plan: 17 grup, 2.905 nota/4.352 item, allocation Result loops=2.905 (tidak ada Memoize alokasi); Memoize unnest 0 hit/2.905 miss, lookup item 0 hit/4.352 miss; root shared hit=35.361, shared read=0. Estimasi note 14 versus aktual 2.905. Rasio baru tidak tersedia karena v2 tidak diukur. Data/plan bertambah dibanding 2.863 nota/4.282 item sesi lama; penyebab lonjakan waktu tidak terbukti, dan semua blok hit tidak berarti beban server terkontrol.

### Bukti historis, TIDAK diukur ulang
Empat pasangan SEMPOLAN berasal tabel tersimpan di rencana; MAINAN/SALSA dari laporan sesi sebelumnya. Raw plan sesi sebelumnya belum pulih. Ini bukan pengukuran baru atau pengesahan ulang di kondisi produksi hari ini.

| Bentuk | Toko | Sampel v2b 1..5 (ms) | Sampel v2 1..5 (ms) | Median v2b | Median v2 | Rasio | Lulus gate? |
|---|---|---|---|---:|---:|---:|---|
| Ringkasan seluruh riwayat + bounds | SEMPOLAN | 228.119 / 239.687 / 254.413 / 214.132 / 214.164 | 240.142 / 252.510 / 231.384 / 228.899 / 246.335 | 228.119 | 240.142 | 0.949934 | Lulus |
| Harian 30 hari + bucket/bounds | SEMPOLAN | 76.610 / 90.005 / 69.538 / 70.371 / 68.609 | 305.245 / 314.131 / 275.889 / 279.772 / 279.904 | 70.371 | 279.904 | 0.251411 | Lulus |
| Harian seluruh riwayat + bucket/bounds | SEMPOLAN | 287.708 / 267.099 / 256.895 / 296.138 / 254.680 | 296.948 / 337.570 / 340.731 / 312.092 / 291.695 | 267.099 | 312.092 | 0.855834 | Lulus |
| Top produk seluruh riwayat + bounds | SEMPOLAN | 274.131 / 260.915 / 273.391 / 285.616 / 274.679 | 253.284 / 247.915 / 248.821 / 249.382 / 246.756 | 274.131 | 248.821 | 1.101720 | Lulus |
| Ringkasan 30 hari | MAINAN | 100.920 / 9.634 / 6.272 / 6.121 / 5.963 | 712.548 / 508.741 / 471.709 / 474.338 / 468.519 | 6.272 | 474.338 | 0.013223 | Lulus |
| Ringkasan seluruh riwayat | MAINAN | 20.461 / 13.930 / 14.133 / 13.781 / 14.293 | 1105.302 / 1091.176 / 1184.797 / 1173.624 / 1113.235 | 14.133 | 1113.235 | 0.012695 | Lulus |
| Ringkasan 30 hari (COALESCE berbeda) | SALSA | 30.038 / 25.485 / 25.232 / 27.977 / 26.101 | 205.605 / 199.665 / 194.027 / 195.538 / 191.395 | 26.101 | 195.538 | 0.133483 | Lulus numerik saja; SQL tidak identik |

## 2. Kapasitas database dan storage
Ukuran dalam byte kecuali dinyatakan lain; MB desimal=1.000.000 byte, MiB=1.048.576 byte.

| Metrik | Nilai |
|---|---:|
| pg_database_size(current_database()) | 26.659.987 byte |
| pg_size_pretty | 25 MB (format PostgreSQL) |
| Total desimal / biner | 26,660 MB / 25,425 MiB |
| Terhadap asumsi batas 500.000.000 byte | 5,332% |
| Sisa aritmetis terhadap 500 MB | 473.340.013 byte = 473,340 MB |
| Schema public, 35 tabel | 8.650.752 byte |

Batas kuota akun/penagihan Supabase **tidak dibaca**. Database bukan bucket Storage; isi file di object storage tidak termasuk pg_database_size, hanya metadata terkait ada di database. Sisa di atas bukan jaminan kuota dan tidak termasuk pertumbuhan semua tabel/indeks, bloat, atau kuota file yang terpisah.

### 15 tabel public terbesar
“Table”=pg_table_size, termasuk TOAST/FSM/VM; bukan hanya heap. Total=pg_total_relation_size; index=pg_indexes_size. reltuples adalah estimasi statistik, -1=belum diketahui.

| Tabel | Total byte | Table byte | Index byte | Estimasi baris |
|---|---:|---:|---:|---:|
| sales | 2039808 | 1097728 | 942080 | 3528 |
| stock_history | 1826816 | 892928 | 933888 | 5259 |
| sale_items | 1499136 | 901120 | 598016 | 4701 |
| purchase_items | 655360 | 483328 | 172032 | 1302 |
| stock_movements | 368640 | 262144 | 106496 | 1652 |
| variants | 368640 | 221184 | 147456 | 1092 |
| inventory | 221184 | 122880 | 98304 | 1056 |
| products | 221184 | 139264 | 81920 | 857 |
| cash_deposits | 180224 | 65536 | 114688 | 110 |
| store_expenses | 163840 | 81920 | 81920 | 219 |
| purchase_sessions | 114688 | 49152 | 65536 | 51 |
| members | 106496 | 57344 | 49152 | 96 |
| store_members | 81920 | 16384 | 65536 | -1 |
| profiles | 81920 | 49152 | 32768 | 5 |
| stock_adjustment_items | 73728 | 57344 | 16384 | 65 |

### Schema non-public
Total relasi tabel/materialized view beserta indeks; bukan seluruh alokasi disk database.

| Schema | Total byte | pg_size_pretty |
|---|---:|---|
| pg_catalog | 13.205.504 | 13 MB |
| auth | 4.120.576 | 4024 kB |
| storage | 614.400 | 600 kB |
| information_schema | 253.952 | 248 kB |
| supabase_migrations | 196.608 | 192 kB |
| realtime | 57.344 | 56 kB |
| vault | 24.576 | 24 kB |
| extensions | 0 relasi tabel | — |
| supabase_functions | Schema tidak muncul di katalog yang terbaca | — |

### Bucket storage.objects
Hanya agregat metadata.size; tidak membaca nama/path file atau isi/foto.

| Bucket | Jumlah file | Total byte | File ukuran tidak diketahui |
|---|---:|---:|---:|
| product-images | 124 | 7.570.630 | 0 |
| attendance-selfies | 9 | 330.455 | 0 |
| store-logos | 2 | 64.236 | 0 |
| Total | 135 | 7.965.321 | 0 |

### Estimasi byte per nota
Sampel LIMIT 1000 tanpa ORDER BY/randomisasi: bukan sampel acak atau jaminan populasi. pg_column_size mencakup nilai row, tidak seluruh overhead fisik. Count tabel semua status, bukan populasi profit eligible.

| Tabel | Sampel | Rata-rata row byte | Min–max byte | Count aktual | Index byte |
|---|---:|---:|---|---:|---:|
| sales | 1000 | 243,79 | 108–364 | 3539 | 942.080 |
| sale_items | 1000 | 160,87 | 137–193 | 5174 | 598.016 |

| Rumus kapasitas per nota | Byte |
|---|---:|
| Item/nota = 5174/3539 | 1,461995 item |
| Payload sampel = 243,79 + 160,87 × 1,461995 | 478,98 |
| Indeks dialokasikan rata-rata = (942080+598016)/3539 | 435,18 |
| Payload + indeks (belum overhead fisik) | 914,16 |
| Fisik sales+sale_items+indeks = 3539008/3539 | 999,98 |

Sekitar 1 kB per nota untuk **dua tabel ini saja**, bukan seluruh biaya nota aplikasi. Stock_history, stok/mutasi, member, audit, foto, dan pertumbuhan indeks tidak termasuk. Sisa 473,34 MB dibagi ~1 kB bukan proyeksi aman jumlah nota. Ukuran/count dari pembacaan berbeda pada produksi hidup bukan snapshot kapasitas atomik.

### Nota/item per toko per bulan, enam bulan kalender UTC
Mei–Oktober 2026; Oktober parsial sampai audit 13 Oktober. Semua status termasuk returned; items terkait bulan sales.created_at (bukan waktu insert item), tidak mengubah filter profit. Nol berarti tidak ada grup pada hasil query yang terbaca. Setiap sel: **nota / item**.

| Toko | Mei | Juni | Juli | Agustus | September | Oktober parsial |
|---|---|---|---|---|---|---|
| MAINAN | 0 / 0 | 0 / 0 | 19 / 19 | 58 / 83 | 87 / 106 | 12 / 25 |
| SALSA | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 287 / 376 | 109 / 152 |
| SEMPOLAN | 203 / 335 | 536 / 799 | 620 / 1000 | 664 / 938 | 603 / 872 | 296 / 436 |
| TIRIS | 0 / 0 | 0 / 0 | 2 / 2 | 0 / 0 | 0 / 0 | 0 / 0 |

## 3. Hash akhir 16 objek
MD5 view=pg_get_viewdef(oid,true), fungsi=pg_get_functiondef(oid). Query akhir sesudah semua pembacaan kapasitas: seluruh 16 hasil cocok baseline pengguna, tidak ada hilang/berbeda.

| Objek | MD5 aktual (= baseline) | Status |
|---|---|---|
| v_sale_item_profit | 835430e5863e97d584812e8a49a5d1cb | Sama |
| get_profit_summary | 213f7e0e0586dea2e2a5022c4a3cbd79 | Sama |
| get_profit_by_period | edc7eba9d317433f625def7ce7a0c5ee | Sama |
| get_profit_by_category | 86dc254c75f850539f63c13da6074bac | Sama |
| get_profit_by_cashier | 59c8fba05cc38497b073abcf8323def7 | Sama |
| get_top_products_profit | c76fbb196187ab308d43224ab2c35488 | Sama |
| profit_allocate_sale | 29c0be76bc75fcd1dfa3bd74c8a038c0 | Sama |
| profit_period_bounds | 0554370e03819474fe10c13b8192786e | Sama |
| profit_period_bucket | 2984dc0fe9ce0658a3eb77ce4fea881e | Sama |
| get_profit_summary_v2 | 2971b94bbdb424f8f8c3db6a964252f3 | Sama |
| get_profit_by_period_v2 | 5d0a5265596486aab318ed36a9bf444b | Sama |
| get_profit_by_category_v2 | e30536f74fc9c84491f0d7a2d487f1f9 | Sama |
| get_profit_by_cashier_v2 | 0f13447ddaac608c7a6251b0ffd415c2 | Sama |
| get_top_products_profit_v2 | 57b631000f0d29417ab7bb73570f420f | Sama |
| v_sale_item_profit_v2 | 3774a73bbe091248c017d9564158aac9 | Sama |
| v_sale_item_profit_v2b | 3af9c4adf6a6531f63e4868b1968d0c7 | Sama |

**16/16 sama, 0 berbeda, 0 hilang.** Hash definisi ini tidak memverifikasi terpisah hash ACL/RLS/role/auth/store assignment; tidak mengubah atau melewati akses tersebut.

## 4. Kelengkapan, blocker, dan prasyarat sebelum swap
- Putaran ini belum lengkap: kategori seluruh riwayat SEMPOLAN baru 1/5 v2b, 0/5 v2; kasir seluruh riwayat, summary 30 hari, detail halaman 1 SEMPOLAN dan summary seluruh riwayat SALSA semuanya 0/5 kedua view.
- Matriks SEMPOLAN lain yang belum lengkap sesuai cakupan sebelumnya: kategori/kasir 30 hari, top produk 30 hari, mingguan seluruh riwayat, OFFSET 250, count exact 30 hari, filter kategori 12, filter kasir, tiga nota (13/10/9 item). Bukti tanpa bounds tidak menggantikan gaya RPC dengan bounds. Nota 13 item hanya v2b 5 sampel; pembanding v2 belum lengkap. Jangan mengulang empat pasangan lengkap untuk mencari angka lebih baik.
- MAINAN/SALSA selain summary belum lengkap bila masih termasuk matriks awal; SALSA summary 30 hari hanya lulus numerik dengan SQL berbeda COALESCE, bukan pasangan identik terverifikasi.
- **Seluruh gate: TIDAK dinyatakan lulus.** Sampel 576.548 ms memicu STOP konservatif, bukan median gagal yang dikarang. Sebelum meneruskan 49 EXPLAIN, perlu keputusan pengguna bagaimana menangani stop-on-any-number versus gate median; jangan lanjut otomatis atau memilih hasil baru. Jika kelak diizinkan melengkapi, simpan sampel ini dan jangan reset hasilnya.
- Sebelum swap: seluruh matriks pasangan identik lima sampel lolos; kemudian pekerjaan terpisah untuk checksum deterministik, equivalence penuh, guards hash/dependency/kontrak/ACL/owner, rollback, tes alokasi dan konsistensi, serta verifikasi pascaswap. Tidak menjalankan salah satunya pada putaran ini.

## 5. Yang tidak terverifikasi / tidak dilakukan
RPC sebagai owner terautentikasi, RLS lintas akun, cold-cache/concurrency, penyebab lonjakan waktu, quota dashboard Supabase, keberadaan file fisik dibanding metadata, pertumbuhan/bloat jangka panjang, checksum data sebelum/sesudah, equality/19 tes alokasi ulang, linter, dan build/UI tidak diuji ulang. Tidak ada perubahan src atau aplikasi, auth/sesi/pilihan toko, RLS/role/GRANT/REVOKE, objek profit, aturan/UTC/helper, data; semua operasi DB baca-saja. Dokumentasi proyek saja diperbarui. Tidak menampilkan data pribadi pelanggan/staf.
