import { useState, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import { KepalaHalaman, Bagian, Isian, Catatan, usePesan } from "../components/ui.jsx";
import { pratinjauDokumen, isianKurang, ISIAN_OTOMATIS } from "../lib/dokumenMeta.js";
import { rupiah } from "../lib/format.js";
import { panggil } from "../lib/api.js";
import { slugNomor } from "../lib/nav.js";

export default function Terbitkan() {
  const { t, L } = useBahasa();
  const { templateAktif, master, dokumen } = useData();
  const [sp] = useSearchParams();
  const pesan = usePesan();
  const nav = useNavigate();

  const [tid, setTid] = useState(sp.get("tid") || "");
  const [nilai, setNilai] = useState({});
  const [salah, setSalah] = useState([]);
  const [sibuk, setSibuk] = useState(false);
  const permintaan = sp.get("permintaan") || null;

  const tpl = useMemo(() => templateAktif.find((x) => x.tid === tid) || null, [templateAktif, tid]);
  const langkah = tpl ? 2 : 1;

  async function terbitkan() {
    const kurang = isianKurang(tpl, nilai);
    setSalah(kurang);
    if (kurang.length) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setSibuk(true);
    try {
      const r = await panggil("dokumen-action", { aksi: "terbitkan", tid, nilai, permintaan });
      pesan(t("genOk", { "%n": r.nomor }));
      nav(`/dokumen/${slugNomor(r.nomor)}`);
    } catch (e) { pesan(e.message, "bad"); }
    finally { setSibuk(false); }
  }

  const bar = [t("genL1"), t("genL2"), t("genL3")];

  return (
    <>
      <KepalaHalaman judul={t("genJudul")}
        kanan={<Link className="btn" to={permintaan ? `/permintaan/${permintaan}` : "/dokumen"}>{t("batal")}</Link>}
        eyebrow={permintaan ? `${t("nPermintaan")} ${permintaan}` : undefined} />

      <div className="flex gap-1.5 flex-wrap mb-5">
        {bar.map((s, i) => (
          <div key={s} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12.5px] font-semibold
            ${langkah === i + 1
              ? "bg-frost border-frost text-white dark:bg-frost-dark dark:border-frost-dark dark:text-ground-dark"
              : langkah > i + 1
                ? "bg-ok-soft border-ok-soft text-ok dark:bg-ok-dark-soft dark:border-ok-dark-soft dark:text-ok-dark"
                : "border-line dark:border-line-dark text-ink-3 dark:text-ink-dark-3"}`}>
            <span className="font-mono text-[11px] opacity-75">{i + 1}</span>{s}
          </div>
        ))}
      </div>

      {!tpl ? (
        <Bagian judul={t("genPilihTpl")}>
          {templateAktif.length === 0 ? (
            <Catatan nada="warn">
              Belum ada template sama sekali. Buat dulu di{" "}
              <Link className="underline" to="/setelan/template">Setelan → {t("nTemplate")}</Link>.
            </Catatan>
          ) : (
            <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
              {templateAktif.map((x) => (
                <button key={x.tid} onClick={() => { setTid(x.tid); setNilai({}); }}
                  className="kartu p-4 text-left hover:border-frost dark:hover:border-frost-dark">
                  <div className="lbl">{x.kode} · {t("tbVersi")} {x.versi}</div>
                  <div className="font-display font-bold text-[15px] mt-1 mb-1">{L(x.nama)}</div>
                  <div className="hint">
                    {x.fields.length} {t("genIsian")} · {t("tplJumlahTerbit", {
                      "%n": dokumen.filter((d) => d.tid === x.tid).length })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Bagian>
      ) : (
        <>
          {salah.length > 0 && (
            <div className="mb-4"><Catatan nada="bad">
              <b>{t("genSalahHead")}</b>
              <ul className="mt-1.5 pl-5 list-disc">{salah.map((f) => <li key={f.key}>{L(f.label)}</li>)}</ul>
            </Catatan></div>
          )}

          <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
            <div className="kartu p-4">
              <div className="lbl mb-3">{L(tpl.nama)} · {tpl.kode}</div>
              <div className="grid gap-3.5">
                {tpl.fields.map((f) => (
                  <Isian key={f.key} label={L(f.label)} wajib={f.wajib}
                    hint={f.tipe === "rupiah" && nilai[f.key] ? rupiah(nilai[f.key]) : undefined}>
                    <Kendali f={f} nilai={nilai[f.key] ?? ""} master={master}
                      ubah={(v) => setNilai((n) => ({ ...n, [f.key]: v }))} />
                  </Isian>
                ))}
              </div>
              <div className="mt-4">
                <Catatan>
                  <b>{t("genOtomatis")}:</b> {ISIAN_OTOMATIS.map((k) => `{{${k}}}`).join(", ")}
                  <div className="mt-1">{t("genOtomatisPetunjuk")}</div>
                </Catatan>
              </div>
            </div>

            <div>
              <div className="lbl mb-2">{t("genPratinjau")}</div>
              <div className="kertas text-[11.5px] px-5 py-5 max-h-[540px] overflow-y-auto"
                dangerouslySetInnerHTML={{
                  __html: pratinjauDokumen(tpl.isi, tpl.fields, nilai, {}, master),
                }} />
            </div>
          </div>

          <div className="kartu p-4 mt-6">
            <Catatan nada="warn">{t("genPeringatan")}</Catatan>
            <div className="flex gap-2 mt-3.5 flex-wrap">
              <button className="btn" onClick={() => { setTid(""); setNilai({}); setSalah([]); }}>
                ← {t("kembali")}
              </button>
              <div className="ml-auto">
                <button className="btn btn-utama" onClick={terbitkan} disabled={sibuk}>
                  {sibuk ? "…" : t("genTerbitkan")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Kendali({ f, nilai, ubah, master }) {
  const { t } = useBahasa();
  if (f.tipe === "karyawan" || f.tipe === "vendor") {
    const src = f.tipe === "karyawan" ? master.karyawan : master.vendor;
    return (
      <select className="inp" value={nilai} onChange={(e) => ubah(e.target.value)}>
        <option value="">—</option>
        {src.map((x) => (
          <option key={x.id} value={x.id}>{x.nama}{x.jabatan ? ` — ${x.jabatan}` : ""}</option>
        ))}
      </select>
    );
  }
  if (f.tipe === "pilihan") {
    return (
      <select className="inp" value={nilai} onChange={(e) => ubah(e.target.value)}>
        <option value="">—</option>
        {(f.opsi || []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (f.tipe === "teksPanjang") {
    return <textarea rows={3} className="inp resize-y" value={nilai} onChange={(e) => ubah(e.target.value)} />;
  }
  if (f.tipe === "tanggal") {
    /* Ini tanggal ISI DOKUMEN (mulai kerja, mulai berlaku), bukan catatan
       kapan sistem melakukan sesuatu — jadi memang diketik. Tanggal terbit
       dokumen tetap dari jam server dan tidak punya kolom di mana pun. */
    return <input type="date" className="inp" value={nilai} onChange={(e) => ubah(e.target.value)} />;
  }
  if (f.tipe === "angka" || f.tipe === "rupiah") {
    return <input type="number" min="0" className="inp" value={nilai}
      onChange={(e) => ubah(e.target.value)} placeholder={f.tipe === "rupiah" ? "0" : ""} />;
  }
  return <input className="inp" value={nilai} onChange={(e) => ubah(e.target.value)}
    placeholder={t("ty_" + f.tipe)} />;
}
