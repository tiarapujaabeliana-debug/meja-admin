import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import { useSesi, ADMIN } from "../auth/useAuth.jsx";
import {
  KepalaHalaman, Bagian, Kartu, Kv, KvBaris, Pil, Catatan, Jejak,
  Isian, usePesan, ModalAlasan,
} from "../components/ui.jsx";
import { PERMINTAAN_NADA, STATUS_PERMINTAAN, dokumenBebas } from "../lib/dokumenMeta.js";
import { panggil } from "../lib/api.js";
import { slugNomor } from "../lib/nav.js";

const LABEL_AKSI = {
  id: { minta: "membuat permintaan", tempel: "menempelkan dokumen", majukan: "memajukan status",
    batalkan: "membatalkan", terbit: "menerbitkan dokumen" },
  en: { minta: "created the request", tempel: "attached a document", majukan: "advanced the status",
    batalkan: "cancelled it", terbit: "issued the document" },
};

export default function PermintaanDetail() {
  const { no } = useParams();
  const { t, L, lang } = useBahasa();
  const { permintaan, dokumen, cariTemplate, jejakUntuk } = useData();
  const { peran, uid } = useSesi();
  const pesan = usePesan();
  const nav = useNavigate();
  const [pilih, setPilih] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [mintaAlasan, setMintaAlasan] = useState(false);

  const r = permintaan.find((x) => x.no === no);
  if (!r) return <Catatan nada="warn">Permintaan {no} tidak ditemukan.
    <Link className="underline ml-1" to="/permintaan">Kembali ke daftar</Link>.</Catatan>;

  const admin = ADMIN.includes(peran);
  const tpl = cariTemplate(r.tid);
  const dok = r.dokumen ? dokumen.find((d) => d.nomor === r.dokumen) : null;
  // Hanya dokumen dengan template yang sama yang boleh ditempel — kontrak
  // kerja tidak masuk akal ditempel ke permintaan PKS pemasok.
  const bebas = dokumenBebas(dokumen).filter((d) => d.tid === r.tid);
  const i = STATUS_PERMINTAAN.indexOf(r.status);
  const jejak = jejakUntuk(r.no);

  async function aksi(muatan, sukses) {
    setSibuk(true);
    try { const h = await panggil(muatan.fn, muatan.body); pesan(h.pesan || sukses); }
    catch (e) { pesan(e.message, "bad"); }
    finally { setSibuk(false); }
  }

  return (
    <>
      <Link className="btn btn-samar btn-kecil mb-3.5" to="/permintaan">← {t("kembali")}</Link>
      <KepalaHalaman eyebrow={r.no} judul={`${tpl ? L(tpl.nama) : "—"} — ${r.untuk}`}
        kanan={<Pil besar nada={PERMINTAAN_NADA[r.status]}>{t("pd_" + r.status)}</Pil>} />

      {r.status === "dibatalkan" && r.alasanBatal && (
        <div className="mb-3.5"><Catatan nada="warn">
          Permintaan ini dibatalkan: <b>{r.alasanBatal}</b>
          {r.dokumen && <div className="mt-1.5">
            Dokumen {r.dokumen} yang sudah terlanjur terbit tetap tercatat terpakai. Kalau dokumennya
            sendiri yang salah, batalkan dokumen itu di halaman Dokumen terbit dengan alasannya sendiri.
          </div>}
        </Catatan></div>
      )}

      <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
        <Kartu className="p-4"><Kv>
          <KvBaris k={t("rbPemohon")}>{r.pemohonNama}</KvBaris>
          <KvBaris k={t("pdUntuk")}>{r.untuk}</KvBaris>
          {r.catatan && <KvBaris k={t("pdKeterangan")}>{r.catatan}</KvBaris>}
        </Kv></Kartu>
        <Kartu className="p-4"><Kv>
          <KvBaris k={t("pdNomor")}>
            {dok
              ? <>
                <Link className="font-mono font-semibold underline underline-offset-2"
                  to={`/dokumen/${slugNomor(dok.nomor)}`}>{dok.nomor}</Link>
                <div className="hint">{t("tbTerbit")} {dok.terbit} · {dok.olehNama}</div>
              </>
              : <span className="hint">{t("pdBelumTerbit")}</span>}
          </KvBaris>
        </Kv></Kartu>
      </div>

      {admin && !dok && r.status !== "dibatalkan" && (
        <Bagian judul={t("nTerbit")}>
          <div className="kartu p-4 grid gap-4">
            <div>
              <button className="btn btn-utama"
                onClick={() => nav(`/dokumen/terbitkan?tid=${r.tid}&permintaan=${r.no}`)}>
                {t("pdTerbitkan")}
              </button>
            </div>
            <div className="border-t border-line dark:border-line-dark pt-4">
              <Isian label={t("pdPilihDok")}
                hint={`${bebas.length} ${t("tbBebas").toLowerCase()}. ${t("fDokPetunjuk")}`}>
                <div className="flex gap-2 flex-wrap">
                  <select className="inp max-w-md" value={pilih} onChange={(e) => setPilih(e.target.value)}>
                    <option value="">{t("pdPilihKosong")}</option>
                    {bebas.map((d) => <option key={d.nomor} value={d.nomor}>{d.nomor} — {d.perihal}</option>)}
                  </select>
                  <button className="btn" disabled={!pilih || sibuk}
                    onClick={() => aksi({ fn: "dokumen-action", body: { aksi: "tempel", nomor: pilih, permintaan: r.no } })}>
                    {t("pdTempel")}
                  </button>
                </div>
              </Isian>
            </div>
          </div>
        </Bagian>
      )}

      {admin && dok && i >= 0 && i < STATUS_PERMINTAAN.length - 1 && (
        <div className="mt-7 flex gap-2 flex-wrap">
          <button className="btn btn-utama" disabled={sibuk}
            onClick={() => aksi({ fn: "permintaan-action", body: { aksi: "majukan", no: r.no } })}>
            {t("pdMajukan")} → {t("pd_" + STATUS_PERMINTAAN[i + 1])}
          </button>
        </div>
      )}

      {(admin || r.pemohonUid === uid) && !["selesai", "dibatalkan"].includes(r.status) && (
        <div className="mt-3 flex gap-2 flex-wrap">
          <button className="btn btn-samar" onClick={() => setMintaAlasan(true)}>{t("aBatalkan")}</button>
        </div>
      )}

      <Bagian judul={t("jejak")}>
        <Jejak baris={jejak} labelStatus={(s) => s || "—"}
          labelAksi={(a) => LABEL_AKSI[lang]?.[a] || a} />
      </Bagian>

      {mintaAlasan && (
        <ModalAlasan judul="Batalkan permintaan" tanya="Kenapa dibatalkan?"
          keterangan={t("mAlasanWajib")} tombol={t("aBatalkan")} sibuk={sibuk}
          tutup={() => setMintaAlasan(false)}
          kirim={async (alasan) => {
            await aksi({ fn: "permintaan-action", body: { aksi: "batalkan", no: r.no, alasan } });
            setMintaAlasan(false);
          }} />
      )}
    </>
  );
}
