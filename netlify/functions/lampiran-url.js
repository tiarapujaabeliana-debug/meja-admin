/**
 * Tautan bertanda tangan untuk lampiran invoice.
 *
 * Bucket-nya privat dan tidak pernah punya tautan permanen. Nota belanja
 * karyawan berisi nama, alamat, kadang nominal yang tidak perlu dibaca
 * orang lain — tautan permanen berarti siapa pun yang pernah menerimanya
 * bisa membukanya lagi bertahun-tahun kemudian, jauh setelah dia pindah
 * kerja. Yang keluar dari sini selalu berumur pendek.
 */
import { createClient } from "@supabase/supabase-js";
import { handlerAman, oke, salah } from "./_lib/admin.js";

const BUCKET = "lampiran";
const UMUR_UNDUH = 60 * 10;   // 10 menit — cukup untuk membuka & menyimpan

function sb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw salah(
      "Kredensial Supabase belum diisi di Netlify. Buka Netlify → Site configuration → " +
      "Environment variables, isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY dari Supabase → " +
      "Project Settings → API. Setelah diisi, deploy ulang.", 500);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

const EKSTENSI_BOLEH = [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".webp"];
const BATAS_BYTE = 10 * 1024 * 1024; // 10 MB

export const handler = handlerAman(async ({ db, aku, muatan }) => {
  const { aksi } = muatan;
  const klien = sb();

  /* --- Tautan untuk MENGUNGGAH. Jalurnya ditentukan server, bukan klien:
     kalau klien boleh menamai jalurnya sendiri, dia bisa menulis ke folder
     orang lain atau menimpa lampiran yang sudah dipakai pengajuan lain. --- */
  if (aksi === "unggah") {
    const namaAsli = String(muatan.nama || "");
    const ukuran = Number(muatan.ukuran || 0);
    const ext = (namaAsli.match(/\.[a-zA-Z0-9]{1,5}$/) || [""])[0].toLowerCase();

    if (!EKSTENSI_BOLEH.includes(ext)) {
      throw salah(
        `Jenis berkas "${ext || "tanpa ekstensi"}" tidak diterima. Yang bisa diunggah: ` +
        `${EKSTENSI_BOLEH.join(", ")}. Kalau notanya difoto, simpan sebagai JPG atau PNG dulu.`);
    }
    if (ukuran > BATAS_BYTE) {
      throw salah(
        `Berkas ${(ukuran / 1024 / 1024).toFixed(1)} MB, batasnya 10 MB. Foto dari HP biasanya bisa ` +
        `dikecilkan lewat menu bagikan → ubah ukuran, atau difoto ulang dengan resolusi lebih rendah.`);
    }

    const acak = Math.random().toString(36).slice(2, 10);
    const jalur = `${aku.uid}/${Date.now()}-${acak}${ext}`;

    const { data, error } = await klien.storage.from(BUCKET).createSignedUploadUrl(jalur);
    if (error) throw salah(
      `Gagal menyiapkan unggahan: ${error.message}. Pastikan bucket "${BUCKET}" sudah dibuat di ` +
      `Supabase → Storage, dan setelan Public bucket-nya MATI.`, 500);

    return oke({ jalur, url: data.signedUrl, token: data.token, nama: namaAsli });
  }

  /* --- Tautan untuk MEMBUKA. Diperiksa dulu: pemohon hanya boleh membuka
     lampiran pengajuannya sendiri. --- */
  if (aksi === "buka") {
    const jalur = String(muatan.jalur || "");
    if (!jalur) throw salah("Jalur berkas tidak disertakan.");

    if (!["superadmin", "owner", "director"].includes(aku.peran)) {
      const milikku = jalur.startsWith(`${aku.uid}/`);
      if (!milikku) {
        // Mungkin lampiran orang lain di pengajuan yang dia ikut lihat —
        // tapi pemohon tidak pernah melihat pengajuan orang lain, jadi ini
        // selalu berarti percobaan membuka berkas yang bukan haknya.
        throw salah("Lampiran ini bukan milikmu, jadi tidak bisa dibuka dari akunmu.", 403);
      }
    }

    const { data, error } = await klien.storage.from(BUCKET).createSignedUrl(jalur, UMUR_UNDUH);
    if (error) throw salah(
      `Gagal membuat tautan: ${error.message}. Kalau berkasnya memang sudah tidak ada di Supabase, ` +
      `lampiran itu perlu diunggah ulang oleh pemohonnya.`, 404);

    return oke({ url: data.signedUrl, kedaluwarsaDetik: UMUR_UNDUH });
  }

  throw salah(`Aksi "${aksi}" tidak dikenal.`);
}, { perlu: ["pemohon", "superadmin", "director", "owner"] });
