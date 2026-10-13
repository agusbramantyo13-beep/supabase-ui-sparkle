# Roadmap
- [x] Putaran terarah 13 Oktober: kapasitas dan 16 hash selesai; EXPLAIN STOP pada sampel kategori SEMPOLAN 576.548 ms (1/50), tanpa swap/migration.
- [ ] Sisa 49 EXPLAIN putaran terarah dan matriks awal: menunggu keputusan pengguna atas sampel tunggal melampaui batas versus gate median; jangan reset/membuang sampel.
- [ ] Lanjutan 12 Oktober: pulihkan sampel SEMPOLAN tanpa EXPLAIN baru; tabel sampel/median/rasio dan kelengkapan; hanya ringkasan 30 hari/seluruh riwayat MAINAN/SALSA (maksimum 40 EXPLAIN, berhenti jika gagal); cek 16 hash akhir; tanpa swap/migration.
- [x] Audit keputusan 11 Oktober 01:12 UTC dihentikan sesuai gate: top produk SEMPOLAN seluruh riwayat memakai helper bounds median v2b 274,131 ms vs v2 248,821 ms (1,101720x, gagal relatif). Empat bentuk memiliki pembanding lima sampel lengkap; matriks lain belum lengkap, tidak diklaim lulus. Laporan seluruh sampel disimpan di rencana.
- [x] Kandidat LATERAL v2b diterapkan additive; EXCEPT ALL dua arah 0, kolom/ACL/owner sama, 19/19 tes alokasi lulus. Tidak mengubah frontend, UTC, kebijakan alokasi, objek lama atau data.
- [ ] Keputusan 11 Oktober 01:24 UTC: selesaikan sisa matriks lima sampel; gate kandidat <100 ms sampai satu bulan, <300 ms seluruh riwayat, rasio v2b/v2 <=1,15. Top produk sebelumnya 274,131/248,821 ms (1,101720x) kini lulus tanpa diukur ulang. Swap hanya setelah semua baris lulus; tahap B menunggu gate.
- [x] Langkah 2: satu migration additive tersimpan/terpasang, 9 objek v2 ada, 6 hash lama identik, diff/ACL/kontrak sama, 19 tes lulus, agregasi nyata dan konsistensi SQL cocok; frontend tidak dialihkan.
- [ ] Penggunaan Profit v2 oleh frontend di luar persetujuan ini; dashboard tidak dialihkan. Uji RPC owner/end-to-end, cold-cache dan beban serentak belum tersedia.

- [x] Langkah 1: diskon sebenarnya display-only, informasi rekonsiliasi tanpa mengubah total; 11 tes lulus, build OK, perbandingan produksi baca-saja selesai. Tampilan terautentikasi belum dapat diverifikasi pada Supabase eksternal.

- [x] Tambahkan tampilan diskon di Riwayat Transaksi, Overview, dan Profit tanpa mengubah perhitungan lama.
- [x] Verifikasi definisi profit/filter UTC, 4 pengujian aturan diskon, dan build/TypeScript; pemeriksaan halaman terautentikasi tidak tersedia pada Supabase eksternal.

- [x] Ekspor Inventori: kosongkan varian untuk produk sederhana.
- [x] Ekspor Riwayat Stok: kosongkan varian untuk produk sederhana.
- [x] Ekspor Detail Profit/BI: kosongkan varian untuk produk sederhana.
- [x] Verifikasi TypeScript dan build.
- [x] Tuntaskan mode penjualan offline: cache POS, antrean, sinkronisasi, nota, status, dan pembatasan halaman.
- [x] Verifikasi migrasi produksi, TypeScript, build, serta alur online/offline.


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
