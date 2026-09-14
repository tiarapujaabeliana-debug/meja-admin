import { Link } from "react-router-dom";
import { useBahasa } from "../lib/i18n.jsx";
import { useSesi, ADMIN } from "../auth/useAuth.jsx";
import { useData } from "../lib/store.jsx";
import { KepalaHalaman, Bagian, Statistik, Kosong } from "../components/ui.jsx";
import TabelPengajuan from "../components/TabelPengajuan.jsx";
import TabelPermintaan from "../components/TabelPermintaan.jsx";
import { rupiah } from "../lib/format.js";
import { periodeDari, totalPengajuan } from "../lib/reimburseMeta.js";
import { dokumenBebas } from "../lib/dokumenMeta.js";

export default function Beranda() {
  const { t } = useBahasa();
  const { profil, peran, uid } = useSesi();
  const { pengajuan, permintaan, dokumen } = useData();
  const admin = ADMIN.includes(peran);
  const periodeIni = periodeDari(new Date().toISOString().slice(0, 10));

  /* Antrian = yang menunggu ORANG INI. Bukan "semua yang belum selesai" —
     daftar yang menampilkan pekerjaan orang lain membuat orang berhenti
     membukanya. */
  const antre = pengajuan.filter((p) =>
    (peran === "superadmin" && p.status === "diajukan") ||
    (peran === "director" && p.status === "menunggu_director") ||
    (peran === "owner" && p.status === "menunggu_owner") ||
    (p.pemohonUid === uid && ["draft", "dikembalikan"].includes(p.status)));

  const antreDok = admin ? permintaan.filter((r) => r.status === "diminta") : [];

  const tertahan = pengajuan.filter((p) =>
    ["diajukan", "menunggu_director", "menunggu_owner"].includes(p.status));

  const statistik = peran === "pemohon"
    ? [
      [pengajuan.filter((p) => p.pemohonUid === uid && p.status === "dikembalikan").length, t("sDikembalikan")],
      [pengajuan.filter((p) => p.pemohonUid === uid &&
        ["diajukan", "menunggu_director", "menunggu_owner"].includes(p.status)).length, t("sMenunggu")],
      [rupiah(pengajuan.filter((p) => p.pemohonUid === uid && p.status === "disetujui" && p.periode === periodeIni)
        .reduce((s, p) => s + totalPengajuan(p), 0)), t("sDisetujuiPeriode")],
    ]
    : [
      [tertahan.length, t("sMenunggu")],
      [rupiah(tertahan.reduce((s, p) => s + totalPengajuan(p), 0)), t("sNilaiTertahan")],
      [permintaan.filter((r) => !["selesai", "dibatalkan"].includes(r.status)).length, t("sDokJalan")],
      [dokumenBebas(dokumen).length, t("sDokBebas")],
    ];

  return (
    <>
      <KepalaHalaman
        eyebrow={`${profil?.nama || ""} · ${t("r_" + peran)}`}
        judul={t("nBeranda")} lede={t("berandaLede")} />

      <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(155px,1fr))]">
        {statistik.map(([n, l]) => <Statistik key={l} n={n} l={l} />)}
      </div>

      <Bagian judul={t("antrian")}>
        {antre.length === 0 && antreDok.length === 0 ? (
          <Kosong judul={t("antrianKosong")} sub={t("antrianKosongSub")}
            aksi={<Link className="btn btn-utama" to="/reimburse/baru">+ {t("rbBaru")}</Link>} />
        ) : (
          <div className="flex flex-col gap-3">
            {antre.length > 0 && <TabelPengajuan baris={antre} />}
            {antreDok.length > 0 && <TabelPermintaan baris={antreDok} />}
          </div>
        )}
      </Bagian>
    </>
  );
}