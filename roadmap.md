# Roadmap
- [x] Kandidat LATERAL v2b diterapkan additive; EXCEPT ALL dua arah 0, kolom/ACL/owner sama, 19/19 tes alokasi lulus. Tidak mengubah frontend, UTC, kebijakan alokasi, objek lama atau data.
- [ ] Promosi/benchmark lanjutan diblokir target performa: SEMPOLAN 30 tanggal median v2b 40,007 ms vs lama 3,409 ms (11,74x, target <=~3x gagal). Tidak membuat migration penggantian; kandidat ditahan, membutuhkan keputusan optimasi berikutnya.
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
