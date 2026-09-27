# Perbaikan Nama Varian pada Ekspor Excel

## Tujuan
Mengosongkan kolom varian pada baris ekspor Excel untuk produk sederhana (`has_variants = false`), tanpa mengubah data produk atau varian di database.

## Perubahan
- **Ekspor Inventori:** ikut mengambil status `has_variants` produk dan menulis `-` pada kolom Varian untuk produk sederhana.
- **Ekspor Riwayat Stok:** mencocokkan `product_id` dengan status `has_variants` sebelum membentuk baris Excel.
- **Ekspor Detail Profit/BI:** mencocokkan `product_id` dengan status `has_variants` sebelum membentuk baris Excel.
- **Audit ekspor lain:** template unggah stok tidak diubah karena berisi contoh input, bukan ekspor data produk aktual.

## Batasan
- Tidak mengubah nama varian di database.
- Tidak mengubah tampilan struk, formulir, pencarian, PDF, atau tampilan tabel aplikasi.
- Produk yang memang memiliki varian tetap menampilkan nama variannya.

## Verifikasi
- Pastikan semua pembuat file Excel dengan kolom varian sudah ditangani.
- Jalankan pemeriksaan TypeScript dan pastikan build aplikasi tetap berhasil.
