/**
 * SUMBER KEBENARAN TUNGGAL modul dokumen: template, penomoran, dan
 * pengisian bagian kosong.
 *
 * Di-import juga oleh Netlify Function. Jangan menyalin isinya ke sana.
 */

import { rupiah, tanggalPanjang, ROMAWI } from "./format.js";

/* ------------------------------------------------------------------
   TIPE ISIAN
   ------------------------------------------------------------------ */
export const TIPE_ISIAN = [
  "teks", "teksPanjang", "angka", "rupiah", "tanggal", "pilihan", "karyawan", "vendor",
];

/** Sub-kunci yang tersedia untuk isian yang menarik dari daftar master. */
export const SUB_KUNCI = {
  karyawan: ["nama", "nik", "jabatan", "alamat"],
  vendor: ["nama", "npwp", "pic", "alamat"],
};

/** Isian yang tidak pernah diketik siapa pun. */
export const ISIAN_OTOMATIS = ["nomor_surat", "tanggal_terbit", "tanggal_terbit_panjang"];

/**
 * Bahasa isi dokumen. Terpisah dari bahasa layar dengan sengaja —
 * lihat komentar tanggalPanjang() di format.js.
 */
export const BAHASA_DOKUMEN = "id";

/* ------------------------------------------------------------------
   NOMOR SURAT
   Format: NNN/KODE/SM/BULAN-ROMAWI/TAHUN  → 014/PKS/SM/IX/2026
   Urutan dihitung terpisah per kode per tahun, reset tiap Januari.

   ASUMSI yang belum dikonfirmasi Abeliana: kode perusahaan "SM" dan
   aturan reset tahunan. Kalau kantor sudah punya buku agenda surat
   berjalan, nomor pertama harus disetel dari nomor terakhir di buku itu
   — bukan dari 001 — dan itu harus beres SEBELUM dokumen pertama terbit,
   karena nomor tidak bisa ditarik kembali. Caranya ada di tutorial,
   Bagian B.
   ------------------------------------------------------------------ */
export const KODE_PERUSAHAAN = "SM";

export function susunNomor({ urut, kode, bulan, tahun }) {
  return `${String(urut).padStart(3, "0")}/${kode}/${KODE_PERUSAHAAN}/${ROMAWI[bulan]}/${tahun}`;
}

/** Kunci penghitung di koleksi `counters`. Satu per kode per tahun. */
export function kunciCounter(kode, tahun) {
  return `${kode}-${tahun}`;
}

export function kodeSah(kode) {
  return /^[A-Z][A-Z0-9]{0,7}$/.test(String(kode || ""));
}

/* ------------------------------------------------------------------
   MENGISI DOKUMEN
   ------------------------------------------------------------------ */

const KOSONG = "…………";

/**
 * Mengganti setiap {{kunci}} dengan nilainya.
 *
 * Kunci bertitik (karyawan.nik) menarik dari daftar master — itulah
 * bagian "muncul sendiri" yang diminta Abeliana di formulir 3.3. Sekali
 * NIK benar di daftar master, dia benar di semua kontrak yang pernah dan
 * akan diterbitkan.
 */
export function isiDokumen(isi, fields, nilai, meta = {}, master = {}) {
  const byKey = {};
  (fields || []).forEach((f) => { byKey[f.key] = f; });
  const karyawan = master.karyawan || [];
  const vendor = master.vendor || [];

  return String(isi || "").replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_, kunci) => {
    if (kunci === "nomor_surat") return meta.nomor || KOSONG;
    if (kunci === "tanggal_terbit") return String(meta.terbit || "").slice(0, 10) || KOSONG;
    if (kunci === "tanggal_terbit_panjang")
      return meta.terbit ? tanggalPanjang(meta.terbit, BAHASA_DOKUMEN) : KOSONG;

    const [k, sub] = kunci.split(".");
    const f = byKey[k];
    const v = (nilai || {})[k];
    if (v === undefined || v === null || v === "") return KOSONG;

    if (f && (f.tipe === "karyawan" || f.tipe === "vendor")) {
      const rec = (f.tipe === "karyawan" ? karyawan : vendor).find((x) => x.id === v);
      if (!rec) return KOSONG;
      return rec[sub || "nama"] ?? KOSONG;
    }
    if (f && f.tipe === "rupiah") return rupiah(v);
    if (f && f.tipe === "tanggal") return tanggalPanjang(v, BAHASA_DOKUMEN);
    return String(v);
  });
}

/**
 * Versi berwarna untuk pratinjau: kuning = masih kosong, biru = terisi,
 * hijau = diisi sistem. Abeliana perlu melihat apa yang belum, bukan
 * menemukan garis kosong waktu dokumennya sudah dicetak.
 */
export function pratinjauDokumen(isi, fields, nilai, meta = {}, master = {}) {
  const escHtml = (s) => String(s).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  return escHtml(isi || "").replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_, kunci) => {
    const otomatis = ISIAN_OTOMATIS.includes(kunci);
    const teks = isiDokumen("{{" + kunci + "}}", fields, nilai, meta, master);
    const kosong = teks.startsWith("…");
    const kelas = kosong ? "blank" : otomatis ? "auto" : "filled";
    return `<span class="${kelas}">${escHtml(kosong ? "{{" + kunci + "}}" : teks)}</span>`;
  });
}

/** Daftar isian wajib yang masih kosong. */
export function isianKurang(template, nilai) {
  return (template?.fields || [])
    .filter((f) => f.wajib && !String((nilai || {})[f.key] ?? "").trim())
    .map((f) => f);
}

/** Perihal ringkas untuk daftar register — diambil dari pihak utamanya. */
export function ringkasPerihal(template, nilai, master = {}) {
  const f = (template.fields || []).find((x) => x.tipe === "karyawan" && x.key !== "perusahaan")
    || (template.fields || []).find((x) => x.tipe === "vendor");
  if (f) {
    const src = f.tipe === "karyawan" ? (master.karyawan || []) : (master.vendor || []);
    const rec = src.find((x) => x.id === nilai[f.key]);
    if (rec) return `${rec.nama} — ${template.nama?.id || template.nama}`;
  }
  return template.nama?.id || String(template.nama || "");
}

/** Kunci isian dari nama yang diketik. Huruf kecil, tanpa aksen, tanpa spasi. */
export function slugKunci(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32) || "isian";
}

/** Kunci yang masih dipakai di badan dokumen — dipakai sebelum menghapus isian. */
export function kunciDipakai(isi, key) {
  return new RegExp("\\{\\{" + key + "(\\.[a-zA-Z0-9_]+)?\\}\\}").test(String(isi || ""));
}

/* ------------------------------------------------------------------
   PEMAKAIAN DOKUMEN
   Sebuah dokumen terbit hanya bisa ditempel ke SATU permintaan atau
   SATU pengajuan reimburse. Setelah itu tidak pernah bebas lagi —
   termasuk kalau yang merujuknya dibatalkan.

   Keputusan Sony 5 Sep 2026, alasannya: dokumen itu mungkin sudah
   dicetak dan beredar. Dua dokumen berbeda dengan nomor yang sama jauh
   lebih merepotkan daripada register yang bolong.
   ------------------------------------------------------------------ */
export function dokumenBebas(daftarDokumen) {
  return (daftarDokumen || []).filter((d) => !d.pakai && !d.batal);
}

export function statusPemakaian(d) {
  if (d.batal) return "dibatalkan";
  if (d.pakai) return "terpakai";
  return "bebas";
}

export const STATUS_PERMINTAAN = ["diminta", "terbit", "ttd", "selesai"];
export const PERMINTAAN_NADA = {
  diminta: "muted", terbit: "info", ttd: "warn", selesai: "ok", dibatalkan: "muted",
};
