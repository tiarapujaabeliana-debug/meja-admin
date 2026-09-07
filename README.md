# Meja Admin

Aplikasi internal untuk **pengajuan reimburse** dan **penerbitan dokumen**
(kontrak, PKS, surat perusahaan) beserta **register nomor suratnya**.

Panduan pemasangan lengkap ada di berkas terpisah: **TUTORIAL-DEPLOY.md**.
README ini untuk orang yang membaca kodenya.

## Susunan

| Lapis | Pilihan |
|---|---|
| Front-end | React 18 + Vite + Tailwind |
| Data | Firebase Firestore |
| Login | Firebase Auth (email/password) |
| Mutasi terjaga | Netlify Functions + Firebase Admin SDK |
| Lampiran | Supabase Storage, bucket privat + signed URL |
| Hosting | Netlify, deploy dari GitHub |

## Aturan yang tidak boleh dilanggar

1. **Browser tidak pernah menulis ke Firestore.** Semua koleksi
   `allow write: if false`, termasuk untuk Owner. Setiap perubahan lewat
   Netlify Function, dan karena itu setiap perubahan punya jejak.
2. **Tanggal dari jam server.** Tidak ada layar yang menyediakan kolom
   tanggal untuk tanggal pengajuan atau tanggal terbit dokumen. Tanggal
   *isi* dokumen (mulai kerja, mulai berlaku) memang diketik — itu hal
   yang berbeda.
3. **Nomor dokumen dialokasikan di dalam transaksi**, dan tidak pernah
   kembali ke kolam. Register boleh bolong; yang bolong punya alasan.
4. **Data historis append-only.** Ambang dan template ditambah versi,
   tidak ditimpa. Pemilihannya menurut tanggal berlaku, bukan yang terbaru.
5. **Dibatalkan, bukan dihapus.** Selalu dengan alasan wajib.
6. **Jejak audit ditulis di transaksi yang sama** dengan perubahannya,
   lengkap dengan nilai lamanya.

Alasan tiap aturan ditulis di komentar berkas yang bersangkutan, dan
diringkas untuk pengguna di halaman **Aturan main** di dalam aplikasi.

## Peta berkas

```
src/lib/reimburseMeta.js   sumber kebenaran: status, ambang, periode, validasi, ekspor jurnal
src/lib/dokumenMeta.js     sumber kebenaran: template, penomoran, pengisian dokumen
src/lib/format.js          rupiah & tanggal (dipakai server juga)
src/lib/i18n.jsx           kamus ID/EN — tidak boleh ada teks layar di luar sini
src/lib/store.jsx          semua langganan Firestore; layar tidak query sendiri
src/lib/api.js             satu-satunya pintu keluar untuk mengubah data
netlify/functions/         satu berkas per modul; meng-import src/lib yang sama
uji/uji-logika.js          uji rumus dengan data sintetis (npm run uji)
firestore.rules            tempel ke Firebase Console
```

Netlify Function meng-import `src/lib/*.js` **langsung**, bukan menyalinnya.
Itu yang menjamin server dan layar tidak pernah memakai rumus berbeda.

## Perintah

```bash
npm install
npm run dev      # jalan di komputer sendiri (butuh .env, lihat .env.example)
npm run build    # wajib lolos sebelum menyerahkan apa pun
npm run uji      # uji logika dengan data sintetis
```

## Gaya kode

- Nama fungsi domain, komentar, dan seluruh teks layar **Bahasa Indonesia**.
  Istilah teknis tetap Inggris.
- Komentar menjelaskan **kenapa**, bukan apa. Setiap keputusan tidak lazim
  menyebut alasannya dan apa yang rusak tanpanya.
- Warna hanya dari `tailwind.config.js`. Jangan menulis hex di komponen.
- Pesan kesalahan menyebutkan **langkah perbaikannya**, bukan cuma
  memberitahu ada yang salah.
