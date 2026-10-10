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