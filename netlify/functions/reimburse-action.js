/**
 * Satu-satunya pintu tulis modul reimburse.
 *
 * Logika alur (status, ambang, periode, validasi) di-import dari
 * src/lib/reimburseMeta.js — berkas yang sama yang dipakai layar. Jangan
 * menyalinnya ke sini: kalau server dan layar memakai rumus yang berbeda,
 * tombolnya akan tampil lalu selalu ditolak, dan tidak ada yang tahu mana
 * yang benar.
 */
import {
  handlerAman, oke, salah, catat, stempelServer, tanggalServer,
  pastikanPeriodeTerbuka,
} from "./_lib/admin.js";
import {
  validasiPengajuan, totalPengajuan, setelahDirector, aksiTersedia,
  AKSI_BUTUH_ALASAN, periodeDari, STATUS_FINAL,
} from "../../src/lib/reimburseMeta.js";

const PESAN_VALIDASI = {
  keperluan: () => "Keperluan belum diisi.",
  noline: () => "Belum ada satu pun baris biaya.",
  desc: (e) => `Baris ${e.n}: deskripsi belum diisi.`,
  akun: (e) => `Baris ${e.n}: akun jurnal belum dipilih.`,
  akunAsing: (e) => `Baris ${e.n}: akun ${e.v} tidak ada di daftar akun jurnal. Pilih ulang dari dropdown.`,
  qty: (e) => `Baris ${e.n}: jumlah harus lebih dari 0.`,
  harga: (e) => `Baris ${e.n}: harga satuan harus lebih dari 0.`,
  file: (e) => `Baris ${e.n}: lampiran invoice belum ada.`,
};

/** Nomor RB berurut per tahun, dialokasikan di dalam transaksi. */
async function nomorBaru(tx, db, tahun) {
  const ref = db.collection("counters").doc(`RB-${tahun}`);
  const snap = await tx.get(ref);
  const urut = (snap.exists ? snap.data().urut : 0) + 1;
  tx.set(ref, { urut, jenis: "RB", tahun }, { merge: true });
  return `RB-${tahun}-${String(urut).padStart(4, "0")}`;
}

export const handler = handlerAman(async ({ db, aku, muatan }) => {
  const { aksi } = muatan;

  /* ---------------------------------------------------------------
     BUAT — pemohon mengirim pengajuan baru
     --------------------------------------------------------------- */
  if (aksi === "buat") {
    const draft = muatan.draft || {};

    // Daftar akun dibaca dari server, bukan dipercaya dari klien.
    const akunSnap = await db.collection("akun").where("aktif", "==", true).get();
    const akunSah = akunSnap.docs.map((d) => d.id);

    // Seluruh isian divalidasi dulu, baru satu pun ditulis. Tidak boleh
    // ada pengajuan setengah tersimpan yang harus dibereskan tangan.
    const salahIsi = validasiPengajuan(draft, akunSah);
    if (salahIsi.length) {
      throw salah("Pengajuan belum bisa dikirim:\n• " +
        salahIsi.map((e) => (PESAN_VALIDASI[e.k] || (() => e.k))(e)).join("\n• "));
    }

    const waktu = stempelServer();
    const periode = periodeDari(tanggalServer());
    await pastikanPeriodeTerbuka(db, periode);

    const nomorDok = draft.dokumen || null;

    const hasil = await db.runTransaction(async (tx) => {
      /* Dibaca ulang DI DALAM transaksi. Dropdown yang digambar semenit
         lalu bisa saja sudah basi karena orang lain memakai nomor itu
         duluan; memeriksanya di klien saja berarti dua orang yang menekan
         tombol bersamaan sama-sama berhasil. */
      let dokSnap = null;
      if (nomorDok) {
        const dokRef = db.collection("dokumen").doc(nomorDok);
        dokSnap = await tx.get(dokRef);
        if (!dokSnap.exists) throw salah(`Dokumen ${nomorDok} tidak ditemukan di register.`);
        const d = dokSnap.data();
        if (d.batal) throw salah(`Dokumen ${nomorDok} sudah dibatalkan, jadi tidak bisa dipakai sebagai dasar.`);
        if (d.pakai) throw salah(
          `Dokumen ${nomorDok} sudah dipakai oleh ${d.pakai.ref}. Satu nomor hanya bisa dipakai ` +
          `satu kali. Pilih nomor lain, atau terbitkan dokumen baru.`, 409);
      }

      const no = await nomorBaru(tx, db, new Date().getFullYear());
      const ref = db.collection("pengajuan").doc(no);

      const data = {
        no,
        pemohonUid: aku.uid,
        pemohonNama: aku.nama || aku.email,
        keperluan: String(draft.keperluan).trim(),
        catatan: String(draft.catatan || "").trim(),
        status: "diajukan",
        periode,
        dokumen: nomorDok,
        lines: (draft.lines || []).map((l) => ({
          desc: String(l.desc).trim(),
          akun: l.akun,
          qty: Number(l.qty),
          unit: String(l.unit || "").trim(),
          harga: Number(l.harga),
          file: l.file,          // jalur di Supabase Storage, bukan URL
          fileNama: l.fileNama || "",
        })),
        dibuat: waktu,
        diubah: waktu,
      };
      data.total = totalPengajuan(data);

      tx.set(ref, data);
      if (nomorDok) {
        tx.update(db.collection("dokumen").doc(nomorDok), {
          pakai: { jenis: "reimburse", ref: no, waktu },
        });
        catat(tx, db, { ref: nomorDok, aksi: "tempel", dari: "bebas", ke: `terpakai — ${no}`, aktor: aku });
      }
      catat(tx, db, { ref: no, aksi: "submit", dari: "draft", ke: "diajukan", aktor: aku });
      return { no, total: data.total };
    });

    return oke({ ...hasil, pesan: "Pengajuan terkirim." });
  }

  /* ---------------------------------------------------------------
     LANGKAH — verify / approve / return / void
     --------------------------------------------------------------- */
  const LANGKAH = ["verify", "approve", "return", "void", "submit"];
  if (!LANGKAH.includes(aksi)) throw salah(`Aksi "${aksi}" tidak dikenal.`);

  const no = muatan.no;
  if (!no) throw salah("Nomor pengajuan tidak disertakan.");
  const alasan = String(muatan.alasan || "").trim();
  if (AKSI_BUTUH_ALASAN.includes(aksi) && !alasan) {
    throw salah("Alasan wajib diisi. Pemohon akan membacanya, dan alasannya tersimpan di jejak.");
  }

  const hasil = await db.runTransaction(async (tx) => {
    const ref = db.collection("pengajuan").doc(no);
    const snap = await tx.get(ref);
    if (!snap.exists) throw salah(`Pengajuan ${no} tidak ditemukan.`);
    const p = { ...snap.data(), no };

    // Izin diperiksa dengan fungsi yang SAMA yang dipakai layar untuk
    // menggambar tombol, jadi tidak pernah ada tombol yang tampil tapi
    // selalu ditolak — atau sebaliknya.
    const boleh = aksiTersedia(p, aku.peran, aku.uid);
    if (!boleh.includes(aksi)) {
      throw salah(
        `Aksi "${aksi}" tidak berlaku untuk pengajuan yang statusnya "${p.status}" ` +
        `bagi peran ${aku.peran}. Kemungkinan besar orang lain sudah menanganinya duluan — ` +
        `muat ulang halaman untuk melihat status terbarunya.`, 409);
    }

    await pastikanPeriodeTerbuka(db, p.periode);

    const dari = p.status;
    const patch = { diubah: stempelServer() };

    if (aksi === "submit") {
      patch.status = "diajukan";
      patch.alasanKembali = null;
      patch.kembaliOleh = null;
    } else if (aksi === "verify") {
      patch.status = "menunggu_director";
    } else if (aksi === "approve") {
      if (dari === "menunggu_director") {
        // Ambang dibaca dari server dan dipilih menurut TANGGAL PENGAJUAN,
        // bukan versi terbaru — supaya menaikkan ambang bulan depan tidak
        // mengubah jalur pengajuan bulan lalu.
        const ambSnap = await db.collection("ambang").get();
        const ambang = ambSnap.docs.map((d) => d.data());
        patch.status = setelahDirector(p, ambang);
      } else {
        patch.status = "disetujui";
      }
    } else if (aksi === "return") {
      patch.status = "dikembalikan";
      patch.alasanKembali = alasan;
      patch.kembaliOleh = aku.nama || aku.email;
    } else if (aksi === "void") {
      /* Membatalkan pengajuan TIDAK melepas nomor dokumennya.
         Keputusan Sony 5 Sep 2026: nomor surat yang sudah keluar tidak
         pernah kembali ke kolam, karena dokumennya mungkin sudah dicetak
         dan beredar. Dua dokumen berbeda dengan nomor sama jauh lebih
         merepotkan daripada register yang bolong. */
      patch.status = "dibatalkan";
      patch.alasanBatal = alasan;
    }

    tx.update(ref, patch);
    catat(tx, db, { ref: no, aksi, dari, ke: patch.status, aktor: aku, alasan: alasan || null });
    return { no, status: patch.status, sebelumnya: dari };
  });

  return oke(hasil);
}, { perlu: ["pemohon", "superadmin", "director", "owner"] });
