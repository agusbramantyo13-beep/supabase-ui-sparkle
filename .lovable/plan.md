# Investigasi: Form Pembelian "Reset Sendiri" (Kehilangan Input)

Investigasi read-only selesai. Tidak ada perubahan kode yang dilakukan.

## Ringkasan temuan

Tidak ada satu pun kode yang secara sengaja me-reload halaman pembelian. Yang ada adalah **beberapa jalur yang meng-unmount seluruh pohon halaman** (termasuk dialog "Input Stok Pembelian" yang menyimpan seluruh state form di local state), plus ketiadaan pengaman apa pun terhadap kehilangan data.

### 1. `window.location.reload` — hanya 1 tempat, dan itu disengaja
- `src/components/AppSidebar.tsx:85` — `handleSwitchStore()`: `setCurrentStore(store); navigate("/"); window.location.reload();`
- Hanya terpicu saat user memilih toko dari dropdown store switcher. Kalau staf tidak sengaja menyentuh switcher toko di sidebar (di HP sidebar mudah terbuka/tersentuh), **seluruh app benar-benar reload dan semua input hilang** — tanpa konfirmasi apa pun. Ini kandidat penyebab yang paling harfiah "app refresh sendiri".
- `window.location.href` lain hanya di `src/pages/Auth.tsx:36` dan `src/pages/OAuthConsent.tsx:43,52,78` (alur login/OAuth, tidak jalan saat sesi normal).

### 2. Guard route memakai early-return spinner → unmount total (penyebab paling mungkin ke-2)
- `src/components/ProtectedRoute.tsx:11-18` — saat `loading` true, render spinner sebagai ganti `children`.
- `src/components/StoreRequiredRoute.tsx:11-17` dan `src/components/RoleBasedRoute.tsx:13-19` — pola sama, memakai `loading` dari `StoreContext`.
- `src/contexts/StoreContext.tsx:41-101` — `fetchStores()` memanggil `setLoading(true)` di awal, dan effect-nya jalan pada setiap perubahan **referensi** objek `user` (`useEffect(..., [user])`, baris 99-101).
- Efeknya: kapan pun `loading` sempat true lagi, React mengganti seluruh subtree halaman dengan spinner → `Inventory` + `StockPurchaseForm` unmount → semua item pembelian yang sudah diketik hilang, dan saat kembali form tampil kosong. Ini terlihat persis seperti "app mereset ke awal".
- Jalur lain yang sama merusaknya: bila `userStoreRole` sempat `null` (mis. query `store_members` gagal karena jaringan sesaat), `RoleBasedRoute` langsung `Navigate to="/sales"` — user terlempar keluar dari halaman pembelian.

### 3. AuthContext: aman untuk TOKEN_REFRESHED, tapi rapuh untuk SIGNED_OUT
- `src/contexts/AuthContext.tsx:31-63` — handler sudah benar menjaga identitas `user` (`setUser(prev => prev?.id === next?.id ? prev : next)`), jadi refresh token 1 jam-an **tidak** memicu refetch StoreContext. Tidak ada redirect/reload di handler ini.
- Namun `src/contexts/AuthContext.tsx:66-70` (`getSession().then(...)`) menulis objek user baru sekali di awal — memicu satu putaran `fetchStores()` tambahan saat boot.
- Risiko nyata: jika refresh token gagal (blip jaringan, token rotation bentrok karena app dibuka di 2 tab/perangkat), Supabase mengeluarkan `SIGNED_OUT` → `user` jadi null → `ProtectedRoute` `Navigate to="/auth"` → semua input hilang tanpa peringatan. Tidak ada retry/toleransi di sini.

### 4. Realtime / polling / React Query — bukan penyebab
- Tidak ada `supabase.channel` / `postgres_changes` / realtime subscription di seluruh `src/`.
- Tidak ada `setInterval`, tidak ada `refetchInterval`, tidak ada `invalidateQueries`. `QueryClient` di `src/App.tsx:39` dibuat tapi praktis tidak dipakai untuk halaman-halaman ini.
- Semua fetch adalah manual `useEffect` sekali jalan (`src/pages/Inventory.tsx:36-38`).

### 5. Service Worker / PWA — tidak me-reload paksa, tapi berisiko crash saat ada rilis baru
- `src/pwa/registerSW.ts` register manual, **tanpa** listener `controllerchange` dan tanpa reload. Bagus.
- Tapi `vite.config.ts:19-33`: `registerType: "autoUpdate"` dengan `skipWaiting: true` + `clientsClaim: true` + `cleanupOutdatedCaches: true`. Jika ada deploy baru saat form terbuka, SW baru langsung mengambil alih dan menghapus cache aset lama; chunk lama yang di-load belakangan (lazy import, dialog, dsb.) bisa gagal → error render. Kombinasi ini adalah pola "reload diam-diam"/crash klasik pada PWA.

### 6. Tidak ada Error Boundary sama sekali
- Pencarian `componentDidCatch`/ErrorBoundary: nol hasil. Satu error render apa pun (mis. chunk gagal dimuat pada poin 5) mem-blank seluruh app, dan satu-satunya jalan keluar bagi staf adalah reload manual → data hilang.

### 7. Form pembelian sendiri
- `src/components/StockPurchaseForm.tsx:129` — seluruh isi (supplier, tanggal, daftar item) hanya di `useState` lokal, tidak ada draft persistence.
- `src/components/StockPurchaseForm.tsx:140-151` — `resetForm()` jalan setiap kali `open` menjadi false. Jadi dialog tertutup karena sebab apa pun = data hilang.
- Tidak ada `beforeunload` guard, sehingga reload/tutup tab tidak pernah dikonfirmasi.

### 8. Faktor lingkungan (tidak terlihat di kode)
Di Android (TWA/PWA) dan Chrome mobile, WebView/tab bisa dibuang OS saat aplikasi lain dibuka (kamera absensi, dialog Bluetooth printer, telepon masuk). Saat kembali, app benar-benar restart dari awal. Secara kode ini tidak bisa dicegah — hanya bisa dilindungi dengan draft persistence.

## Perbaikan yang diusulkan (belum dikerjakan, menunggu persetujuan)

Urut berdasarkan rasio manfaat/risiko:

1. **Draft otomatis untuk form pembelian** — simpan supplier/tanggal/catatan/items ke `localStorage` (per `store_id`) setiap kali berubah, pulihkan saat dialog dibuka dengan banner "Lanjutkan draft sebelumnya?", dan hapus setelah simpan sukses. Ini satu-satunya perbaikan yang melindungi dari semua penyebab, termasuk penyebab OS di poin 8.
2. **Hentikan unmount total oleh guard route** — jangan render spinner menggantikan `children` setelah render pertama berhasil; bedakan "initial loading" vs "refetch di latar". Juga jangan `Navigate` saat `userStoreRole` sementara null karena error jaringan.
3. **Konfirmasi sebelum ganti toko + hapus `window.location.reload()`** di `AppSidebar.tsx:85` (ganti dengan refresh state via context), supaya sentuhan tak sengaja tidak menghancurkan input.
4. **Guard `beforeunload`** saat form pembelian berisi data belum tersimpan.
5. **Error Boundary global** dengan tombol "Coba lagi"/"Muat ulang", supaya crash tidak jadi layar putih.
6. **Ubah strategi update SW** dari `skipWaiting` otomatis menjadi prompt "Versi baru tersedia — muat ulang", sehingga update tidak pernah terjadi diam-diam di tengah input.

Beri tahu poin mana yang ingin dikerjakan (rekomendasi: 1, 2, 3, 4 dulu).
