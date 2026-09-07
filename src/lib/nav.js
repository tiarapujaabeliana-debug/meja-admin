/**
 * Nomor dokumen mengandung garis miring (001/PKS/SM/IX/2026), yang tidak
 * bisa dipakai apa adanya di alamat halaman. Diganti "~" supaya alamatnya
 * tetap bisa di-bookmark dan dikirim lewat WhatsApp tanpa terpotong.
 */
export const slugNomor = (n) => String(n).replace(/\//g, "~");
export const nomorDariSlug = (s) => String(s).replace(/~/g, "/");

/** Mengunduh berkas dari base64 yang dikirim Netlify Function. */
export function unduhBase64(base64, nama, tipe) {
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([buf], { type: tipe }));
  const a = document.createElement("a");
  a.href = url; a.download = nama;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function unduhTeks(teks, nama, tipe = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["﻿" + teks], { type: tipe }));
  const a = document.createElement("a");
  a.href = url; a.download = nama;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
