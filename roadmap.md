# Roadmap
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
