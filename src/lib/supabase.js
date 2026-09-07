/**
 * Supabase dipakai HANYA untuk menyimpan lampiran invoice.
 *
 * Bucket-nya privat. Berkas tidak pernah punya tautan permanen — yang
 * dibagikan adalah signed URL berumur pendek yang diminta lewat Netlify
 * Function. Nota belanja karyawan berisi nama, alamat, kadang nominal
 * gaji; tautan permanen berarti siapa pun yang pernah menerimanya bisa
 * membukanya lagi bertahun-tahun kemudian.
 */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const BUCKET = "lampiran";
export const SUPABASE_SIAP = Boolean(url && key);
export const supabase = SUPABASE_SIAP ? createClient(url, key) : null;

/** Nama berkas yang tidak bisa bertabrakan dan tidak membocorkan nama asli. */
export function jalurLampiran(uid, namaAsli) {
  const ext = (String(namaAsli).match(/\.[a-zA-Z0-9]{1,5}$/) || [""])[0].toLowerCase();
  const acak = Math.random().toString(36).slice(2, 10);
  return `${uid}/${Date.now()}-${acak}${ext}`;
}
