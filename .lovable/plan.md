# Mode Penjualan Offline KENZHO POS

## Tujuan
Menambahkan penjualan offline yang aman dan tahan pengulangan, tanpa mengubah perilaku checkout online, hak akses, pemisahan toko, atau host PWA utama.

## Implementasi

### 1. Penyimpanan lokal per perangkat
- Tambahkan modul kecil di `src/lib/offline/` berbasis IndexedDB (`idb`) untuk:
  - katalog POS per toko: produk, varian, harga, biaya rata-rata, kategori, gambar yang sudah tersedia, dan stok tampilan;
  - member dan aturan yang dipakai layar kasir;
  - informasi toko serta desain nota, termasuk salinan logo yang dapat dicetak tanpa internet;
  - antrean penjualan, identitas perangkat, kode perangkat, dan nomor urut nota harian.
- Segarkan cache hanya saat online: ketika POS dibuka, toko berubah, dan koneksi kembali.
- Saat offline atau permintaan katalog gagal karena jaringan, baca cache toko aktif tanpa mencampur data antartoko.
- Minta penyimpanan persisten browser melalui `navigator.storage.persist()`.

### 2. Antrean dan mesin sinkronisasi
- Setiap transaksi offline mendapat UUID `client_txn_id`, nomor nota lokal `{DEVICE_CODE}-{YYYYMMDD}-{sequence}`, waktu perangkat, kasir, toko, item, pembayaran, member, diskon/redeem, total, dan identitas perangkat.
- Status lokal: `menunggu`, `sinkron`, atau `gagal`, beserta jumlah percobaan dan pesan kesalahan.
- Sinkronisasi berjalan saat aplikasi mulai, event `online`, setiap sekitar 30 detik selama ada antrean, dan tombol **Sinkronkan sekarang**.
- Proses FIFO satu per satu dengan retry/backoff. Data hanya dihapus setelah server mengonfirmasi; kesalahan permanen tetap terlihat dan dapat dicoba ulang.
- Bedakan kesalahan jaringan dari kesalahan bisnis agar checkout online hanya beralih ke antrean saat benar-benar kehilangan koneksi.

### 3. Database produksi dan RPC idempoten
- Buat migrasi baru saja; migrasi lama tidak disentuh.
- Tambahkan metadata offline pada `sales`: `client_txn_id` unik, `client_created_at`, `is_offline_sync`, `synced_at`, serta penanda konflik stok.
- Tambahkan penanda kekurangan stok pada item penjualan agar produk yang menyebabkan stok negatif dapat ditinjau melalui transaksi terkait.
- Buat RPC `sync_offline_sale(payload jsonb)` yang:
  - wajib memiliki pengguna aktif dan memverifikasi keanggotaan toko melalui aturan yang sudah ada;
  - mengunci transaksi berdasarkan `client_txn_id` dan mengembalikan transaksi lama pada retry;
  - memvalidasi toko, kasir, member, varian, harga, jumlah, dan total payload;
  - menyimpan transaksi dan item secara atomik, memakai biaya `average_cost ?? cost_price` seperti checkout sekarang;
  - mengurangi inventori dan menulis riwayat stok walaupun hasilnya negatif, sambil memberi penanda review;
  - menghitung perolehan/penukaran poin dengan aturan yang sama seperti checkout sekarang dan menyimpan snapshot poin;
  - memakai `client_created_at`, tetapi membatasi waktu masa depan ke `now()`, sehingga Setoran Kas dan BI WIB masuk periode yang benar.
- Berikan akses eksekusi hanya kepada pengguna terautentikasi. Migrasi dijalankan langsung pada Supabase produksi yang terhubung.

### 4. Integrasi POS tanpa regresi online
- Pisahkan pembentukan payload/nota dari `Sales.tsx`, tetapi pertahankan urutan dan hasil checkout online saat koneksi sehat.
- Setelah checkout online gagal karena jaringan, antrekan payload yang sama dan tampilkan konfirmasi bahwa transaksi tersimpan di perangkat.
- Saat offline, produk/member/promo memakai cache; stok tampilan dikurangi lokal untuk transaksi yang baru diantrekan.
- Cetak nota offline memakai desain toko yang tersimpan. Untuk member, nota menampilkan bahwa poin dihitung setelah sinkronisasi.
- Gambar produk tetap best-effort: teks, harga, stok, checkout, dan nota tetap berjalan bila gambar belum pernah tersimpan lokal.

### 5. Status, antrean, dan pembatasan halaman
- Tambahkan indikator ringkas di header/POS: **Online**, **Offline**, **Menyinkronkan…**, dan jumlah transaksi tertunda.
- Tambahkan panel antrean kecil berisi nomor nota, waktu, total, status, pesan gagal, tombol coba lagi, sinkronkan, dan cetak ulang nota offline.
- Tambahkan badge **Offline** pada transaksi server yang berasal dari sinkronisasi offline.
- Bungkus halaman selain POS dan panel antrean dengan keadaan sederhana **Butuh koneksi internet** saat offline; halaman tidak menjalankan permintaan yang hanya akan gagal.
- Peringatkan sebelum logout atau menutup halaman bila perangkat masih memiliki transaksi yang belum tersinkron.

### 6. Sesi dan PWA
- Pertahankan sesi terakhir ketika refresh token gagal karena jaringan; login baru tetap membutuhkan internet.
- Gunakan konfigurasi `vite-plugin-pwa` yang sudah ada untuk precache app shell dan dependensi POS, navigasi tetap `NetworkFirst`.
- Pertahankan `CANONICAL_PWA_HOST` tanpa perubahan dan tetap cegah service worker aktif di preview/dev/non-kanonis.

## Detail Teknis
- Modul dipisah menjadi `db`, `types`, `cache`, `network`, `receipt`, `syncEngine`, dan context/UI status agar `Sales.tsx` tidak menjadi lebih padat.
- RPC menjadi batas atomik dan sumber kebenaran untuk replay; frontend tidak pernah menganggap timeout sebagai kegagalan permanen karena retry aman.
- Tidak ada service-role key di browser. Semua verifikasi server memakai `auth.uid()` dan RLS/helper yang sudah ada.
- Keputusan arsitektur offline dicatat di `AGENTS.md`; daftar pekerjaan aktif diperbarui di `roadmap.md`.

## Verifikasi
- TypeScript dan build aplikasi harus lolos tanpa error.
- Uji online memastikan checkout lama tetap berjalan dan tidak masuk antrean.
- Uji DevTools → Network → Offline: muat ulang PWA terpasang, buka POS dari cache, cari produk, checkout, cetak nota, dan lihat antrean.
- Kembali online: pastikan sinkron satu kali, stok/poin/riwayat berubah, waktu masuk periode WIB yang sesuai, dan badge Offline tampil.
- Uji retry RPC dengan `client_txn_id` sama untuk memastikan tidak ada duplikasi.
- Uji stok server yang sudah berkurang sebelum sinkron: transaksi tetap masuk, stok boleh negatif, dan penanda review tersimpan.
- Uji logout dengan antrean tertunda dan halaman non-POS saat offline.

## Asumsi
- Promosi/diskon/redeem yang dipilih saat offline dibekukan di payload agar nilai nota tidak berubah ketika aturan server berubah sebelum sinkron; server tetap memvalidasi integritas angka dan menghitung poin secara konsisten.
- Transaksi yang sudah sukses tersinkron dipertahankan singkat sebagai status `sinkron`, lalu boleh dibersihkan; transaksi menunggu/gagal tidak pernah dibuang otomatis.