/**
 * Master data & peran: karyawan, vendor, akun jurnal, ambang, pengguna,
 * kunci periode.
 *
 * Dua hal di sini yang bukan CRUD biasa:
 *
 *  1. AMBANG tidak pernah diedit. Versi baru ditambahkan dengan
 *     berlakuMulai sendiri, dan pemilihannya menurut tanggal pengajuan.
 *     Tanpa itu, menetapkan ambang bulan depan diam-diam mengubah jalur
 *     persetujuan pengajuan bulan lalu yang sudah selesai.
 *
 *  2. PERAN boleh diubah lewat aplikasi (keputusan Sony 5 Sep 2026), tapi
 *     dengan dua rem yang tidak bisa dilewati: tidak ada yang bisa
 *     mengubah perannya sendiri, dan setiap perubahan tercatat beserta
 *     peran lamanya. Batas yang diterima sadar: superadmin juga mengajukan
 *     reimburse, jadi dia bisa mengganti siapa yang memeriksanya — yang
 *     menahannya hanya jejak audit, bukan sistemnya. Itu ditulis juga di
 *     layar Pengguna & peran supaya tidak ada yang kaget belakangan.
 */
import { handlerAman, oke, salah, catat, stempelServer, tanggalServer } from "./_lib/admin.js";

const PERAN_SAH = ["pemohon", "superadmin", "director", "owner"];

const bersih = (v) => String(v ?? "").trim();

export const handler = handlerAman(async ({ db, aku, muatan }) => {
  const { aksi } = muatan;

  /* ---------------- karyawan & vendor ---------------- */
  if (aksi === "simpanPihak") {
    const jenis = muatan.jenis;
    if (!["karyawan", "vendor"].includes(jenis)) throw salah("Jenis pihak harus karyawan atau vendor.");
    const d = muatan.data || {};
    const nama = bersih(d.nama);
    if (!nama) throw salah("Nama belum diisi.");

    const isi = jenis === "karyawan"
      ? { nama, nik: bersih(d.nik), jabatan: bersih(d.jabatan), alamat: bersih(d.alamat) }
      : { nama, npwp: bersih(d.npwp), pic: bersih(d.pic), alamat: bersih(d.alamat) };

    const id = d.id || db.collection(jenis).doc().id;
    await db.runTransaction(async (tx) => {
      const ref = db.collection(jenis).doc(id);
      const snap = await tx.get(ref);
      const lama = snap.exists ? snap.data() : null;
      tx.set(ref, { ...isi, diubah: stempelServer(), olehNama: aku.nama || aku.email }, { merge: true });
      catat(tx, db, {
        ref: `${jenis}/${id}`, aksi: lama ? "ubahPihak" : "tambahPihak",
        dari: lama ? JSON.stringify(lama).slice(0, 400) : null,
        ke: JSON.stringify(isi).slice(0, 400), aktor: aku,
      });
    });
    return oke({ id, pesan: `${nama} tersimpan.` });
  }

  /* ---------------- akun jurnal ---------------- */
  if (aksi === "imporAkun") {
    const baris = Array.isArray(muatan.akun) ? muatan.akun : [];
    if (!baris.length) throw salah("Tidak ada baris akun yang terbaca. Periksa lagi teks yang ditempel.");

    // Seluruh batch divalidasi dulu, baru ditulis. Satu baris rusak tidak
    // boleh menyisakan setengah daftar akun yang harus dibereskan tangan.
    const bersihkan = [];
    baris.forEach((r, i) => {
      const kode = bersih(r.kode);
      const nama = bersih(r.nama);
      if (!kode) throw salah(`Baris ${i + 1}: kode akun kosong.`);
      if (!nama) throw salah(`Baris ${i + 1}: nama akun kosong.`);
      if (bersihkan.some((x) => x.kode === kode)) throw salah(`Kode akun ${kode} muncul dua kali.`);
      bersihkan.push({ kode, nama, namaEn: bersih(r.namaEn) || nama, grup: bersih(r.grup), aktif: true });
    });

    const batch = db.batch();
    bersihkan.forEach((a) => batch.set(db.collection("akun").doc(a.kode), a, { merge: true }));
    batch.set(db.collection("events").doc(), {
      ref: "akun", aksi: "imporAkun", dari: null, ke: `${bersihkan.length} akun`,
      aktorUid: aku.uid, aktorNama: aku.nama || aku.email, waktu: stempelServer(), alasan: null,
    });
    await batch.commit();
    return oke({ pesan: `${bersihkan.length} akun tersimpan.` });
  }

  if (aksi === "aktifkanAkun") {
    const kode = bersih(muatan.kode);
    const aktif = !!muatan.aktif;
    await db.runTransaction(async (tx) => {
      const ref = db.collection("akun").doc(kode);
      const snap = await tx.get(ref);
      if (!snap.exists) throw salah(`Akun ${kode} tidak ditemukan.`);
      tx.update(ref, { aktif });
      catat(tx, db, { ref: `akun/${kode}`, aksi: "aktifAkun",
        dari: String(snap.data().aktif), ke: String(aktif), aktor: aku });
    });
    return oke({ pesan: `Akun ${kode} ${aktif ? "diaktifkan" : "dinonaktifkan"}.` });
  }

  /* ---------------- ambang (append-only) ---------------- */
  if (aksi === "tambahAmbang") {
    const nilai = Number(muatan.nilai);
    const berlakuMulai = bersih(muatan.berlakuMulai);
    if (!(nilai > 0)) throw salah("Nilai ambang harus lebih dari 0.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(berlakuMulai)) throw salah("Tanggal berlaku harus berbentuk YYYY-MM-DD.");
    if (berlakuMulai < tanggalServer()) throw salah(
      `Tanggal berlaku ${berlakuMulai} sudah lewat. Ambang hanya boleh ditetapkan untuk hari ini ` +
      `atau ke depan — kalau boleh mundur, pengajuan yang sudah disetujui bisa berubah jalurnya ` +
      `secara surut, dan riwayatnya tidak lagi cocok dengan jejaknya sendiri.`);

    const id = `ambang-${berlakuMulai}`;
    await db.runTransaction(async (tx) => {
      const ref = db.collection("ambang").doc(id);
      const snap = await tx.get(ref);
      if (snap.exists) throw salah(
        `Sudah ada ambang yang berlaku mulai ${berlakuMulai} (${snap.data().nilai}). ` +
        `Versi lama tidak ditimpa — pilih tanggal berlaku yang lain.`, 409);
      tx.set(ref, { nilai, berlakuMulai, olehNama: aku.nama || aku.email, dibuat: stempelServer() });
      catat(tx, db, { ref: "ambang", aksi: "tambahAmbang", dari: null,
        ke: `${nilai} mulai ${berlakuMulai}`, aktor: aku });
    });
    return oke({ pesan: `Ambang baru berlaku mulai ${berlakuMulai}. Versi lama tetap tersimpan.` });
  }

  /* ---------------- pengguna & peran ---------------- */
  if (aksi === "simpanPengguna") {
    const uid = bersih(muatan.uid);
    const nama = bersih(muatan.nama);
    const email = bersih(muatan.email);
    const peran = bersih(muatan.peran);
    const job = bersih(muatan.job);

    if (!uid) throw salah(
      "UID Firebase belum diisi. Ambil dari Firebase Console → Authentication → Users → kolom User UID. " +
      "Orangnya harus dibuat di Authentication dulu; aplikasi ini tidak membuat akun login.");
    if (!nama) throw salah("Nama belum diisi.");
    if (!PERAN_SAH.includes(peran)) throw salah(`Peran "${peran}" tidak dikenal.`);

    // Rem pertama: tidak ada yang bisa mengubah peran dirinya sendiri.
    if (uid === aku.uid) {
      const snap = await db.collection("users").doc(uid).get();
      if (snap.exists && snap.data().peran !== peran) {
        throw salah(
          "Kamu tidak bisa mengubah peranmu sendiri. Minta superadmin atau Owner lain yang melakukannya. " +
          "Aturan ini yang membuat jejak audit di sini masih berarti sesuatu.", 403);
      }
    }

    await db.runTransaction(async (tx) => {
      const ref = db.collection("users").doc(uid);
      const snap = await tx.get(ref);
      const lama = snap.exists ? snap.data() : null;

      // Rem kedua: superadmin terakhir tidak boleh diturunkan — kalau
      // sampai kosong, tidak ada lagi yang bisa mengangkat siapa pun dan
      // satu-satunya jalan keluar adalah Firebase Console.
      if (lama && lama.peran === "superadmin" && peran !== "superadmin") {
        const sisa = await db.collection("users")
          .where("peran", "==", "superadmin").where("aktif", "==", true).get();
        if (sisa.size <= 1) throw salah(
          "Ini superadmin aktif terakhir. Kalau perannya diturunkan, tidak ada lagi yang bisa mengatur " +
          "peran siapa pun lewat aplikasi. Angkat superadmin lain dulu, baru turunkan yang ini.", 409);
      }

      tx.set(ref, {
        nama, email, peran, job,
        aktif: muatan.aktif === false ? false : true,
        diubah: stempelServer(),
      }, { merge: true });

      catat(tx, db, {
        ref: `users/${uid}`,
        aksi: lama ? "ubahPeran" : "tambahPengguna",
        dari: lama ? `${lama.peran}${lama.aktif === false ? " (nonaktif)" : ""}` : null,
        ke: `${peran}${muatan.aktif === false ? " (nonaktif)" : ""}`,
        aktor: aku, tambahan: { tentang: nama },
      });
    });

    return oke({ pesan: `${nama} tersimpan sebagai ${peran}.` });
  }

  /* ---------------- kunci periode ---------------- */
  if (aksi === "kunciPeriode") {
    const periode = bersih(muatan.periode);
    const terkunci = !!muatan.terkunci;
    const alasan = bersih(muatan.alasan);
    if (!/^\d{4}-\d{2}$/.test(periode)) throw salah("Periode harus berbentuk YYYY-MM.");
    // Membuka kunci WAJIB beralasan; mengunci tidak.
    if (!terkunci && !alasan) throw salah(
      "Membuka kunci periode wajib beralasan. Yang dibuka berarti angka yang sudah dilaporkan masih " +
      "bisa berubah, jadi alasannya harus bisa dibaca siapa pun nanti.");

    await db.runTransaction(async (tx) => {
      const ref = db.collection("periodeLock").doc(periode);
      const snap = await tx.get(ref);
      const lama = snap.exists ? !!snap.data().terkunci : false;
      if (lama === terkunci) throw salah(`Periode ${periode} memang sudah ${terkunci ? "terkunci" : "terbuka"}.`, 409);
      tx.set(ref, { terkunci, waktu: stempelServer(), olehNama: aku.nama || aku.email, alasan: alasan || null });
      catat(tx, db, { ref: `periode/${periode}`, aksi: terkunci ? "kunci" : "bukaKunci",
        dari: String(lama), ke: String(terkunci), aktor: aku, alasan: alasan || null });
    });
    return oke({ pesan: `Periode ${periode} ${terkunci ? "dikunci" : "dibuka"}.` });
  }

  throw salah(`Aksi "${aksi}" tidak dikenal.`);
}, { perlu: ["superadmin", "owner"] });