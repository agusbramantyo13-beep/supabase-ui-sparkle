# Investigasi: "new row violates row-level security policy for table stores"

## Temuan (diverifikasi langsung ke database, bukan dugaan)

### 1. Policy INSERT pada `public.stores` saat ini
Setelah semua migrasi diterapkan berurutan, policy final berasal dari migrasi `20260718093322` (yang men-DROP semua policy lama termasuk "Owners can create stores"):

```
stores_insert  INSERT  TO authenticated  WITH CHECK: is_developer(auth.uid())
stores_select  SELECT  USING: id IN (SELECT get_user_store_ids(auth.uid()))
stores_update  UPDATE  is_developer(auth.uid()) OR is_store_owner(auth.uid(), id)
stores_delete  DELETE  is_developer(auth.uid())
```

Jadi hanya akun ber-role `developer` yang boleh insert. Policy lama `WITH CHECK (auth.uid() IS NOT NULL)` sudah tidak ada lagi.

### 2. Nilai role yang valid di database
Enum `public.user_role` saat ini hanya punya **dua** nilai:

```
developer, staff
```

Nilai lama (`owner`, `shopkeeper`, `cashier`, `warehouse_admin`) tidak ada lagi di enum `profiles.role`. Jadi `'developer'` memang valid dan cocok dengan yang dicek frontend.

`is_developer(_user_id)` = `EXISTS (SELECT 1 FROM profiles WHERE id=_user_id AND role='developer')` — cocok persis.

Isi tabel `profiles` saat ini: **1 baris role `developer`** (agusbramantyo13@gmail.com), 5 baris role `staff`.

### 3. Trigger pada INSERT `stores`
Tidak ada trigger non-internal sama sekali pada `public.stores` (0 trigger). Jadi penolakan murni datang dari RLS.

### 4. Catatan tentang role di `store_members`
`store_members.role` adalah kolom text terpisah (bukan enum `user_role`) dan policy `store_members_insert` mengizinkan developer insert apa pun; kode mengirim `role: 'owner'` — ini tidak menyebabkan error pada tabel `stores`.

## Kesimpulan sementara (belum terkonfirmasi 100%)

Secara DB, akun dengan `profiles.role = 'developer'` **seharusnya bisa** insert ke `stores`. Karena itu penyebab paling mungkin dari error tersebut adalah salah satu dari:

1. Akun yang dipakai saat error bukan akun developer tersebut (mis. login dengan akun `staff` lain, atau ada dua akun auth dengan email mirip). Tombol memang di-gate frontend, tapi state `profileRole` bisa berasal dari sesi lain jika sesi berganti tanpa reload.
2. Sesi kedaluwarsa/anon: `auth.uid()` bernilai NULL saat request dijalankan, sehingga `is_developer(NULL)` = false.
3. Error yang dilihat berasal dari cache aplikasi/build lama sebelum migrasi 18 Juli diterapkan (kurang mungkin, karena policy lama justru lebih longgar).

Diagnosis pastinya belum bisa saya klaim tanpa mengetahui akun (user id) yang menghasilkan error.

## Langkah verifikasi yang saya usulkan (jika Anda setuju melanjutkan)

1. Jalankan uji insert terimpersonasi di DB sebagai user id developer (`e77110d3-...`) untuk membuktikan policy lolos untuk akun itu — di transaksi yang di-rollback, tanpa mengubah data.
2. Minta user yang error menjalankan cek cepat di aplikasi: bandingkan `auth.uid()` sesi aktif dengan id baris `profiles` yang role-nya `developer`.
3. Kalau ternyata akun itu bukan developer, keputusannya jadi soal kebijakan: ubah role akun tersebut, atau longgarkan policy insert (mis. izinkan juga pemilik toko) — ini butuh persetujuan Anda karena menyangkut keamanan.

Belum ada perubahan kode maupun database yang dilakukan.
