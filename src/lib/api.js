/**
 * Satu-satunya pintu keluar untuk MENGUBAH data.
 *
 * Browser tidak pernah menulis ke Firestore langsung (lihat
 * firestore.rules). Setiap perubahan lewat sini, membawa ID token
 * pengguna, dan diperiksa ulang di sisi server.
 */
import { auth } from "./firebase.js";

/**
 * Dua jenis kegagalan sengaja dibedakan, karena obatnya berbeda:
 *
 *  - RESPONS BUKAN JSON  -> function-nya belum ter-deploy atau salah nama.
 *                           Yang perlu diperiksa: Netlify, bukan datanya.
 *  - JSON dengan ok:false -> aksinya ditolak. Pesannya sudah menjelaskan
 *                           apa yang salah dan apa langkah perbaikannya.
 *
 * Pelajaran 26 Agu 2026: satu try/catch yang membungkus dua hal berbeda
 * membuat error izin dilaporkan sebagai "password salah", dan salah
 * didiagnosis berjam-jam.
 */
export class ApiGagal extends Error {
  constructor(pesan, jenis) {
    super(pesan);
    this.jenis = jenis; // "belum-deploy" | "ditolak" | "jaringan"
  }
}

export async function panggil(fungsi, muatan) {
  const u = auth.currentUser;
  if (!u) throw new ApiGagal("Sesi kamu sudah habis. Muat ulang halaman lalu masuk lagi.", "ditolak");

  let token;
  try {
    token = await u.getIdToken();
  } catch {
    throw new ApiGagal("Gagal mengambil token sesi. Muat ulang halaman lalu masuk lagi.", "ditolak");
  }

  let res;
  try {
    res = await fetch(`/.netlify/functions/${fungsi}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(muatan || {}),
    });
  } catch {
    throw new ApiGagal("Tidak bisa menghubungi server. Periksa koneksi internetmu, lalu coba lagi.", "jaringan");
  }

  const teks = await res.text();
  let data;
  try {
    data = JSON.parse(teks);
  } catch {
    throw new ApiGagal(
      `Fungsi "${fungsi}" belum ter-deploy di Netlify (server menjawab bukan JSON). ` +
      `Cara memastikan: buka /.netlify/functions/${fungsi} di browser — kalau muncul ` +
      `"Method not allowed" berarti fungsinya hidup. Kalau muncul halaman 404, deploy-nya belum jalan.`,
      "belum-deploy");
  }

  if (!res.ok || data.ok === false) {
    throw new ApiGagal(data.pesan || "Aksi ditolak tanpa penjelasan.", "ditolak");
  }
  return data;
}
