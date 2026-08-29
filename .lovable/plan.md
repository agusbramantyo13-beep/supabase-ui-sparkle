# Hasil Verifikasi Lanjutan — RLS INSERT `public.stores`

## Catatan penting soal uji insert ter-rollback

Uji `BEGIN … INSERT … ROLLBACK` dengan impersonasi (`set_config('request.jwt.claims', …)` + `SET LOCAL ROLE authenticated`) **tidak bisa dijalankan** di lingkungan ini:

- `psql` tidak tersedia (tidak ada variabel `PG*`, koneksi socket lokal gagal).
- Tool query database yang tersedia hanya SELECT (read-only) dan tidak mendukung transaksi/`SET ROLE`; tool tulis berjalan tanpa autentikasi (`auth.uid()` NULL) dan perubahannya permanen — jadi tidak dipakai sesuai instruksi Anda.

Sebagai gantinya saya memverifikasi semua komponen yang menentukan hasil evaluasi policy tersebut satu per satu.

## Hasil pengecekan (semua diverifikasi langsung ke database)

| Yang dicek | Hasil |
|---|---|
| `is_developer` SECURITY DEFINER | ya (`prosecdef = true`) |
| `search_path` pada fungsi | `search_path=public` (di-set) |
| Owner fungsi | `postgres` (sama dengan owner tabel `stores`) |
| Tipe `profiles.id` | `uuid` |
| Tipe hasil `auth.uid()` | `uuid` |
| Mismatch text/uuid | **tidak ada** — kedua sisi `uuid`, perbandingan `id = _user_id` valid |
| Baris developer | `id = e77110d3-…2260`, `role = 'developer'` → cocok (1 baris) |
| RLS pada `stores` | aktif, `FORCE RLS` tidak aktif |
| Policy `stores_insert` | `FOR INSERT TO authenticated WITH CHECK is_developer(auth.uid())` |
| Grant tabel untuk `authenticated` | `INSERT` ✔, `SELECT` ✔ (juga `store_members` INSERT ✔) |
| EXECUTE `is_developer` untuk `authenticated` | ✔ (revoke hanya mengenai `public`/`anon`) |
| Trigger pada INSERT `stores` | tidak ada |

Satu catatan: pemanggilan `is_developer()` oleh role read-only saya sendiri ditolak (`permission denied for function`) — itu efek `REVOKE … FROM public` di migrasi 18 Juli dan **tidak** memengaruhi role `authenticated`.

## Kesimpulan

Secara struktural tidak ada yang salah: untuk user id `e77110d3-…2260`, `is_developer(auth.uid())` pasti mengembalikan true selama `auth.uid()` benar-benar berisi id tersebut saat request. Artinya penyebab error hampir pasti ada di **sisi sesi/identitas request**, bukan di definisi policy, tipe kolom, atau fungsi:

1. `auth.uid()` NULL/berbeda saat insert — sesi kedaluwarsa, token belum ter-refresh, atau request terkirim sebagai `anon`.
2. Akun yang menekan tombol bukan akun developer tersebut (5 akun lain ber-role `staff`), sementara state `profileRole` di halaman berasal dari sesi sebelumnya tanpa reload.

## Langkah berikutnya yang saya usulkan (butuh persetujuan Anda)

Pilih salah satu:

- **A. Uji live di aplikasi (tanpa ubah kode permanen):** minta user yang error membuka halaman itu, lalu kita cek nilai `auth.uid()` dari sesi aktif (mis. lewat query `select auth.uid()` dari klien) dan bandingkan dengan id developer. Ini membuktikan hipotesis 1 vs 2 secara definitif.
- **B. Uji insert nyata:** saya lakukan satu insert toko uji lewat sesi terautentikasi, lalu hapus lagi — ini menghasilkan perubahan data sementara, jadi hanya saya lakukan kalau Anda setuju.
- **C. Perbaikan defensif di frontend** (setelah penyebab pasti diketahui): validasi ulang sesi sebelum insert dan tampilkan pesan error yang jelas ("sesi kedaluwarsa, silakan login ulang") alih-alih pesan RLS mentah.

Belum ada perubahan kode maupun data yang dilakukan.
