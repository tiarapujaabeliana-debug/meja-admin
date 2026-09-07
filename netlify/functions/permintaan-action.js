/**
 * Permintaan dokumen: siapa pun boleh meminta, superadmin yang menerbitkan.
 * Penerbitan dokumennya sendiri ada di dokumen-action.js — di sini hanya
 * daur hidup permintaannya.
 */
import { handlerAman, oke, salah, catat, stempelServer } from "./_lib/admin.js";
import { STATUS_PERMINTAAN } from "../../src/lib/dokumenMeta.js";

async function nomorBaru(tx, db, tahun) {
  const ref = db.collection("counters").doc(`PD-${tahun}`);
  const snap = await tx.get(ref);
  const urut = (snap.exists ? snap.data().urut : 0) + 1;
  tx.set(ref, { urut, jenis: "PD", tahun }, { merge: true });
  return `PD-${tahun}-${String(urut).padStart(4, "0")}`;
}

export const handler = handlerAman(async ({ db, aku, muatan }) => {
  const { aksi } = muatan;

  if (aksi === "buat") {
    const tid = String(muatan.tid || "");
    const untuk = String(muatan.untuk || "").trim();
    const catatan = String(muatan.catatan || "").trim();
    if (!tid) throw salah("Jenis dokumen belum dipilih.");
    if (!untuk) throw salah("Kolom “Untuk” belum diisi — tulis nama karyawan atau nama vendornya.");

    const tpl = await db.collection("template").where("tid", "==", tid)
      .orderBy("versi", "desc").limit(1).get();
    if (tpl.empty) throw salah("Jenis dokumen yang dipilih tidak ada di daftar template.");

    const waktu = stempelServer();
    const hasil = await db.runTransaction(async (tx) => {
      const no = await nomorBaru(tx, db, new Date().getFullYear());
      tx.set(db.collection("permintaan").doc(no), {
        no, tid, untuk, catatan,
        pemohonUid: aku.uid,
        pemohonNama: aku.nama || aku.email,
        status: "diminta",
        dokumen: null,
        dibuat: waktu, diubah: waktu,
      });
      catat(tx, db, { ref: no, aksi: "minta", dari: "—", ke: "diminta", aktor: aku });
      return { no };
    });
    return oke({ ...hasil, pesan: "Permintaan terkirim ke Abeliana." });
  }

  if (aksi === "majukan") {
    const no = String(muatan.no || "");
    if (!no) throw salah("Nomor permintaan tidak disertakan.");
    if (!["superadmin", "owner"].includes(aku.peran)) {
      throw salah("Hanya superadmin yang boleh memajukan status permintaan dokumen.", 403);
    }

    const hasil = await db.runTransaction(async (tx) => {
      const ref = db.collection("permintaan").doc(no);
      const snap = await tx.get(ref);
      if (!snap.exists) throw salah(`Permintaan ${no} tidak ditemukan.`);
      const r = snap.data();
      const i = STATUS_PERMINTAAN.indexOf(r.status);
      if (i < 0) throw salah(`Status "${r.status}" tidak ada di alur permintaan.`);
      if (i >= STATUS_PERMINTAAN.length - 1) throw salah(`Permintaan ${no} sudah selesai.`, 409);
      if (!r.dokumen) throw salah(
        `Permintaan ${no} belum punya dokumen. Terbitkan dokumennya dulu dari template, atau ` +
        `tempelkan nomor dokumen yang sudah terbit — statusnya baru bisa maju setelah itu.`);
      const ke = STATUS_PERMINTAAN[i + 1];
      tx.update(ref, { status: ke, diubah: stempelServer() });
      catat(tx, db, { ref: no, aksi: "majukan", dari: r.status, ke, aktor: aku });
      return { no, status: ke };
    });
    return oke(hasil);
  }

  if (aksi === "batalkan") {
    const no = String(muatan.no || "");
    const alasan = String(muatan.alasan || "").trim();
    if (!no) throw salah("Nomor permintaan tidak disertakan.");
    if (!alasan) throw salah("Alasan wajib diisi — pemohon akan membacanya.");

    await db.runTransaction(async (tx) => {
      const ref = db.collection("permintaan").doc(no);
      const snap = await tx.get(ref);
      if (!snap.exists) throw salah(`Permintaan ${no} tidak ditemukan.`);
      const r = snap.data();
      const akulah = r.pemohonUid === aku.uid;
      if (!akulah && !["superadmin", "owner"].includes(aku.peran)) {
        throw salah("Hanya pemohonnya sendiri atau superadmin yang boleh membatalkan permintaan.", 403);
      }
      if (r.status === "selesai") throw salah("Permintaan yang sudah selesai tidak bisa dibatalkan.", 409);
      /* Dokumen yang sudah terlanjur terbit untuk permintaan ini TIDAK ikut
         dilepas nomornya. Kalau dokumennya memang salah, batalkan dokumennya
         sendiri lewat halaman Dokumen terbit — dengan alasannya sendiri. */
      tx.update(ref, { status: "dibatalkan", alasanBatal: alasan, diubah: stempelServer() });
      catat(tx, db, { ref: no, aksi: "batalkan", dari: r.status, ke: "dibatalkan", aktor: aku, alasan });
    });
    return oke({ pesan: `Permintaan ${no} dibatalkan.` });
  }

  throw salah(`Aksi "${aksi}" tidak dikenal.`);
}, { perlu: ["pemohon", "superadmin", "director", "owner"] });
