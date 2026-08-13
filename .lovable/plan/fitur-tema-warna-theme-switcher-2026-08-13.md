# Fitur Tema Warna (Theme Switcher)

Menambahkan pilihan skema warna per-user, tersimpan di database, berlaku real-time. Hanya warna yang berubah — layout, ukuran, posisi, font, dan logika bisnis tidak disentuh.

## 1. Rencana implementasi

**Definisi tema (CSS variables)**
- Semua tema didefinisikan di `src/index.css` sebagai blok `[data-theme="..."]` yang hanya meng-override token warna HSL yang sudah ada (`--background`, `--card`, `--primary`, `--accent`, `--border`, `--muted`, `--sidebar-*`, dst).
- Tema "Default" = nilai `:root` sekarang, tidak diubah sama sekali.
- Tidak ada perubahan pada `tailwind.config.ts` — semua utility sudah membaca variabel ini, jadi seluruh app ikut berubah otomatis.

**Penerapan runtime**
- Context baru `src/contexts/ThemeContext.tsx`: menyimpan tema aktif, menulis `document.documentElement.setAttribute("data-theme", theme)` → perubahan instan tanpa reload.
- Urutan pembacaan: `localStorage` (instan, anti-flicker) → lalu sinkron dari database saat sesi siap → saat user memilih tema, simpan ke keduanya.
- Provider dipasang di `src/App.tsx` di dalam `AuthProvider` (satu baris pembungkus, tidak mengubah struktur route).

**UI**
- Tab baru **"Tampilan"** di `src/pages/Settings.tsx` (`TabsList` jadi 6 kolom).
- Isi tab: kartu berisi grid pilihan tema, tiap opsi menampilkan swatch warna + nama; klik = langsung aktif dan tersimpan.

**File yang tersentuh**: `src/index.css`, `src/contexts/ThemeContext.tsx` (baru), `src/App.tsx` (1 provider), `src/pages/Settings.tsx` (1 tab baru). Tidak ada halaman lain yang diubah.

## 2. Struktur database

Menambah satu kolom ke tabel `profiles` yang sudah ada (per-user, ikut ke device manapun):

```sql
ALTER TABLE public.profiles
  ADD COLUMN theme text NOT NULL DEFAULT 'default';
```

- Punya default, jadi baris lama aman dan tidak ada backfill.
- Tidak perlu tabel baru maupun policy baru: `profiles` sudah punya RLS di mana user bisa membaca dan memperbarui barisnya sendiri. Saat implementasi akan diverifikasi ulang bahwa policy UPDATE untuk diri sendiri memang ada; kalau ternyata terbatas, akan ditambahkan policy update kolom milik sendiri.

## 3. Risiko terhadap fitur yang sedang dipakai harian

- **Risiko rendah secara fungsional**: perubahan bersifat CSS + satu kolom baru bernilai default. Tidak ada query penjualan/stok/kas yang disentuh.
- **Warna hardcoded**: jika di beberapa halaman masih ada kelas seperti `text-white`/`bg-green-500`, halaman itu tidak ikut berubah tema (tampak tidak konsisten, bukan rusak). Akan dicek dan diperbaiki hanya jika sepele; selebihnya dilaporkan.
- **Flicker tema saat load**: dicegah dengan membaca `localStorage` sebelum render.
- **Kontras/aksesibilitas**: setiap tema disusun agar `foreground` di atas `background`/`primary` memenuhi kontras ≥ 4.5:1, dan status (sukses/peringatan/destruktif) tetap dapat dibedakan. Diverifikasi dengan screenshot halaman Penjualan dan tabel Riwayat Transaksi per tema.
- **Cetak struk**: printer termal tidak terpengaruh warna layar.
- **Rollback**: cukup set tema kembali ke Default; kolom database tidak mengganggu apa pun.

## 4. Usulan tema

Semua tema tetap gelap (nyaman untuk shift panjang), hanya karakter warnanya berbeda.

1. **Default (Teal Gelap)** — seperti sekarang. bg `222 24% 8%`, primary teal `184 62% 40%`.
2. **Dark Ocean** — biru laut tenang. bg `217 33% 9%`, card `217 30% 12%`, primary `210 90% 55%`, border `217 20% 22%`, teks `210 20% 96%`.
3. **Warm Amber** — hangat, kontras tinggi untuk area terang. bg `28 18% 8%`, card `28 16% 12%`, primary `36 92% 52%` dengan teks tombol gelap `30 40% 10%`, border `28 14% 22%`.
4. **Slate Mono** — netral abu, paling minim distraksi untuk pembacaan tabel panjang. bg `220 16% 9%`, card `220 14% 13%`, primary `220 12% 62%` dengan teks tombol gelap, border `220 10% 24%`.

Warna status (sukses hijau, peringatan kuning, destruktif merah) sedikit disesuaikan per tema agar tetap kontras, tapi maknanya tidak berubah.
