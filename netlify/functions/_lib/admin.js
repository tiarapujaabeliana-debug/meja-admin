/**
 * Perkakas bersama semua Netlify Function.
 *
 * Di sinilah satu-satunya tempat aplikasi ini boleh MENULIS ke Firestore.
 * Browser tidak pernah menulis (lihat firestore.rules), jadi setiap
 * perubahan pasti lewat salah satu fungsi yang meng-import berkas ini —
 * dan karena itu, setiap perubahan pasti punya jejak.
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

/* ------------------------------------------------------------------
   INISIALISASI
   ------------------------------------------------------------------ */
function kunciPrivat() {
  const k = process.env.FIREBASE_PRIVATE_KEY || "";
  // Netlify menyimpan baris baru sebagai \n literal kalau ditempel lewat UI.
  return k.includes("\\n") ? k.replace(/\\n/g, "\n") : k;
}

let siap = false;
export function mulai() {
  if (siap || getApps().length) { siap = true; return; }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = kunciPrivat();
  if (!projectId || !clientEmail || !privateKey) {
    const e = new Error(
      "Kredensial Firebase Admin belum lengkap di Netlify. Buka Netlify → Site configuration → " +
      "Environment variables, lalu isi FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, dan " +
      "FIREBASE_PRIVATE_KEY dari berkas service account JSON. Setelah diisi, deploy ulang.");
    e.kode = "konfig";
    throw e;
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  siap = true;
}

export function firestore() { mulai(); return getFirestore(); }
export { FieldValue };

/* ------------------------------------------------------------------
   JAM SERVER
   Satu-satunya sumber waktu. Tidak ada layar yang mengirim tanggal, dan
   tidak ada fungsi yang menerimanya — begitu ada satu, seluruh alasan
   memakai jam server gugur.
   ------------------------------------------------------------------ */
export function stempelServer() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function tanggalServer() { return stempelServer().slice(0, 10); }

/* ------------------------------------------------------------------
   JAWABAN
   ------------------------------------------------------------------ */
const HEAD = { "Content-Type": "application/json; charset=utf-8" };

export const oke = (data = {}) => ({ statusCode: 200, headers: HEAD, body: JSON.stringify({ ok: true, ...data }) });

export const tolak = (pesan, kode = 400) =>
  ({ statusCode: kode, headers: HEAD, body: JSON.stringify({ ok: false, pesan }) });

/**
 * Membungkus sebuah handler.
 *
 * Tiap kepedulian ditangani terpisah: metode salah, kredensial kurang,
 * token tidak sah, pengguna belum terdaftar, dan aksi gagal masing-masing
 * punya pesannya sendiri. Satu try/catch yang membungkus semuanya pernah
 * membuat error izin dilaporkan sebagai "password salah" dan salah
 * didiagnosis berjam-jam (26 Agu 2026).
 */
export function handlerAman(jalankan, { perlu } = {}) {
  return async (event) => {
    if (event.httpMethod !== "POST") return tolak("Method not allowed", 405);

    let db;
    try { db = firestore(); }
    catch (e) { return tolak(e.message, 500); }

    let akun;
    try {
      const head = event.headers.authorization || event.headers.Authorization || "";
      const token = head.startsWith("Bearer ") ? head.slice(7) : null;
      if (!token) return tolak("Permintaan tanpa token. Muat ulang halaman lalu masuk lagi.", 401);
      akun = await getAuth().verifyIdToken(token);
    } catch {
      return tolak("Sesi kamu sudah kedaluwarsa. Muat ulang halaman lalu masuk lagi.", 401);
    }

    let aku;
    try {
      const snap = await db.collection("users").doc(akun.uid).get();
      if (!snap.exists) {
        return tolak(
          "Akunmu belum terdaftar sebagai pengguna aplikasi. Minta superadmin menambahkanmu " +
          "di menu Pengguna & peran. Kalau kamu superadmin pertama, dokumen users/" + akun.uid +
          " harus dibuat manual sekali di Firebase Console.", 403);
      }
      aku = { uid: akun.uid, email: akun.email, ...snap.data() };
      if (aku.aktif === false) return tolak("Akunmu dinonaktifkan. Hubungi superadmin kalau ini keliru.", 403);
    } catch (e) {
      if (e.kode === "konfig") return tolak(e.message, 500);
      return tolak("Gagal membaca data penggunamu dari Firestore: " + e.message, 500);
    }

    if (perlu && !perlu.includes(aku.peran)) {
      return tolak(
        `Aksi ini hanya untuk ${perlu.map(namaPeran).join(" atau ")}. Peranmu sekarang ${namaPeran(aku.peran)}. ` +
        `Kalau peranmu seharusnya berbeda, minta superadmin mengubahnya di menu Pengguna & peran.`, 403);
    }

    let muatan = {};
    try { muatan = event.body ? JSON.parse(event.body) : {}; }
    catch { return tolak("Isi permintaan bukan JSON yang sah.", 400); }

    try {
      return await jalankan({ db, aku, muatan });
    } catch (e) {
      if (e.tolak) return tolak(e.message, e.kode || 400);
      console.error("[meja-admin]", e);
      return tolak("Aksi gagal di server: " + e.message, 500);
    }
  };
}

export function namaPeran(p) {
  return { superadmin: "Superadmin", director: "Director", owner: "Owner", pemohon: "Pemohon" }[p] || p;
}

/** Penolakan yang disengaja, dengan pesan yang menyebut langkah perbaikannya. */
export function salah(pesan, kode = 400) {
  const e = new Error(pesan);
  e.tolak = true; e.kode = kode;
  return e;
}

/* ------------------------------------------------------------------
   JEJAK AUDIT
   Ditulis di transaksi/batch yang SAMA dengan perubahannya. Tidak pernah
   ada perubahan tanpa jejak, atau jejak tanpa perubahan.
   Nilai LAMA ikut dicatat — jejak yang hanya menyimpan nilai akhir tidak
   bisa menjawab "berubah dari berapa".
   ------------------------------------------------------------------ */
export function catat(tx, db, { ref, aksi, dari, ke, aktor, alasan, tambahan }) {
  const doc = db.collection("events").doc();
  tx.set(doc, {
    ref, aksi,
    dari: dari ?? null,
    ke: ke ?? null,
    aktorUid: aktor.uid,
    aktorNama: aktor.nama || aktor.email || aktor.uid,
    alasan: alasan ?? null,
    waktu: stempelServer(),
    ...(tambahan || {}),
  });
}

/* ------------------------------------------------------------------
   KUNCI PERIODE
   Setelah sebuah periode dikunci, semua mutasi periode itu ditolak —
   termasuk oleh Owner. Membuka kunci wajib beralasan dan tercatat.
   ------------------------------------------------------------------ */
export async function pastikanPeriodeTerbuka(db, periode) {
  if (!periode) return;
  const snap = await db.collection("periodeLock").doc(periode).get();
  if (snap.exists && snap.data().terkunci) {
    throw salah(
      `Periode ${periode} sudah dikunci pada ${snap.data().waktu || "—"}, jadi tidak ada lagi ` +
      `perubahan yang boleh masuk ke periode itu. Kalau memang harus dibuka, superadmin membukanya ` +
      `di menu Ambang & periode dengan menuliskan alasannya.`, 409);
  }
}