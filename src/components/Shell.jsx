/**
 * Kerangka aplikasi: menu kiri + bar atas.
 *
 * Menu dikelompokkan menurut SEBERAPA SERING DIBUKA, bukan kemiripan nama:
 * Kerja harian (tiap hari) · Rujukan (sesekali) · Setelan (jarang).
 *
 * Menu yang perannya tidak berhak TIDAK DIGAMBAR SAMA SEKALI — bukan
 * digambar lalu ditolak waktu diklik. Menu yang muncul tapi selalu menolak
 * mengajari orang bahwa aplikasinya rusak.
 */
import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useBahasa } from "../lib/i18n.jsx";
import { useSesi, ADMIN, LUAS } from "../auth/useAuth.jsx";
import { useData } from "../lib/store.jsx";
import { periodeDari } from "../lib/reimburseMeta.js";

const Ikon = ({ d }) => (
  <svg viewBox="0 0 20 20" className="w-[15px] h-[15px] shrink-0" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const IKON = {
  beranda: "M3 9l7-6 7 6v9a1 1 0 01-1 1h-4v-6H8v6H4a1 1 0 01-1-1z",
  reimburse: "M4 3h9l4 4v13H4zM13 3v4h4M7 12h7M7 15h5",
  permintaan: "M5 3h7l4 4v13H5zM12 3v4h4M8 11h6M8 14h6",
  terbit: "M4 4h12v12H4zM4 8h12M8 8v8",
  aturan: "M10 3a7 7 0 100 14 7 7 0 000-14zM10 7v4M10 14h.01",
  asumsi: "M10 3a7 7 0 100 14 7 7 0 000-14zM8 8a2 2 0 113 1.7c-.6.4-1 .8-1 1.5M10 14h.01",
  template: "M3 4h14v4H3zM3 11h6v5H3zM11 11h6v5h-6z",
  pihak: "M7 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM2.5 17c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5M14 8.5a2 2 0 100-4M13.5 12.6c2 .3 3.5 2.1 3.5 4.4",
  akun: "M3 5h14M3 10h14M3 15h14M7 3v14",
  kebijakan: "M10 3l6 3v5c0 4-2.6 6.4-6 8-3.4-1.6-6-4-6-8V6z",
  pengguna: "M10 10a3 3 0 100-6 3 3 0 000 6zM4 17c0-3 2.7-5 6-5s6 2 6 5",
  pembayaran: "M3 6h14v9H3zM3 9h14M6 13h3",
  rekap: "M4 16V9M9 16V4M14 16v-6",
};

function gantiTema(gelap) {
  const el = document.documentElement;
  if (gelap === null) {
    el.classList.remove("dark");
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) el.classList.add("dark");
  } else el.classList.toggle("dark", gelap);
  try { localStorage.setItem("meja-admin-tema", gelap === null ? "sistem" : gelap ? "gelap" : "terang"); } catch { /* mode privat */ }
}

export default function Shell({ children }) {
  const { t, lang, setLang } = useBahasa();
  const { profil, peran, keluar } = useSesi();
  const { pengajuan, permintaan } = useData();
  const nav = useNavigate();
  const [bukaMenu, setBukaMenu] = useState(false);

  const admin = ADMIN.includes(peran);
  const luas = LUAS.includes(peran);

  // Lencana = jumlah yang benar-benar menunggu ORANG INI, bukan jumlah total.
  const antre =
    pengajuan.filter((p) =>
      (peran === "superadmin" && p.status === "diajukan") ||
      (peran === "director" && (p.status === "menunggu_director" || p.status === "disetujui")) ||
      (peran === "owner" && p.status === "menunggu_owner") ||
      (peran === "finance" && p.status === "menunggu_pembayaran") ||
      (p.pemohonUid === profil?.uid && p.status === "dikembalikan")).length
    + (admin ? permintaan.filter((r) => r.status === "diminta").length : 0);

  // Lencana khusus menu Pembayaran: cuma yang benar-benar butuh aksi
  // Director/Finance saat ini, bukan seluruh isi antrean bayar.
  const antrePembayaran = pengajuan.filter((p) =>
    (peran === "director" && p.status === "disetujui") ||
    (peran === "finance" && p.status === "menunggu_pembayaran")).length;

  const grup = [
    { g: t("gHarian"), item: [
      { ke: "/", ikon: "beranda", label: t("nBeranda"), lencana: antre, ujung: true },
      { ke: "/reimburse", ikon: "reimburse", label: t("nReimburse") },
      { ke: "/permintaan", ikon: "permintaan", label: t("nPermintaan") },
      { ke: "/dokumen", ikon: "terbit", label: t("nTerbit") },
      ...(luas ? [{ ke: "/pembayaran", ikon: "pembayaran", label: t("nPembayaran"), lencana: antrePembayaran }] : []),
      ...(luas ? [{ ke: "/reimburse-rekap", ikon: "rekap", label: t("nRekap") }] : []),
    ] },
    { g: t("gRujukan"), item: [
      { ke: "/aturan", ikon: "aturan", label: t("nAturan") },
      { ke: "/asumsi", ikon: "asumsi", label: t("nAsumsi") },
    ] },
  ];
  if (admin) grup.push({ g: t("gSetelan"), item: [
    { ke: "/setelan/template", ikon: "template", label: t("nTemplate") },
    { ke: "/setelan/pihak", ikon: "pihak", label: t("nPihak") },
    { ke: "/setelan/akun", ikon: "akun", label: t("nAkun") },
    { ke: "/setelan/kebijakan", ikon: "kebijakan", label: t("nKebijakan") },
    { ke: "/setelan/pengguna", ikon: "pengguna", label: t("nPengguna") },
  ] });

  const kelasNav = ({ isActive }) =>
    "flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-[13.5px] font-medium " +
    (isActive
      ? "bg-frost-soft text-frost-deep font-semibold dark:bg-frost-dark-soft dark:text-frost-dark-deep"
      : "text-ink-2 hover:bg-surface-2 hover:text-ink dark:text-ink-dark-2 dark:hover:bg-surface-dark-2 dark:hover:text-ink-dark");

  return (
    <div className="md:grid md:grid-cols-[246px_1fr] min-h-screen">
      <nav className={`bg-surface dark:bg-surface-dark border-b md:border-b-0 md:border-r
        border-line dark:border-line-dark px-3 pt-4 pb-5 md:sticky md:top-0 md:h-screen md:overflow-y-auto`}>
        <div className="flex items-center gap-2.5 px-2 pb-3">
          <div className="w-[30px] h-[30px] rounded-lg bg-frost dark:bg-frost-dark
            text-white dark:text-ground-dark grid place-items-center font-display font-extrabold text-[13px]">MA</div>
          <div className="min-w-0">
            <div className="font-display font-extrabold text-[15px] leading-tight tracking-tight">Meja Admin</div>
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-3 dark:text-ink-dark-3">
              {profil?.nama || ""}
            </div>
          </div>
          <button className="btn btn-samar btn-kecil ml-auto md:hidden"
            onClick={() => setBukaMenu((v) => !v)} aria-expanded={bukaMenu}>☰</button>
        </div>

        <div className={`${bukaMenu ? "block" : "hidden"} md:block`}>
          {grup.map((g) => (
            <div key={g.g}>
              <div className="px-2.5 pt-4 pb-1.5 text-[10px] uppercase tracking-[0.11em] font-bold
                text-ink-3 dark:text-ink-dark-3">{g.g}</div>
              {g.item.map((it) => (
                <NavLink key={it.ke} to={it.ke} end={it.ujung} className={kelasNav}
                  onClick={() => setBukaMenu(false)}>
                  <Ikon d={IKON[it.ikon]} />
                  <span className="truncate">{it.label}</span>
                  {it.lencana > 0 && (
                    <span className="ml-auto rounded-full px-1.5 text-[10.5px] font-bold tabular-nums
                      bg-frost text-white dark:bg-frost-dark dark:text-ground-dark">{it.lencana}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      </nav>

      <div className="min-w-0 flex flex-col">
        <header className="flex items-center gap-3 flex-wrap px-4 md:px-6 py-2.5 sticky top-0 z-20
          bg-surface dark:bg-surface-dark border-b border-line dark:border-line-dark">
          <span className="text-[11.5px] font-mono text-ink-3 dark:text-ink-dark-3">
            {t("rbPeriode")} {periodeDari(new Date().toISOString().slice(0, 10))}
          </span>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg p-0.5 border border-line dark:border-line-dark
              bg-surface-2 dark:bg-surface-dark-2" role="group" aria-label={t("bahasa")}>
              {["id", "en"].map((l) => (
                <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
                  className={`px-2.5 py-1 rounded-md text-[12px] font-semibold ${lang === l
                    ? "bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark shadow-sm"
                    : "text-ink-3 dark:text-ink-dark-3"}`}>{l.toUpperCase()}</button>
              ))}
            </div>
            <button className="btn btn-kecil btn-samar" title={t("tema")}
              onClick={() => gantiTema(!document.documentElement.classList.contains("dark"))}>◑</button>
            <button className="btn btn-kecil" onClick={async () => { await keluar(); nav("/"); }}>
              {t("keluar")}
            </button>
          </div>
        </header>
        <main className="px-4 md:px-6 py-6 pb-20 max-w-[1120px] w-full">{children}</main>
      </div>
    </div>
  );
}

/** Dipanggil sekali saat aplikasi dimuat, sebelum React menggambar. */
export function pulihkanTema() {
  try {
    const t = localStorage.getItem("meja-admin-tema");
    if (t === "gelap") document.documentElement.classList.add("dark");
    else if (t === "terang") document.documentElement.classList.remove("dark");
    else gantiTema(null);
  } catch { gantiTema(null); }
}
