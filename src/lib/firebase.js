/**
 * Sambungan Firebase sisi browser.
 *
 * Kunci di sini memang boleh terbaca publik — dia cuma menunjuk proyek
 * mana, bukan izin apa. Yang menjaga data adalah firestore.rules
 * (semuanya `allow write: if false`) dan pemeriksaan di Netlify Function.
 */
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const KONFIG_LENGKAP = Boolean(cfg.apiKey && cfg.projectId && cfg.authDomain);

const app = initializeApp(cfg);
export const auth = getAuth(app);
export const db = getFirestore(app);
