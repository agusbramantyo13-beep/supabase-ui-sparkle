# Roadmap
- [ ] Langkah 2: penerapan dihentikan sebelum migration; menunggu keputusan kebijakan pembulatan (CTE menghasilkan item negatif/subcent tidak identik) dan akses audit RPC yang sah. Bukti hash, simulasi produksi, nota tanpa item, dan rollback tersimpan di rencana; tidak ada objek DB/frontend diubah.

- [x] Langkah 1: diskon sebenarnya display-only, informasi rekonsiliasi tanpa mengubah total; 11 tes lulus, build OK, perbandingan produksi baca-saja selesai. Tampilan terautentikasi belum dapat diverifikasi pada Supabase eksternal.

- [x] Tambahkan tampilan diskon di Riwayat Transaksi, Overview, dan Profit tanpa mengubah perhitungan lama.
- [x] Verifikasi definisi profit/filter UTC, 4 pengujian aturan diskon, dan build/TypeScript; pemeriksaan halaman terautentikasi tidak tersedia pada Supabase eksternal.

- [x] Ekspor Inventori: kosongkan varian untuk produk sederhana.
- [x] Ekspor Riwayat Stok: kosongkan varian untuk produk sederhana.
- [x] Ekspor Detail Profit/BI: kosongkan varian untuk produk sederhana.
- [x] Verifikasi TypeScript dan build.
- [x] Tuntaskan mode penjualan offline: cache POS, antrean, sinkronisasi, nota, status, dan pembatasan halaman.
- [x] Verifikasi migrasi produksi, TypeScript, build, serta alur online/offline.
