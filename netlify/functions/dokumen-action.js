/**
 * Register nomor dokumen — bagian paling rawan di seluruh aplikasi.
 *
 * ALOKASI NOMOR WAJIB DI DALAM TRANSAKSI. Kalau nomornya dihitung dengan
 * membaca dokumen terakhir lalu menambah satu di luar transaksi, dua orang
 * yang menekan Terbitkan pada detik yang sama mendapat nomor identik — dan
 * dua dokumen berbeda beredar dengan nomor yang sama. Itu jenis kesalahan
 * yang baru ketahuan berbulan-bulan kemudian, waktu salah satunya dipakai
 * di pengadilan atau audit pajak.
 *
 * Nomor yang sudah terbit TIDAK PERNAH kembali ke kolam — termasuk kalau
 * dokumennya dibatalkan. Register boleh bolong; yang bolong punya alasan
 * tertulis.
 */
import {
  handlerAman, oke, salah, catat, stempelServer,
} from "./_lib/admin.js";
import {
  susunNomor, kunciCounter, isianKurang, ringkasPerihal, isiDokumen,
} from "../../src/lib/dokumenMeta.js";

export const handler = handlerAman(async ({ db, aku, muatan }) => {
  const { aksi } = muatan;

  /* ---------------------------------------------------------------
     TERBITKAN — satu-satunya tempat nomor dokumen lahir
     --------------------------------------------------------------- */
  if (aksi === "terbitkan") {
    const { tid, nilai = {}, permintaan = null } = muatan;
    if (!tid) throw salah("Template belum dipilih.");

    // Template dibaca dari server; versi yang dipakai dikunci di sini
    // supaya dokumen ini selamanya menunjuk versi yang benar walau
    // template-nya diubah semenit kemudian.
    const tplSnap = await db.collection("template")
      .where("tid", "==", tid).orderBy("versi", "desc").limit(1).get();
    if (tplSnap.empty) throw salah(`Template ${tid} tidak ditemukan.`);
    const tpl = tplSnap.docs[0].data();

    const [karSnap, venSnap] = await Promise.all([
      db.collection("karyawan").get(), db.collection("vendor").get(),
    ]);
    const master = {
      karyawan: karSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      vendor: venSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };

    const kurang = isianKurang(tpl, nilai);
    if (kurang.length) {
      throw salah("Belum bisa diterbitkan. Isian wajib yang masih kosong:\n• " +
        kurang.map((f) => f.label?.id || f.key).join("\n• "));
    }

    const now = new Date();
    const tahun = now.getFullYear();
    const bulan = now.getMonth();
    const terbit = stempelServer();

    const hasil = await db.runTransaction(async (tx) => {
      // 1) Kalau menempel ke sebuah permintaan, permintaannya dibaca dulu
      //    di dalam transaksi — Firestore mewajibkan semua baca sebelum tulis.
      let reqRef = null;
      if (permintaan) {
        reqRef = db.collection("permintaan").doc(permintaan);
        const r = await tx.get(reqRef);
        if (!r.exists) throw salah(`Permintaan ${permintaan} tidak ditemukan.`);
        if (r.data().dokumen) throw salah(
          `Permintaan ${permintaan} sudah punya dokumen ${r.data().dokumen}. ` +
          `Satu permintaan hanya menempel ke satu nomor.`, 409);
      }

      // 2) Ambil nomor dari penghitung, di dalam transaksi yang sama.
      const cRef = db.collection("counters").doc(kunciCounter(tpl.kode, tahun));
      const cSnap = await tx.get(cRef);
      const urut = (cSnap.exists ? cSnap.data().urut : (tpl.mulaiDari || 0)) + 1;
      const nomor = susunNomor({ urut, kode: tpl.kode, bulan, tahun });

      const docRef = db.collection("dokumen").doc(nomor);
      const bentrok = await tx.get(docRef);
      if (bentrok.exists) {
        // Tidak boleh terjadi kalau penghitungnya utuh; kalau terjadi,
        // artinya ada dokumen yang pernah dibuat di luar jalur ini.
        throw salah(
          `Nomor ${nomor} sudah ada di register padahal penghitung mengira belum. ` +
          `Ini berarti pernah ada dokumen yang dibuat di luar aplikasi. Buka menu ` +
          `Ambang & periode dan setel ulang nomor awal untuk kode ${tpl.kode}.`, 409);
      }

      tx.set(cRef, { urut, kode: tpl.kode, tahun }, { merge: true });
      tx.set(docRef, {
        nomor, kode: tpl.kode, urut, tahun,
        tid: tpl.tid, versi: tpl.versi,
        perihal: ringkasPerihal(tpl, nilai, master),
        // Isi yang sudah jadi ikut disimpan. Kalau daftar karyawan berubah
        // tahun depan, dokumen ini tetap berbunyi seperti waktu dicetak.
        isiJadi: isiDokumen(tpl.isi, tpl.fields, nilai, { nomor, terbit }, master),
        nilai,
        terbit,
        olehUid: aku.uid,
        olehNama: aku.nama || aku.email,
        pakai: permintaan ? { jenis: "permintaan", ref: permintaan, waktu: terbit } : null,
        batal: null,
      });
      catat(tx, db, { ref: nomor, aksi: "terbit", dari: "—", ke: "terbit", aktor: aku,
        tambahan: { template: tpl.tid, versi: tpl.versi } });

      if (reqRef) {
        tx.update(reqRef, { dokumen: nomor, status: "terbit", diubah: terbit });
        catat(tx, db, { ref: permintaan, aksi: "tempel", dari: "diminta", ke: "terbit", aktor: aku,
          tambahan: { dokumen: nomor } });
      }
      return { nomor };
    });

    return oke({ ...hasil, pesan: `Dokumen ${hasil.nomor} diterbitkan.` });
  }

  /* ---------------------------------------------------------------
     TEMPEL — memakai dokumen yang sudah terbit untuk sebuah permintaan
     --------------------------------------------------------------- */
  if (aksi === "tempel") {
    const { nomor, permintaan } = muatan;
    if (!nomor || !permintaan) throw salah("Nomor dokumen atau nomor permintaan tidak disertakan.");

    await db.runTransaction(async (tx) => {
      const docRef = db.collection("dokumen").doc(nomor);
      const reqRef = db.collection("permintaan").doc(permintaan);
      const [d, r] = await Promise.all([tx.get(docRef), tx.get(reqRef)]);
      if (!d.exists) throw salah(`Dokumen ${nomor} tidak ditemukan.`);
      if (!r.exists) throw salah(`Permintaan ${permintaan} tidak ditemukan.`);
      const dd = d.data();
      if (dd.batal) throw salah(`Dokumen ${nomor} sudah dibatalkan.`);
      if (dd.pakai) throw salah(
        `Dokumen ${nomor} sudah dipakai oleh ${dd.pakai.ref}. Satu nomor hanya bisa dipakai satu kali.`, 409);
      if (r.data().dokumen) throw salah(
        `Permintaan ${permintaan} sudah punya dokumen ${r.data().dokumen}.`, 409);

      const waktu = stempelServer();
      tx.update(docRef, { pakai: { jenis: "permintaan", ref: permintaan, waktu } });
      tx.update(reqRef, { dokumen: nomor, status: "terbit", diubah: waktu });
      catat(tx, db, { ref: nomor, aksi: "tempel", dari: "bebas", ke: `terpakai — ${permintaan}`, aktor: aku });
    });

    return oke({ pesan: `Dokumen ${nomor} ditempelkan ke ${permintaan}.` });
  }

  /* ---------------------------------------------------------------
     BATALKAN DOKUMEN — nomornya tetap tercatat terpakai
     --------------------------------------------------------------- */
  if (aksi === "batalkan") {
    const { nomor } = muatan;
    const alasan = String(muatan.alasan || "").trim();
    if (!nomor) throw salah("Nomor dokumen tidak disertakan.");
    if (!alasan) throw salah(
      "Alasan wajib diisi. Register nomor surat boleh bolong, tapi setiap yang bolong harus punya " +
      "penjelasan tertulis — itu yang membuat lompatan nomornya bisa dijelaskan waktu diaudit.");

    await db.runTransaction(async (tx) => {
      const ref = db.collection("dokumen").doc(nomor);
      const snap = await tx.get(ref);
      if (!snap.exists) throw salah(`Dokumen ${nomor} tidak ditemukan.`);
      if (snap.data().batal) throw salah(`Dokumen ${nomor} sudah dibatalkan sebelumnya.`, 409);
      tx.update(ref, {
        batal: { waktu: stempelServer(), olehUid: aku.uid, olehNama: aku.nama || aku.email, alasan },
      });
      catat(tx, db, { ref: nomor, aksi: "batalkan", dari: "terbit", ke: "dibatalkan", aktor: aku, alasan });
    });

    return oke({ pesan: `Dokumen ${nomor} dibatalkan. Nomornya tetap tercatat terpakai.` });
  }

  throw salah(`Aksi "${aksi}" tidak dikenal.`);
}, { perlu: ["superadmin", "owner"] });
