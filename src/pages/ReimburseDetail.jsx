import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import { useSesi } from "../auth/useAuth.jsx";
import {
  KepalaHalaman, Bagian, Kartu, Kv, KvBaris, Pil, Catatan, Tabel,
  Jejak, ModalAlasan, usePesan,
} from "../components/ui.jsx";
import { rupiah } from "../lib/format.js";
import {
  totalPengajuan, jalurPersetujuan, aksiTersedia, AKSI_BUTUH_ALASAN,
  STATUS_NADA, barisJurnal, keCsv, rentangPeriode,
} from "../lib/reimburseMeta.js";
import { panggil } from "../lib/api.js";
import { slugNomor, unduhTeks } from "../lib/nav.js";

const LABEL_AKSI = {
  id: { submit: "mengirim pengajuan", verify: "memverifikasi & meneruskan", approve: "menyetujui",
    return: "mengembalikan", void: "membatalkan", tempel: "menempelkan nomor dokumen" },
  en: { submit: "sent the claim", verify: "reviewed & forwarded", approve: "approved",
    return: "returned it", void: "voided it", tempel: "attached a document number" },
};

export default function ReimburseDetail() {
  const { no } = useParams();
  const { t, lang } = useBahasa();
  const { pengajuan, ambang, akun, dokumen, jejakUntuk } = useData();
  const { peran, uid } = useSesi();
  const pesan = usePesan();
  const nav = useNavigate();
  const [minta, setMinta] = useState(null);
  const [sibuk, setSibuk] = useState(false);

  const p = pengajuan.find((x) => x.no === no);
  if (!p) {
    return <Catatan nada="warn">
      Pengajuan {no} tidak ada di daftar yang bisa kamu lihat. Kalau ini pengajuan orang lain,
      memang hanya pemeriksa yang bisa membukanya. <Link className="underline" to="/reimburse">Kembali ke daftar</Link>.
    </Catatan>;
  }

  const total = totalPengajuan(p);
  const { langkah, lewatAmbang, ambang: ambPakai } = jalurPersetujuan(p, ambang);
  const boleh = aksiTersedia(p, peran, uid);
  const jejak = jejakUntuk(p.no);
  const dok = p.dokumen ? dokumen.find((d) => d.nomor === p.dokumen) : null;
  const rentang = rentangPeriode(p.periode);

  const PEMEGANG = {
    diajukan: "Superadmin", menunggu_director: "Director", menunggu_owner: "Owner", disetujui: "—",
  };
  const idxKini = langkah.indexOf(p.status);

  async function jalankan(aksi, alasan) {
    setSibuk(true);
    try {
      const r = await panggil("reimburse-action", { aksi, no: p.no, alasan });
      pesan({
        verify: t("okVerifikasi"), approve: t("okSetuju"),
        return: t("okKembali"), void: t("okBatal"), submit: t("okKirim"),
      }[aksi] || `Status → ${t("st_" + r.status)}`);
      setMinta(null);
    } catch (e) {
      pesan(e.message, "bad");
    } finally { setSibuk(false); }
  }

  function unduhCsv() {
    const rows = barisJurnal({ ...p, pemohonNama: p.pemohonNama },
      akun.map((a) => ({ kode: a.id, nama: a.nama, namaEn: a.namaEn })));
    unduhTeks(keCsv(rows), `${p.no}-jurnal.csv`);
  }

  const LABEL_TOMBOL = {
    submit: p.status === "dikembalikan" ? t("aAjukanUlang") : t("aKirim"),
    verify: t("aVerifikasi"), approve: t("aSetujui"), return: t("aKembalikan"), void: t("aBatalkan"),
  };
  const GAYA = { submit: "btn-utama", verify: "btn-utama", approve: "btn-utama",
    return: "btn-bahaya", void: "btn-samar" };

  return (
    <>
      <Link className="btn btn-samar btn-kecil mb-3.5" to="/reimburse">← {t("kembali")}</Link>
      <KepalaHalaman
        eyebrow={`${p.no} · ${t("rbPeriode")} ${p.periode} (${rentang.mulai} → ${rentang.selesai})`}
        judul={p.keperluan}
        kanan={<Pil besar nada={STATUS_NADA[p.status]}>{t("st_" + p.status)}</Pil>} />

      {p.status === "dikembalikan" && p.alasanKembali && (
        <div className="mb-3.5"><Catatan nada="bad">
          {t("catatanKembali", { "%a": p.kembaliOleh || "—", "%r": p.alasanKembali })}
        </Catatan></div>
      )}
      {p.status === "dibatalkan" && (
        <div className="mb-3.5"><Catatan nada="warn">
          {t("catatanBatal")}
          {p.alasanBatal && <div className="mt-1 font-semibold">{p.alasanBatal}</div>}
          {p.dokumen && <div className="mt-1.5">{t("catatanBatalDok")}</div>}
        </Catatan></div>
      )}

      {/* Rel status: menunjukkan seluruh jalur, termasuk langkah Owner yang
          hanya muncul kalau totalnya melewati ambang. */}
      <div className="flex flex-wrap rounded-card border border-line dark:border-line-dark overflow-hidden mb-5">
        {langkah.map((s, i) => {
          const mati = ["dibatalkan", "dikembalikan"].includes(p.status);
          const gaya = mati ? (i === 0 ? "bg-bad-soft dark:bg-bad-dark-soft" : "opacity-50")
            : i < idxKini ? "bg-ok-soft dark:bg-ok-dark-soft"
              : i === idxKini ? "bg-frost-soft dark:bg-frost-dark-soft" : "";
          return (
            <div key={s} className={`flex-1 min-w-[130px] px-3 py-2.5 border-r last:border-r-0
              border-line dark:border-line-dark ${gaya}`}>
              <div className="lbl">{i + 1}</div>
              <div className="text-[12.5px] font-semibold">{t("st_" + s)}</div>
              <div className="hint font-mono">{PEMEGANG[s]}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
        <Kartu className="p-4"><Kv>
          <KvBaris k={t("rbPemohon")}>{p.pemohonNama}</KvBaris>
          <KvBaris k={t("rbTotal")}><span className="font-mono font-semibold">{rupiah(total)}</span></KvBaris>
          <KvBaris k={t("fJalur")}>
            {lewatAmbang ? t("jalur3") : t("jalur2")}
            <div className="hint">
              {ambPakai && (lewatAmbang
                ? t("jalurKenapa", { "%a": rupiah(ambPakai.nilai) })
                : t("jalurKenapa2", { "%a": rupiah(ambPakai.nilai) }))}
            </div>
          </KvBaris>
        </Kv></Kartu>
        <Kartu className="p-4"><Kv>
          <KvBaris k={t("fDokDasar")}>
            {dok
              ? <Link className="font-mono font-semibold underline underline-offset-2"
                to={`/dokumen/${slugNomor(dok.nomor)}`}>{dok.nomor}</Link>
              : "—"}
            {dok && <div className="hint">{dok.perihal}</div>}
          </KvBaris>
          {p.catatan && <KvBaris k={t("fCatatan")}>{p.catatan}</KvBaris>}
        </Kv></Kartu>
      </div>

      <Bagian judul={t("fRincian")}>
        <Tabel kolom={[
          { t: t("kDesk") }, { t: t("kAkun") }, { t: t("kQty"), num: true },
          { t: t("kHarga"), num: true }, { t: t("kSubtotal"), num: true }, { t: t("kLampiran") },
        ]}>
          {p.lines.map((l, i) => {
            const a = akun.find((x) => x.id === l.akun);
            return (
              <tr key={i}>
                <td>{l.desc}</td>
                <td><span className="kode">{l.akun}</span><div className="hint">{a?.nama || "—"}</div></td>
                <td className="num">{l.qty} {l.unit}</td>
                <td className="num">{rupiah(l.harga)}</td>
                <td className="num">{rupiah(l.qty * l.harga)}</td>
                <td><TombolLampiran jalur={l.file} nama={l.fileNama} /></td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={4} className="text-right font-bold">{t("rbTotal")}</td>
            <td className="num font-bold">{rupiah(total)}</td>
            <td />
          </tr>
        </Tabel>
      </Bagian>

      {boleh.length > 0 && (
        <div className="mt-7 flex gap-2 flex-wrap">
          {boleh.map((a) => (
            <button key={a} disabled={sibuk} className={`btn ${GAYA[a] || ""}`}
              onClick={() => (AKSI_BUTUH_ALASAN.includes(a) ? setMinta(a) : jalankan(a))}>
              {LABEL_TOMBOL[a]}
            </button>
          ))}
        </div>
      )}

      <Bagian judul={t("ekspor")} sub={t("eksporPetunjuk")}>
        <button className="btn" onClick={unduhCsv}>⤓ {t("eksporCsv")}</button>
      </Bagian>

      <Bagian judul={t("jejak")}>
        <Jejak baris={jejak}
          labelStatus={(s) => (s && t("st_" + s) !== "st_" + s ? t("st_" + s) : s || "—")}
          labelAksi={(a) => LABEL_AKSI[lang]?.[a] || a} />
      </Bagian>

      {minta && (
        <ModalAlasan
          judul={minta === "return" ? t("mKembalikanJudul") : t("mBatalkanJudul")}
          tanya={minta === "return" ? t("mKembalikanTanya") : t("mBatalkanTanya")}
          keterangan={t("mAlasanWajib")}
          tombol={minta === "return" ? t("aKembalikan") : t("aBatalkan")}
          sibuk={sibuk}
          tutup={() => setMinta(null)}
          kirim={(alasan) => jalankan(minta, alasan)} />
      )}
    </>
  );
}

/** Lampiran dibuka lewat tautan bertanda tangan yang berumur 10 menit. */
function TombolLampiran({ jalur, nama }) {
  const pesan = usePesan();
  const [sibuk, setSibuk] = useState(false);
  if (!jalur) return <span className="hint">—</span>;
  return (
    <button className="chip underline underline-offset-2" disabled={sibuk}
      onClick={async () => {
        setSibuk(true);
        try {
          const r = await panggil("lampiran-url", { aksi: "buka", jalur });
          window.open(r.url, "_blank", "noopener");
        } catch (e) { pesan(e.message, "bad"); }
        finally { setSibuk(false); }
      }}>
      {sibuk ? "…" : (nama || "lampiran")}
    </button>
  );
}
