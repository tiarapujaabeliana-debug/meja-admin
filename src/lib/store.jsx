/**
 * Langganan Firestore.
 *
 * Semua layar membaca dari sini, tidak ada yang query sendiri-sendiri.
 * Alasannya bukan kerapian: kalau tiap halaman query sendiri, halaman
 * ringkasan dan halaman detail bisa membaca dua kali dan menampilkan dua
 * jawaban berbeda untuk pertanyaan yang sama di layar yang sama.
 *
 * Koleksi kecil (akun, karyawan, vendor, ambang, template, users) dimuat
 * seluruhnya dan disimpan di memori — jumlahnya puluhan, bukan ribuan.
 * Koleksi yang tumbuh (pengajuan, permintaan, dokumen, events) dibatasi.
 */
import { createContext, useContext, useEffect, useState, useMemo } from "react";
import {
  collection, onSnapshot, query, orderBy, limit, where,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { useSesi, LUAS } from "../auth/useAuth.jsx";

const Ctx = createContext(null);
const BATAS = 400;

function pakaiKoleksi(nama, aktif, kueri) {
  const [data, setData] = useState([]);
  const [siap, setSiap] = useState(false);
  const [galat, setGalat] = useState(null);
  useEffect(() => {
    if (!aktif) { setData([]); setSiap(true); return; }
    setSiap(false);
    const q = kueri ? kueri(collection(db, nama)) : collection(db, nama);
    return onSnapshot(q,
      (snap) => { setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setSiap(true); setGalat(null); },
      (e) => { setGalat(e.code); setSiap(true); }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nama, aktif]);
  return { data, siap, galat };
}

export function PenyediaData({ children }) {
  const { profil, uid, peran } = useSesi();
  const masuk = Boolean(profil && profil.aktif !== false);
  const luas = LUAS.includes(peran);

  const akun     = pakaiKoleksi("akun", masuk);
  const karyawan = pakaiKoleksi("karyawan", masuk);
  const vendor   = pakaiKoleksi("vendor", masuk);
  const ambang   = pakaiKoleksi("ambang", masuk);
  const template = pakaiKoleksi("template", masuk);
  const users    = pakaiKoleksi("users", masuk);
  const dokumen  = pakaiKoleksi("dokumen", masuk, (c) => query(c, orderBy("terbit", "desc"), limit(BATAS)));

  /* Pemohon hanya boleh membaca miliknya sendiri — bukan cuma disaring di
     layar, tapi memang tidak diminta ke server. firestore.rules akan
     menolak query yang lebih luas, dan menolaknya sebagai galat, bukan
     sebagai daftar kosong yang membingungkan. Finance ikut "luas" karena
     dia perlu melihat semua pengajuan untuk menjalankan pembayaran,
     walau dia tidak ikut memeriksa/menyetujui. */
  const pengajuan = pakaiKoleksi("pengajuan", masuk, (c) => luas
    ? query(c, orderBy("dibuat", "desc"), limit(BATAS))
    : query(c, where("pemohonUid", "==", uid), orderBy("dibuat", "desc"), limit(BATAS)));

  const permintaan = pakaiKoleksi("permintaan", masuk, (c) => luas
    ? query(c, orderBy("dibuat", "desc"), limit(BATAS))
    : query(c, where("pemohonUid", "==", uid), orderBy("dibuat", "desc"), limit(BATAS)));

  const events = pakaiKoleksi("events", masuk, (c) => query(c, orderBy("waktu", "desc"), limit(BATAS)));

  // Rekening tujuan transfer tiap orang — sengaja HANYA dimuat untuk peran
  // yang berhak lihat (bukan koleksi kecil biasa seperti karyawan/vendor),
  // karena isinya nomor rekening pribadi. Lihat firestore.rules.
  const rekening = pakaiKoleksi("rekening", masuk && luas);

  /** Versi terbaru tiap template — yang dipakai saat menerbitkan baru. */
  const templateAktif = useMemo(() => {
    const per = {};
    for (const t of template.data) {
      if (!per[t.tid] || t.versi > per[t.tid].versi) per[t.tid] = t;
    }
    return Object.values(per).sort((a, b) => (a.kode < b.kode ? -1 : 1));
  }, [template.data]);

  const cariTemplate = (tid, versi) =>
    template.data.find((t) => t.tid === tid && t.versi === versi)
    || templateAktif.find((t) => t.tid === tid) || null;

  const master = { karyawan: karyawan.data, vendor: vendor.data };

  const galatIzin = [akun, karyawan, vendor, ambang, template, users, dokumen, pengajuan, permintaan, events, rekening]
    .map((x) => x.galat).find(Boolean) || null;

  const semuaSiap = masuk
    ? [akun, karyawan, vendor, ambang, template, users, dokumen, pengajuan, permintaan, rekening].every((x) => x.siap)
    : true;

  const nilai = {
    akun: akun.data, karyawan: karyawan.data, vendor: vendor.data,
    ambang: ambang.data, template: template.data, templateAktif, cariTemplate,
    users: users.data, dokumen: dokumen.data, pengajuan: pengajuan.data,
    permintaan: permintaan.data, events: events.data, rekening: rekening.data,
    master, semuaSiap, galatIzin,
    namaUser: (u) => users.data.find((x) => x.id === u)?.nama || "—",
    rekeningUser: (u) => rekening.data.find((x) => x.id === u) || null,
    jejakUntuk: (ref) => events.data.filter((e) => e.ref === ref),
  };

  return <Ctx.Provider value={nilai}>{children}</Ctx.Provider>;
}

export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData dipakai di luar PenyediaData");
  return v;
}
