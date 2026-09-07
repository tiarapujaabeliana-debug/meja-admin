import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import { useSesi, ADMIN } from "../auth/useAuth.jsx";
import {
  KepalaHalaman, Bagian, Kartu, Kv, KvBaris, Pil, Catatan, Jejak,
  ModalAlasan, usePesan,
} from "../components/ui.jsx";
import { pratinjauDokumen } from "../lib/dokumenMeta.js";
import { rupiah, tanggalPanjang } from "../lib/format.js";
import { panggil } from "../lib/api.js";
import { nomorDariSlug, unduhBase64 } from "../lib/nav.js";

const LABEL_AKSI = {
  id: { terbit: "menerbitkan dokumen", batalkan: "membatalkan dokumen", tempel: "menempelkan nomor" },
  en: { terbit: "issued the document", batalkan: "cancelled the document", tempel: "attached the number" },
};

export default function DokumenDetail() {
  const { slug } = useParams();
  const nomor = nomorDariSlug(slug);
  const { t, L, lang } = useBahasa();
  const { dokumen, cariTemplate, master, jejakUntuk } = useData();
  const { peran } = useSesi();
  const pesan = usePesan();
  const [minta, setMinta] = useState(false);
  const [sibuk, setSibuk] = useState(false);

  const d = dokumen.find((x) => x.nomor === nomor);
  if (!d) return <Catatan nada="warn">Dokumen {nomor} tidak ditemukan.
    <Link className="underline ml-1" to="/dokumen">Kembali ke register</Link>.</Catatan>;

  const tpl = cariTemplate(d.tid, d.versi);
  const admin = ADMIN.includes(peran);
  const jejak = jejakUntuk(d.nomor);

  function nilaiTampil(f) {
    const v = d.nilai?.[f.key];
    if (v === undefined || v === null || v === "") return "—";
    if (f.tipe === "karyawan") { const r = master.karyawan.find((x) => x.id === v); return r ? `${r.nama} — ${r.jabatan}` : "—"; }
    if (f.tipe === "vendor") { const r = master.vendor.find((x) => x.id === v); return r ? r.nama : "—"; }
    if (f.tipe === "rupiah") return rupiah(v);
    if (f.tipe === "tanggal") return tanggalPanjang(v, lang);
    return String(v);
  }

  async function unduh() {
    setSibuk(true);
    try {
      const r = await panggil("dokumen-docx", { nomor: d.nomor });
      unduhBase64(r.base64, r.nama, r.tipe);
    } catch (e) { pesan(e.message, "bad"); }
    finally { setSibuk(false); }
  }

  return (
    <>
      <Link className="btn btn-samar btn-kecil mb-3.5" to="/dokumen">← {t("kembali")}</Link>
      <KepalaHalaman
        eyebrow={`${t("tbDariTemplate")} ${tpl ? L(tpl.nama) : "—"} · ${t("tbVersi")} ${d.versi}`}
        judul={<span className="font-mono">{d.nomor}</span>}
        kanan={d.batal ? <Pil besar nada="muted">{t("tbBatal")}</Pil>
          : d.pakai ? <Pil besar nada="info">{t("tbTerpakai")}</Pil>
            : <Pil besar nada="ok">{t("tbBebas")}</Pil>} />

      {d.batal && (
        <div className="mb-3.5"><Catatan nada="warn">
          {t("tbCatatanBatal", { "%w": d.batal.waktu, "%o": d.batal.olehNama })}
          <div className="mt-1 font-semibold">{d.batal.alasan}</div>
        </Catatan></div>
      )}
      {d.pakai && (
        <div className="mb-3.5"><Catatan>
          {t("tbDipakaiOleh", { "%r": d.pakai.ref })} — {t("fDokPetunjuk")}
        </Catatan></div>
      )}

      <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(230px,1fr))]">
        <Kartu className="p-4"><Kv>
          <KvBaris k={t("tbPerihal")}>{d.perihal}</KvBaris>
          <KvBaris k={t("tbTerbit")}><span className="kode">{d.terbit}</span></KvBaris>
          <KvBaris k={t("oleh")}>{d.olehNama}</KvBaris>
        </Kv></Kartu>
        <Kartu className="p-4"><Kv>
          {(tpl?.fields || []).map((f) => (
            <KvBaris key={f.key} k={L(f.label)}>{nilaiTampil(f)}</KvBaris>
          ))}
        </Kv></Kartu>
      </div>

      <Bagian judul={t("tbIsi")}
        kanan={
          <div className="flex gap-2">
            <button className="btn btn-kecil" onClick={unduh} disabled={sibuk}>
              ⤓ {sibuk ? "…" : t("eksporDocx")}
            </button>
            {admin && !d.batal && (
              <button className="btn btn-kecil btn-bahaya" onClick={() => setMinta(true)}>
                {t("tbBatalkan")}
              </button>
            )}
          </div>
        }>
        {/* Yang ditampilkan adalah isi yang DISIMPAN saat dokumen terbit,
            bukan hasil render ulang dari template. Kalau dirender ulang,
            kontrak yang dicetak tahun lalu bisa berbunyi berbeda hanya
            karena alamat karyawannya diperbarui di daftar master. */}
        <div className="kertas">
          {d.isiJadi
            ? d.isiJadi
            : <span dangerouslySetInnerHTML={{
              __html: tpl ? pratinjauDokumen(tpl.isi, tpl.fields, d.nilai,
                { nomor: d.nomor, terbit: d.terbit }, master) : "—",
            }} />}
        </div>
      </Bagian>

      <Bagian judul={t("jejak")}>
        <Jejak baris={jejak} labelStatus={(s) => s || "—"}
          labelAksi={(a) => LABEL_AKSI[lang]?.[a] || a} />
      </Bagian>

      {minta && (
        <ModalAlasan judul={t("tbBatalJudul")} tanya={t("tbBatalTanya")}
          keterangan="Nomornya tetap tercatat terpakai. Register boleh bolong, tapi tiap yang bolong harus punya penjelasan tertulis."
          tombol={t("tbBatalkan")} sibuk={sibuk} tutup={() => setMinta(false)}
          kirim={async (alasan) => {
            setSibuk(true);
            try {
              const r = await panggil("dokumen-action", { aksi: "batalkan", nomor: d.nomor, alasan });
              pesan(r.pesan); setMinta(false);
            } catch (e) { pesan(e.message, "bad"); }
            finally { setSibuk(false); }
          }} />
      )}
    </>
  );
}
