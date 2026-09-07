/**
 * Pemformatan angka & tanggal.
 *
 * Dipakai bersama oleh browser DAN Netlify Function (function meng-import
 * berkas ini langsung), supaya tidak pernah ada dua versi rumus yang
 * berbeda antara yang ditampilkan dan yang disimpan.
 */

export const BULAN = {
  id: ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"],
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
};
export const HARI = {
  id: ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"],
  en: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
};
export const ROMAWI = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];

export function rupiah(n) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(v));
}

export function angka(n) {
  const v = Number(n);
  return isFinite(v) ? new Intl.NumberFormat("id-ID").format(v) : "—";
}

/**
 * `loc` sengaja dipisahkan dari bahasa layar.
 *
 * Bahasa TAMPILAN boleh ikut siapa yang sedang melihat. ISI DOKUMEN tidak:
 * kontrak berbahasa Indonesia yang dibuka Director tidak boleh tercetak
 * "Saturday, 5 September". Dokumen yang isinya berubah tergantung siapa
 * yang membuka adalah dokumen yang tidak bisa dipakai sebagai bukti.
 */
export function tanggalPanjang(iso, loc = "id") {
  if (!iso) return "";
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  if (isNaN(d)) return String(iso);
  const k = HARI[loc] ? loc : "id";
  return `${HARI[k][d.getDay()]}, ${d.getDate()} ${BULAN[k][d.getMonth()]} ${d.getFullYear()}`;
}

export function tanggalPendek(iso, loc = "id") {
  if (!iso) return "—";
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  if (isNaN(d)) return String(iso);
  const k = BULAN[loc] ? loc : "id";
  return `${d.getDate()} ${BULAN[k][d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

/** ISO "2026-09-07 14:22" dari sebuah Date. Dipakai HANYA di server. */
export function stempel(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
