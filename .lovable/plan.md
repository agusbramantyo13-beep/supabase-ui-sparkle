# Investigasi: ubah role Faruk jadi Pemilik di toko SALSA

## Kesimpulan: hipotesis TIDAK terbukti

Kebijakan RLS `public.store_members` **sudah punya bypass `is_developer()`** di semua perintah tulis. Ini bukan pengulangan bug tabel `stores`.

Kebijakan aktif saat ini (semua untuk role `authenticated`):

- `store_members_insert` (WITH CHECK): `is_developer(auth.uid()) OR (is_store_owner(auth.uid(), store_id) AND role = 'cashier')`
- `store_members_update` (USING + WITH CHECK): sama persis seperti di atas
- `store_members_delete` (USING): sama persis seperti di atas
- `store_members_select` (USING): `is_developer(auth.uid()) OR user_id = auth.uid() OR store_id IN (SELECT get_user_store_ids(auth.uid()))`

Artinya akun developer (Bram, `agusbramantyo13@gmail.com`) boleh insert/update/delete baris keanggotaan di toko mana pun, termasuk membuat baris dengan `role = 'owner'`. Yang dibatasi hanya owner biasa: owner cuma boleh mengelola baris ber-role `cashier`.

## Kondisi data saat ini

- Toko `SALSA` ada, id `2ca2b8e1-a980-43c3-849a-742960c3eb47`, dibuat 29 Agu 2026 09:38 UTC oleh developer.
- **Faruk (`farukwidjayanto96@gmail.com`) TIDAK punya baris `store_members` sama sekali** — bukan di SALSA, bukan di toko lain.

Jadi langkah DELETE sudah berhasil (atau baris itu memang belum pernah ada). Yang belum terjadi adalah INSERT baris baru ber-role `owner`.

## Dugaan penyebab sebenarnya (belum dikonfirmasi)

`fetchAllStores()` di `src/pages/Users.tsx` hanya dijalankan sekali saat halaman dimuat (`useEffect` dengan dependency kosong). Toko SALSA baru dibuat 09:38, beberapa menit sebelum laporan ini. Kalau halaman Pengguna sudah terbuka sebelum SALSA dibuat, dropdown toko tidak akan memuat SALSA sehingga tidak ada yang bisa dipilih — bukan error RLS, tapi daftar toko basi.

Constraint dan opsi UI sendiri sudah cocok: `store_members.role` hanya menerima `owner`/`cashier`, dan dropdown mengirim persis nilai itu (`Karyawan` = cashier, `Pemilik` = owner).

## Langkah verifikasi berikutnya (belum dijalankan, tidak ada perubahan)

1. Refresh keras halaman Pengguna, buka dialog edit Faruk, cek apakah SALSA muncul di dropdown toko.
2. Kalau SALSA muncul: pilih SALSA + Pemilik, simpan. Jika gagal, mohon kirim pesan error persis dari toast.
3. Kalau setelah refresh SALSA tetap tidak muncul, masalahnya ada di pengambilan daftar toko, dan perbaikannya adalah me-refresh `allStores` saat dialog dibuka.

## Usulan perbaikan (menunggu persetujuan)

- **Refresh daftar toko** — panggil `fetchAllStores()` juga saat dialog Edit/Tambah pengguna dibuka, agar toko yang baru dibuat langsung tersedia.
- **Kontrol ubah role langsung** — tambahkan dropdown role pada tiap baris keanggotaan yang melakukan `UPDATE` pada `store_members` (sudah diizinkan RLS untuk developer), sehingga tidak perlu lagi hapus-lalu-tambah ulang.

Keduanya murni perubahan frontend; tidak perlu migrasi database.
