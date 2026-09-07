/**
 * Sesi & peran.
 *
 * Peran TIDAK PERNAH ditentukan di sini — dia dibaca dari dokumen
 * users/{uid} di Firestore, yang cuma bisa ditulis Netlify Function.
 * Yang dilakukan berkas ini hanya menampung hasil bacanya supaya layar
 * tahu tombol apa yang perlu digambar. Server tetap memeriksa ulang
 * setiap aksi; layar yang salah gambar akan ditolak di sana.
 */
import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, KONFIG_LENGKAP } from "../lib/firebase.js";

const Ctx = createContext(null);

export function PenyediaSesi({ children }) {
  const [akun, setAkun] = useState(undefined);   // undefined = masih memuat
  const [profil, setProfil] = useState(undefined);
  const [galat, setGalat] = useState(null);

  useEffect(() => {
    if (!KONFIG_LENGKAP) { setAkun(null); setProfil(null); return; }
    return onAuthStateChanged(auth, (u) => {
      setAkun(u || null);
      if (!u) setProfil(null);
    });
  }, []);

  useEffect(() => {
    if (!akun) return;
    setProfil(undefined);
    // Perhatikan: kegagalan MEMBACA profil dipisahkan dari kegagalan LOGIN.
    // Kalau keduanya dibungkus satu penanganan, error izin Firestore akan
    // muncul sebagai "email atau kata sandi salah" — persis kesalahan
    // diagnosis yang memakan berjam-jam pada 26 Agu 2026.
    return onSnapshot(
      doc(db, "users", akun.uid),
      (snap) => {
        setProfil(snap.exists() ? { uid: akun.uid, email: akun.email, ...snap.data() } : null);
        setGalat(null);
      },
      (e) => { setProfil(null); setGalat("profil:" + e.code); }
    );
  }, [akun]);

  const nilai = {
    akun, profil, galat,
    memuat: akun === undefined || (akun && profil === undefined),
    peran: profil?.peran || null,
    uid: akun?.uid || null,
    konfigLengkap: KONFIG_LENGKAP,
    masuk: (email, sandi) => signInWithEmailAndPassword(auth, email, sandi),
    keluar: () => signOut(auth),
    resetSandi: (email) => sendPasswordResetEmail(auth, email),
  };
  return <Ctx.Provider value={nilai}>{children}</Ctx.Provider>;
}

export function useSesi() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSesi dipakai di luar PenyediaSesi");
  return v;
}

export const ADMIN = ["superadmin", "owner"];
export const PEMERIKSA = ["superadmin", "owner", "director"];
export const bolehAdmin = (peran) => ADMIN.includes(peran);
