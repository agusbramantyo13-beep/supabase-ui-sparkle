# Roadmap
- [x] Audit keputusan 11 Oktober 01:12 UTC dihentikan sesuai gate: top produk SEMPOLAN seluruh riwayat memakai helper bounds median v2b 274,131 ms vs v2 248,821 ms (1,101720x, gagal relatif). Empat bentuk memiliki pembanding lima sampel lengkap; matriks lain belum lengkap, tidak diklaim lulus. Laporan seluruh sampel disimpan di rencana.
- [x] Kandidat LATERAL v2b diterapkan additive; EXCEPT ALL dua arah 0, kolom/ACL/owner sama, 19/19 tes alokasi lulus. Tidak mengubah frontend, UTC, kebijakan alokasi, objek lama atau data.
- [ ] Swap atomik ditahan: blocker gate relatif top produk 1,101720x >1 dan matriks belum lengkap. Tidak membuat migration/drop/rename. Perlu keputusan optimasi kandidat berikut; enam hash lama/alokasi/lima RPC v2 dan kedua view tetap sesuai baseline. Tahap B/pascaswap/linter belum dijalankan.
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
