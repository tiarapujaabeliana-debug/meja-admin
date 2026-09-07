/**
 * Template dokumen — APPEND-ONLY.
 *
 * Menyimpan berarti menambah versi baru, bukan menimpa yang lama. Dokumen
 * yang sudah terbit menyimpan {tid, versi} sehingga tetap menunjuk versi
 * yang dipakai waktu dia dicetak. Tanpa ini, mengubah satu pasal hari ini
 * diam-diam mengubah bunyi semua kontrak yang sudah ditandatangani —
 * dan tidak ada yang bisa membuktikan isi aslinya.
 */
import { handlerAman, oke, salah, catat, stempelServer } from "./_lib/admin.js";
import { kodeSah, TIPE_ISIAN, slugKunci } from "../../src/lib/dokumenMeta.js";

function periksaFields(fields) {
  const kunci = new Set();
  for (const f of fields) {
    if (!f.key || !/^[a-z][a-z0-9_]{0,31}$/.test(f.key)) {
      throw salah(`Kunci isian "${f.key}" tidak sah. Pakai huruf kecil, angka, dan garis bawah saja.`);
    }
    if (kunci.has(f.key)) throw salah(`Kunci {{${f.key}}} dipakai dua kali. Tiap isian harus punya kunci sendiri.`);
    kunci.add(f.key);
    if (!TIPE_ISIAN.includes(f.tipe)) throw salah(`Tipe isian "${f.tipe}" tidak dikenal.`);
    if (f.tipe === "pilihan" && !(f.opsi || []).length) {
      throw salah(`Isian "${f.label?.id || f.key}" bertipe Pilihan tapi daftar pilihannya kosong.`);
    }
  }
}

export const handler = handlerAman(async ({ db, aku, muatan }) => {
  const { aksi } = muatan;

  if (aksi === "simpan") {
    const t = muatan.template || {};
    const nama = String(t.nama?.id || "").trim();
    const kode = String(t.kode || "").toUpperCase().replace(/\s+/g, "");
    const isi = String(t.isi || "");

    if (!nama) throw salah("Nama template belum diisi.");
    if (!kodeSah(kode)) throw salah(
      `Kode "${kode}" tidak sah. Kode dipakai di nomor surat (mis. PKS pada 014/PKS/SM/IX/2026), ` +
      `jadi harus huruf kapital tanpa spasi, maksimal 8 karakter.`);
    if (!isi.trim()) throw salah("Isi dokumen masih kosong.");

    const fields = (t.fields || []).map((f) => ({
      key: slugKunci(f.key),
      label: { id: String(f.label?.id || f.key), en: String(f.label?.en || f.label?.id || f.key) },
      tipe: f.tipe,
      wajib: !!f.wajib,
      opsi: Array.isArray(f.opsi) ? f.opsi.map(String) : [],
    }));
    periksaFields(fields);

    // Semua {{kunci}} di badan dokumen harus punya isian, kecuali yang otomatis.
    const OTOMATIS = ["nomor_surat", "tanggal_terbit", "tanggal_terbit_panjang"];
    const dipakai = [...isi.matchAll(/\{\{([a-zA-Z0-9_.]+)\}\}/g)].map((m) => m[1].split(".")[0]);
    const yatim = [...new Set(dipakai)].filter((k) => !OTOMATIS.includes(k) && !fields.some((f) => f.key === k));
    if (yatim.length) throw salah(
      `Isi dokumen memakai ${yatim.map((k) => "{{" + k + "}}").join(", ")} tapi isian itu tidak ada di ` +
      `daftar isian. Tambahkan isiannya lewat tombol "Sisipkan isian", atau hapus tulisannya dari teks.`);

    const tid = t.tid || `t-${Math.random().toString(36).slice(2, 8)}`;

    const hasil = await db.runTransaction(async (tx) => {
      const q = await db.collection("template").where("tid", "==", tid)
        .orderBy("versi", "desc").limit(1).get();
      const versiLama = q.empty ? 0 : q.docs[0].data().versi;
      const versi = versiLama + 1;

      // Kode nomor surat tidak boleh berubah setelah ada dokumen terbit:
      // urutan nomor dihitung per kode, jadi mengubahnya membuat urutan
      // lama seolah milik kode yang berbeda.
      if (!q.empty && q.docs[0].data().kode !== kode) {
        const ada = await db.collection("dokumen").where("tid", "==", tid).limit(1).get();
        if (!ada.empty) throw salah(
          `Kode template tidak bisa diubah dari ${q.docs[0].data().kode} ke ${kode}, karena sudah ada ` +
          `dokumen terbit dengan kode lama. Urutan nomor dihitung per kode, jadi mengubahnya membuat ` +
          `nomor lama tidak bisa dilacak. Buat template baru kalau memang perlu kode berbeda.`, 409);
      }

      tx.set(db.collection("template").doc(`${tid}-v${versi}`), {
        tid, versi, kode, isi, fields,
        nama: { id: nama, en: String(t.nama?.en || nama) },
        olehUid: aku.uid, olehNama: aku.nama || aku.email,
        dibuat: stempelServer(),
      });
      catat(tx, db, { ref: tid, aksi: "template", dari: `v${versiLama}`, ke: `v${versi}`, aktor: aku,
        tambahan: { nama } });
      return { tid, versi };
    });

    return oke({ ...hasil, pesan: `Tersimpan sebagai versi ${hasil.versi}.` });
  }

  /* Menyetel nomor awal — dipakai sekali saat pindah dari buku agenda
     kertas, supaya nomor pertama melanjutkan buku itu, bukan mulai 001. */
  if (aksi === "setelNomorAwal") {
    const kode = String(muatan.kode || "").toUpperCase();
    const mulaiDari = Number(muatan.mulaiDari);
    const tahun = Number(muatan.tahun) || new Date().getFullYear();
    if (!kodeSah(kode)) throw salah("Kode template tidak sah.");
    if (!Number.isInteger(mulaiDari) || mulaiDari < 0) throw salah("Nomor awal harus bilangan bulat 0 atau lebih.");

    await db.runTransaction(async (tx) => {
      const ref = db.collection("counters").doc(`${kode}-${tahun}`);
      const snap = await tx.get(ref);
      const sekarang = snap.exists ? snap.data().urut : 0;
      if (sekarang > 0 && mulaiDari < sekarang) throw salah(
        `Penghitung ${kode} tahun ${tahun} sudah di ${sekarang}. Nomor awal hanya boleh dinaikkan, ` +
        `tidak diturunkan — kalau diturunkan, nomor berikutnya akan menabrak dokumen yang sudah terbit.`, 409);
      tx.set(ref, { urut: mulaiDari, kode, tahun }, { merge: true });
      catat(tx, db, { ref: `${kode}-${tahun}`, aksi: "setelNomor", dari: String(sekarang),
        ke: String(mulaiDari), aktor: aku, alasan: muatan.alasan || null });
    });

    return oke({ pesan: `Nomor ${kode} berikutnya akan mulai dari ${mulaiDari + 1}.` });
  }

  throw salah(`Aksi "${aksi}" tidak dikenal.`);
}, { perlu: ["superadmin", "owner"] });
