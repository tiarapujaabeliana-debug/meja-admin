import { useState, useRef, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import {
  KepalaHalaman, Bagian, Isian, Catatan, Modal, usePesan,
} from "../components/ui.jsx";
import {
  pratinjauDokumen, slugKunci, kunciDipakai, TIPE_ISIAN, SUB_KUNCI, ISIAN_OTOMATIS, kodeSah,
} from "../lib/dokumenMeta.js";
import { panggil } from "../lib/api.js";

/**
 * Editor template.
 *
 * Isi dokumen ditempel apa adanya; bagian yang mau dikosongkan ditandai
 * lewat tombol "Sisipkan isian", yang menaruh {{kunci}} tepat di posisi
 * kursor dan sekaligus mendaftarkan tipe isiannya. Tanpa pendaftaran tipe,
 * layar penerbitan tidak tahu harus menampilkan kotak teks, pilihan, atau
 * daftar karyawan — dan Abeliana harus mengetik ulang NIK tiap kali.
 */
export default function TemplateEdit() {
  const { tid } = useParams();
  const { t, L } = useBahasa();
  const { template, templateAktif, master } = useData();
  const pesan = usePesan();
  const nav = useNavigate();
  const areaRef = useRef(null);

  const baru = tid === "baru";
  const asal = useMemo(
    () => (baru ? null : templateAktif.find((x) => x.tid === tid)),
    [baru, templateAktif, tid]);

  const [nama, setNama] = useState(asal ? { ...asal.nama } : { id: "", en: "" });
  const [kode, setKode] = useState(asal?.kode || "");
  const [isi, setIsi] = useState(asal?.isi || "");
  const [fields, setFields] = useState(asal ? JSON.parse(JSON.stringify(asal.fields)) : []);
  const [salah, setSalah] = useState([]);
  const [sibuk, setSibuk] = useState(false);
  const [modalIsian, setModalIsian] = useState(null);

  const versiLama = asal?.versi || 0;
  const adaDokumen = asal ? template.some((x) => x.tid === asal.tid) : false;

  function sisipDiKursor(teks) {
    const el = areaRef.current;
    const pos = el ? el.selectionStart : isi.length;
    const baruIsi = isi.slice(0, pos) + teks + isi.slice(pos);
    setIsi(baruIsi);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = pos + teks.length;
    });
  }

  function simpanIsian(f) {
    const key = slugKunci(f.key || f.label);
    if (fields.some((x) => x.key === key)) {
      pesan(t("isianKunciBentrok", { "%k": key }), "bad");
      return;
    }
    const isianBaru = { key, label: { id: f.label, en: f.label }, tipe: f.tipe,
      wajib: !!f.wajib, opsi: f.opsi || [] };
    setFields((F) => [...F, isianBaru]);
    sisipDiKursor("{{" + key + (["karyawan", "vendor"].includes(f.tipe) ? ".nama" : "") + "}}");
    setModalIsian(null);
  }

  function hapusIsian(i) {
    const f = fields[i];
    if (kunciDipakai(isi, f.key)) {
      pesan(t("isianMasihDipakai", { "%k": f.key }), "bad");
      return;
    }
    setFields((F) => F.filter((_, j) => j !== i));
  }

  async function simpan() {
    const e = [];
    if (!nama.id.trim()) e.push(t("tplSalahNama"));
    if (!kodeSah(kode.toUpperCase())) e.push(t("tplSalahKode"));
    if (!isi.trim()) e.push(t("tplSalahIsi"));
    setSalah(e);
    if (e.length) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }

    setSibuk(true);
    try {
      const r = await panggil("template-action", {
        aksi: "simpan",
        template: { tid: baru ? null : tid, nama, kode: kode.toUpperCase(), isi, fields },
      });
      pesan(r.pesan);
      nav("/setelan/template");
    } catch (err) { pesan(err.message, "bad"); }
    finally { setSibuk(false); }
  }

  return (
    <>
      <Link className="btn btn-samar btn-kecil mb-3.5" to="/setelan/template">← {t("kembali")}</Link>
      <KepalaHalaman
        eyebrow={baru ? t("tplBaru") : `${t("tplVersi", { "%v": versiLama })} → ${t("tplVersi", { "%v": versiLama + 1 })}`}
        judul={nama.id || t("tplBaru")} />

      {salah.length > 0 && (
        <div className="mb-4"><Catatan nada="bad">
          <ul className="pl-5 list-disc">{salah.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </Catatan></div>
      )}

      <div className="kartu p-4 grid md:grid-cols-[2fr_2fr_1fr] gap-3.5 mb-4">
        <Isian label={`${t("tplNama")} (ID)`} wajib htmlFor="ni">
          <input id="ni" className="inp" value={nama.id}
            onChange={(e) => setNama((n) => ({ ...n, id: e.target.value }))} />
        </Isian>
        <Isian label={`${t("tplNama")} (EN)`} htmlFor="ne">
          <input id="ne" className="inp" value={nama.en || ""}
            onChange={(e) => setNama((n) => ({ ...n, en: e.target.value }))} />
        </Isian>
        <Isian label={t("tplKode")} wajib hint={t("tplKodePetunjuk")} htmlFor="kd">
          <input id="kd" className="inp uppercase" maxLength={8} value={kode}
            disabled={adaDokumen && !baru && false}
            onChange={(e) => setKode(e.target.value.toUpperCase().replace(/\s+/g, ""))} />
        </Isian>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="lbl">{t("tplIsi")}</div>
            <button className="btn btn-kecil btn-utama ml-auto"
              onClick={() => setModalIsian({ label: "", key: "", tipe: "teks", wajib: true, opsi: [] })}>
              {t("tplSisip")}
            </button>
          </div>
          <textarea ref={areaRef} value={isi} onChange={(e) => setIsi(e.target.value)}
            className="inp font-mono text-[12.5px] leading-[1.75] min-h-[420px] whitespace-pre resize-y"
            placeholder={t("tplIsiPetunjuk")} />
          <div className="hint mt-1.5">{t("tplIsiPetunjuk")}</div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {ISIAN_OTOMATIS.map((k) => (
              <button key={k} className="chip hover:bg-frost-soft dark:hover:bg-frost-dark-soft"
                onClick={() => sisipDiKursor(`{{${k}}}`)}>{`{{${k}}}`}</button>
            ))}
          </div>
        </div>

        <div className="kartu p-4">
          <div className="lbl mb-2">{t("tplIsian")}</div>
          {fields.length === 0 ? <p className="hint">{t("tplBelumAdaIsian")}</p> : (
            <div className="flex flex-col">
              {fields.map((f, i) => (
                <div key={f.key}
                  className={`flex gap-2 items-start py-2.5 ${i ? "border-t border-line dark:border-line-dark" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold">
                      {L(f.label)}{f.wajib && <span className="text-bad dark:text-bad-dark"> *</span>}
                    </div>
                    <div className="font-mono text-[11.5px] text-frost-deep dark:text-frost-dark-deep break-all">
                      {`{{${f.key}}}`}
                    </div>
                    <div className="hint">{t("ty_" + f.tipe)}</div>
                    {SUB_KUNCI[f.tipe] && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {SUB_KUNCI[f.tipe].map((s) => (
                          <button key={s} className="chip hover:bg-frost-soft dark:hover:bg-frost-dark-soft"
                            onClick={() => sisipDiKursor(`{{${f.key}.${s}}}`)}>.{s}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="btn btn-kecil btn-samar" aria-label={t("kHapus")}
                    onClick={() => hapusIsian(i)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Bagian judul={t("genPratinjau")}>
        <div className="kertas"
          dangerouslySetInnerHTML={{ __html: pratinjauDokumen(isi, fields, {}, {}, master) }} />
      </Bagian>

      <div className="mt-6 flex gap-2 flex-wrap">
        <Link className="btn" to="/setelan/template">{t("batal")}</Link>
        <div className="ml-auto">
          <button className="btn btn-utama" onClick={simpan} disabled={sibuk}>
            {sibuk ? "…" : baru ? t("tplSimpanBaru") : t("tplSimpanVersi")}
          </button>
        </div>
      </div>
      {!baru && <div className="mt-3.5"><Catatan>{t("tplCatatanVersi")}</Catatan></div>}

      {modalIsian && (
        <ModalIsian awal={modalIsian} tutup={() => setModalIsian(null)} simpan={simpanIsian} />
      )}
    </>
  );
}

function ModalIsian({ awal, tutup, simpan }) {
  const { t } = useBahasa();
  const [f, setF] = useState(awal);
  const [kunciManual, setKunciManual] = useState(false);
  const kunci = kunciManual ? f.key : slugKunci(f.label);

  return (
    <Modal judul={t("isianBaru")} tutup={tutup}
      anak={
        <div className="grid gap-4">
          <Isian label={t("isianNama")} wajib hint={t("isianNamaPetunjuk")} htmlFor="fl">
            <input id="fl" autoFocus className="inp" value={f.label}
              onChange={(e) => setF((x) => ({ ...x, label: e.target.value }))} />
          </Isian>
          <Isian label={t("isianKunci")} hint={t("isianKunciPetunjuk")} htmlFor="fk">
            <input id="fk" className="inp font-mono" value={kunci}
              onChange={(e) => { setKunciManual(true); setF((x) => ({ ...x, key: e.target.value })); }} />
          </Isian>
          <Isian label={t("isianTipe")} htmlFor="ft">
            <select id="ft" className="inp" value={f.tipe}
              onChange={(e) => setF((x) => ({ ...x, tipe: e.target.value }))}>
              {TIPE_ISIAN.map((x) => <option key={x} value={x}>{t("ty_" + x)}</option>)}
            </select>
          </Isian>
          {f.tipe === "pilihan" && (
            <Isian label={t("isianOpsi")} htmlFor="fo">
              <textarea id="fo" rows={4} className="inp resize-y font-mono text-[12.5px]"
                value={(f.opsi || []).join("\n")}
                onChange={(e) => setF((x) => ({
                  ...x, opsi: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                }))} />
            </Isian>
          )}
          {SUB_KUNCI[f.tipe] && (
            <Catatan>
              {t("isianSubPetunjuk")}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {SUB_KUNCI[f.tipe].map((s) => (
                  <span key={s} className="chip">{`{{${kunci || "kunci"}.${s}}}`}</span>
                ))}
              </div>
            </Catatan>
          )}
          <label className="flex items-center gap-2 text-[13px] font-medium cursor-pointer">
            <input type="checkbox" checked={f.wajib}
              onChange={(e) => setF((x) => ({ ...x, wajib: e.target.checked }))} />
            {t("isianWajib")}
          </label>
        </div>
      }
      kaki={
        <>
          <button className="btn" onClick={tutup}>{t("batal")}</button>
          <button className="btn btn-utama" disabled={!f.label.trim()}
            onClick={() => simpan({ ...f, key: kunci })}>{t("isianSisipkan")}</button>
        </>
      } />
  );
}
