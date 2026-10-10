# Roadmap
- [ ] Langkah 2: ulangi migration dengan alias terpisah, assertion sumber/bounds/kolom/hash, 19 tes fungsi produksi; verifikasi katalog/agregasi/konsistensi dan EXPLAIN performa. Frontend tetap tidak diubah; berhenti dan laporkan jika gagal.

- [x] Langkah 1: diskon sebenarnya display-only, informasi rekonsiliasi tanpa mengubah total; 11 tes lulus, build OK, perbandingan produksi baca-saja selesai. Tampilan terautentikasi belum dapat diverifikasi pada Supabase eksternal.

- [x] Tambahkan tampilan diskon di Riwayat Transaksi, Overview, dan Profit tanpa mengubah perhitungan lama.
- [x] Verifikasi definisi profit/filter UTC, 4 pengujian aturan diskon, dan build/TypeScript; pemeriksaan halaman terautentikasi tidak tersedia pada Supabase eksternal.

- [x] Ekspor Inventori: kosongkan varian untuk produk sederhana.
- [x] Ekspor Riwayat Stok: kosongkan varian untuk produk sederhana.
- [x] Ekspor Detail Profit/BI: kosongkan varian untuk produk sederhana.
- [x] Verifikasi TypeScript dan build.
- [x] Tuntaskan mode penjualan offline: cache POS, antrean, sinkronisasi, nota, status, dan pembatasan halaman.
- [x] Verifikasi migrasi produksi, TypeScript, build, serta alur online/offline.
