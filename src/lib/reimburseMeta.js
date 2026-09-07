/**
 * SUMBER KEBENARAN TUNGGAL modul reimburse.
 *
 * Status, urutan persetujuan, pemilihan ambang, dan rumus periode ada di
 * sini saja. Layar mana pun yang butuh salah satunya meng-import dari sini
 * — termasuk Netlify Function, yang meng-import berkas ini langsung.
 * Kalau rumusnya disalin ke dua tempat, cepat atau lambat halaman ringkasan
 * dan halaman detail akan menyebut angka yang berbeda untuk hal yang sama,
 * dan tidak ada yang tahu mana yang benar.
 */

export const STATUS = [
  "draft", "diajukan", "menunggu_director", "menunggu_owner",
  "disetujui", "dikembalikan", "dibatalkan",
];

export const STATUS_FINAL = ["disetujui", "dibatalkan"];

/** Warna semantik, bukan warna aksen. Dipakai komponen Pill. */
export const STATUS_NADA = {
  draft: "muted",
  diajukan: "info",
  menunggu_director: "warn",
  menunggu_owner: "warn",
  disetujui: "ok",
  dikembalikan: "bad",
  dibatalkan: "muted",
};

/* ------------------------------------------------------------------
   PERIODE
   Cut-off 26 → 25, dilabeli bulan tempat periode BERAKHIR.
   Ini ASUMSI, bukan keputusan: pertanyaan 6.3 di formulir kebutuhan
   dijawab "belum bisa dijawab, belum trial". Kalau ternyata perusahaan
   memakai kalender biasa, ubah CUT_OFF di sini saja — seluruh aplikasi
   ikut, karena tidak ada tempat lain yang menghitungnya.
   ------------------------------------------------------------------ */
export const CUT_OFF = 26;

/** "2026-09-07" -> "2026-09" ; "2026-09-28" -> "2026-10" */
export function periodeDari(isoTanggal) {
  const s = String(isoTanggal).slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return s.slice(0, 7);
  if (d < CUT_OFF) return `${y}-${String(m).padStart(2, "0")}`;
  const mm = m === 12 ? 1 : m + 1;
  const yy = m === 12 ? y + 1 : y;
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

/** Rentang tanggal sebuah label periode, untuk ditulis di layar. */
export function rentangPeriode(label) {
  const [y, m] = String(label).split("-").map(Number);
  const mAwal = m === 1 ? 12 : m - 1;
  const yAwal = m === 1 ? y - 1 : y;
  const p = (n) => String(n).padStart(2, "0");
  return {
    mulai: `${yAwal}-${p(mAwal)}-${p(CUT_OFF)}`,
    selesai: `${y}-${p(m)}-${p(CUT_OFF - 1)}`,
  };
}

/* ------------------------------------------------------------------
   AMBANG WAJIB OWNER — append-only, dipilih menurut TANGGAL PENGAJUAN
   ------------------------------------------------------------------ */

/**
 * Mengembalikan versi ambang yang BERLAKU pada tanggal pengajuan,
 * bukan versi terbaru dalam daftar.
 *
 * Tanpa ini, menaikkan ambang bulan depan diam-diam mengubah jalur
 * persetujuan pengajuan bulan lalu yang sudah selesai — dan riwayatnya
 * jadi tidak cocok dengan jejaknya sendiri.
 */
export function ambangBerlaku(daftarAmbang, isoTanggal) {
  const t = String(isoTanggal || "").slice(0, 10);
  const urut = (daftarAmbang || [])
    .filter((a) => String(a.berlakuMulai).slice(0, 10) <= t)
    .sort((a, b) => (a.berlakuMulai < b.berlakuMulai ? 1 : -1));
  return urut[0] || (daftarAmbang || [])[0] || null;
}

export function totalPengajuan(p) {
  return (p?.lines || []).reduce(
    (s, l) => s + (Number(l.qty) || 0) * (Number(l.harga) || 0), 0);
}

/** Ke mana sebuah pengajuan pergi setelah Director menyetujui. */
export function setelahDirector(pengajuan, daftarAmbang) {
  const amb = ambangBerlaku(daftarAmbang, pengajuan.dibuat);
  const batas = amb ? Number(amb.nilai) : Infinity;
  return totalPengajuan(pengajuan) > batas ? "menunggu_owner" : "disetujui";
}

/** Rantai yang akan dilalui sebuah pengajuan, untuk digambar di layar. */
export function jalurPersetujuan(pengajuan, daftarAmbang) {
  const amb = ambangBerlaku(daftarAmbang, pengajuan.dibuat);
  const lewat = amb && totalPengajuan(pengajuan) > Number(amb.nilai);
  return {
    langkah: lewat
      ? ["diajukan", "menunggu_director", "menunggu_owner", "disetujui"]
      : ["diajukan", "menunggu_director", "disetujui"],
    lewatAmbang: !!lewat,
    ambang: amb,
  };
}

/* ------------------------------------------------------------------
   SIAPA BOLEH APA
   Dipakai layar untuk MENGGAMBAR tombol, dan dipakai function untuk
   MENOLAK. Keduanya memanggil fungsi yang sama supaya tidak pernah ada
   tombol yang tampil tapi selalu ditolak, atau sebaliknya.
   ------------------------------------------------------------------ */
export function aksiTersedia(pengajuan, peran, uid) {
  const p = pengajuan;
  const akulah = p.pemohonUid === uid;
  const out = [];
  if (STATUS_FINAL.includes(p.status)) {
    // tidak ada aksi
  } else if (p.status === "draft" && akulah) {
    out.push("submit");
  } else if (p.status === "dikembalikan" && akulah) {
    out.push("submit");
  } else if (p.status === "diajukan" && peran === "superadmin") {
    out.push("verify", "return");
  } else if (p.status === "menunggu_director" && peran === "director") {
    out.push("approve", "return");
  } else if (p.status === "menunggu_owner" && peran === "owner") {
    out.push("approve", "return");
  }
  if (peran === "superadmin" && !STATUS_FINAL.includes(p.status)) out.push("void");
  return out;
}

export const AKSI_BUTUH_ALASAN = ["return", "void"];

/* ------------------------------------------------------------------
   VALIDASI
   Seluruh isian diperiksa dulu, baru ditulis. Satu baris tidak layak
   tidak boleh menyisakan pengajuan setengah tersimpan yang harus
   dibereskan tangan.

   `wajib` di sini BENAR-BENAR diperiksa — bukan cuma dipakai
   menggambar tanda bintang di layar.
   ------------------------------------------------------------------ */
export function validasiPengajuan(draft, akunSah) {
  const e = [];
  if (!String(draft.keperluan || "").trim()) e.push({ k: "keperluan" });
  const lines = draft.lines || [];
  if (lines.length === 0) e.push({ k: "noline" });
  lines.forEach((l, i) => {
    const n = i + 1;
    if (!String(l.desc || "").trim()) e.push({ k: "desc", n });
    if (!l.akun) e.push({ k: "akun", n });
    else if (akunSah && !akunSah.includes(l.akun)) e.push({ k: "akunAsing", n, v: l.akun });
    if (!(Number(l.qty) > 0)) e.push({ k: "qty", n });
    if (!(Number(l.harga) > 0)) e.push({ k: "harga", n });
    if (!l.file) e.push({ k: "file", n });
  });
  return e;
}

/* ------------------------------------------------------------------
   EKSPOR JURNAL
   Satu pengajuan = satu jurnal seimbang: tiap baris biaya jadi debit
   pada akunnya, dan satu baris kredit ke utang reimburse.
   Kode akun ikut terbawa supaya berkasnya tidak perlu dicocokkan tangan
   sebelum diimpor.
   ------------------------------------------------------------------ */
export const AKUN_UTANG = "2-1001";
export const AKUN_UTANG_NAMA = "Accrued Reimbursement Payable";

export function barisJurnal(pengajuan, daftarAkun) {
  const nama = (kode) => (daftarAkun || []).find((a) => a.kode === kode)?.namaEn
    || (daftarAkun || []).find((a) => a.kode === kode)?.nama || "";
  const tgl = String(pengajuan.dibuat).slice(0, 10);
  const rows = (pengajuan.lines || []).map((l) => ({
    Date: tgl,
    "Account Code": l.akun,
    "Account Name": nama(l.akun),
    Description: l.desc,
    Debit: Math.round((Number(l.qty) || 0) * (Number(l.harga) || 0)),
    Credit: 0,
    Memo: pengajuan.no,
  }));
  rows.push({
    Date: tgl,
    "Account Code": AKUN_UTANG,
    "Account Name": AKUN_UTANG_NAMA,
    Description: pengajuan.pemohonNama || "",
    Debit: 0,
    Credit: Math.round(totalPengajuan(pengajuan)),
    Memo: pengajuan.no,
  });
  return rows;
}

export function keCsv(rows) {
  if (!rows.length) return "";
  const kolom = Object.keys(rows[0]);
  const sel = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [kolom.join(","), ...rows.map((r) => kolom.map((k) => sel(r[k])).join(","))].join("\n");
}
