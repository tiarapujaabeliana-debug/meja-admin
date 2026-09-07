/**
 * Mengubah dokumen yang sudah terbit menjadi berkas .docx.
 *
 * Penyusun berkasnya ada di _lib/docx.js — ditulis sendiri, tanpa paket
 * luar. Alasannya ditulis lengkap di kepala berkas itu; ringkasnya, paket
 * `docx` mati di Netlify karena berkas yang diminta runtime tidak ikut
 * tersalin ke dalam zip fungsinya.
 *
 * Yang dipakai adalah `isiJadi` — teks yang SUDAH terisi dan disimpan saat
 * dokumen diterbitkan. Bukan dirender ulang dari template. Kalau dirender
 * ulang, kontrak yang dicetak tahun ini bisa berbunyi berbeda tahun depan
 * hanya karena alamat karyawannya diperbarui di daftar master.
 */
import { handlerAman, oke, salah } from "./_lib/admin.js";
import { buatDocx } from "./_lib/docx.js";

/**
 * Menerjemahkan satu baris teks menjadi paragraf.
 *
 * Aturannya sengaja sederhana dan bisa ditebak Abeliana waktu menyusun
 * template, bukan pintar-pintaran:
 *
 *  - Baris yang HURUFNYA KAPITAL SEMUA dianggap judul → dibuat tebal.
 *    Yang diawali "PASAL" tetap rata kiri; sisanya rata tengah, karena
 *    judul dokumen memang di tengah dan kepala pasal memang di kiri.
 *  - Baris yang mengandung tiga spasi berturut-turut dianggap sedang
 *    diratakan tangan ("Nama       : Rizky"), jadi dipakaikan huruf
 *    lebar tetap supaya titik duanya benar-benar lurus. Di huruf
 *    proporsional, perataan spasi seperti itu selalu berantakan.
 */
function baris(teks) {
  const bersih = teks.replace(/\s+$/, "");
  if (!bersih.trim()) return { teks: "" };

  const hurufSaja = bersih.replace(/[^A-Za-z]/g, "");
  const judul = hurufSaja.length > 3 && hurufSaja === hurufSaja.toUpperCase();
  const pasal = /^\s*PASAL/i.test(bersih);

  // Baris yang diratakan tangan tidak pernah dibuat rata tengah, walau
  // hurufnya kapital semua. Baris tanda tangan "PIHAK PERTAMA        PIHAK
  // KEDUA" memenuhi syarat judul, dan kalau ditengahkan kedua kolom tanda
  // tangannya berhenti sejajar dengan nama di bawahnya (ketahuan 7 Sep 2026
  // waktu kontrak contoh dibuka di pembaca docx).
  const rataTangan = /\s{3,}/.test(bersih);

  return {
    teks: bersih,
    tebal: judul,
    rata: judul && !pasal && !rataTangan ? "tengah" : "kiri",
    mono: rataTangan,
    jarakSesudah: judul ? 160 : 100,
  };
}

export const handler = handlerAman(async ({ db, muatan }) => {
  const nomor = String(muatan.nomor || "");
  if (!nomor) throw salah("Nomor dokumen tidak disertakan.");

  const snap = await db.collection("dokumen").doc(nomor).get();
  if (!snap.exists) throw salah(`Dokumen ${nomor} tidak ditemukan di register.`);
  const d = snap.data();

  const isi = String(d.isiJadi || "");
  if (!isi.trim()) {
    throw salah(
      `Dokumen ${nomor} tersimpan tanpa isi. Ini seharusnya tidak terjadi — laporkan nomor ini, ` +
      `dan sementara itu terbitkan ulang dokumennya dari template.`, 500);
  }

  const paragrafs = isi.split("\n").map(baris);

  // Dokumen yang dibatalkan tetap bisa diunduh — arsipnya harus lengkap —
  // tapi diberi tanda di baris pertama supaya tidak pernah beredar sebagai
  // dokumen sah tanpa ada yang menyadarinya.
  if (d.batal) {
    paragrafs.unshift(
      {
        teks: `— DOKUMEN DIBATALKAN ${d.batal.waktu} —`,
        tebal: true, rata: "tengah", warna: "A33A2F", ukuran: 20, jarakSesudah: 60,
      },
      {
        teks: String(d.batal.alasan || ""),
        rata: "tengah", warna: "A33A2F", ukuran: 18, jarakSesudah: 240,
      },
    );
  }

  const buf = buatDocx(paragrafs, { judul: nomor, penulis: d.olehNama || "Meja Admin" });

  return oke({
    nama: nomor.replace(/\//g, "-") + ".docx",
    base64: buf.toString("base64"),
    tipe: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}, { perlu: ["pemohon", "superadmin", "director", "owner"] });
