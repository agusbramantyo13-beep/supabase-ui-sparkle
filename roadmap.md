# Roadmap
- [ ] Keputusan 11 Oktober 01:12 UTC: lanjutkan sisa matriks lima sampel v2/v2b untuk SEMPOLAN, MAINAN, SALSA; gate <100 ms hingga satu bulan, <300 ms seluruh riwayat, v2b <= v2 setiap bentuk. Berhenti jika satu bentuk gagal.
- [x] Kandidat LATERAL v2b diterapkan additive; EXCEPT ALL dua arah 0, kolom/ACL/owner sama, 19/19 tes alokasi lulus. Tidak mengubah frontend, UTC, kebijakan alokasi, objek lama atau data.
- [ ] Hanya jika seluruh gate lulus: satu migration swap atomik dengan guard hash/ekuivalensi/dependency/kontrak, rollback lengkap, lalu verifikasi checksum/tes/keamanan/konsistensi/performa/linter. Dilarang mengubah src, RPC, helper UTC/alokasi, auth/toko/hak akses atau data.
- [x] Langkah 2: satu migration additive tersimpan/terpasang, 9 objek v2 ada, 6 hash lama identik, diff/ACL/kontrak sama, 19 tes lulus, agregasi nyata dan konsistensi SQL cocok; frontend tidak dialihkan.
- [ ] Penggunaan Profit v2 ditahan: kandidat optimasi v2b sudah ada tetapi gagal target relatif; RPC/dashboard tetap memakai sumber sebelumnya. Uji owner end-to-end belum tersedia.

- [x] Langkah 1: diskon sebenarnya display-only, informasi rekonsiliasi tanpa mengubah total; 11 tes lulus, build OK, perbandingan produksi baca-saja selesai. Tampilan terautentikasi belum dapat diverifikasi pada Supabase eksternal.

- [x] Tambahkan tampilan diskon di Riwayat Transaksi, Overview, dan Profit tanpa mengubah perhitungan lama.
- [x] Verifikasi definisi profit/filter UTC, 4 pengujian aturan diskon, dan build/TypeScript; pemeriksaan halaman terautentikasi tidak tersedia pada Supabase eksternal.

- [x] Ekspor Inventori: kosongkan varian untuk produk sederhana.
- [x] Ekspor Riwayat Stok: kosongkan varian untuk produk sederhana.
- [x] Ekspor Detail Profit/BI: kosongkan varian untuk produk sederhana.
- [x] Verifikasi TypeScript dan build.
- [x] Tuntaskan mode penjualan offline: cache POS, antrean, sinkronisasi, nota, status, dan pembatasan halaman.
- [x] Verifikasi migrasi produksi, TypeScript, build, serta alur online/offline.
