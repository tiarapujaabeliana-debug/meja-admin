import { Link } from "react-router-dom";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import { KepalaHalaman, Kosong, Catatan } from "../components/ui.jsx";

export default function Template() {
  const { t, L } = useBahasa();
  const { templateAktif, dokumen } = useData();

  return (
    <>
      <KepalaHalaman judul={t("nTemplate")} lede={t("tplLede")}
        kanan={<Link className="btn btn-utama" to="/setelan/template/baru">+ {t("tplBaru")}</Link>} />

      {templateAktif.length === 0 ? (
        <Kosong judul={t("tplKosong")} sub={t("tplKosongSub")}
          aksi={<Link className="btn btn-utama" to="/setelan/template/baru">{t("tplBaru")}</Link>} />
      ) : (
        <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(270px,1fr))]">
          {templateAktif.map((x) => {
            const n = dokumen.filter((d) => d.tid === x.tid).length;
            return (
              <div key={x.tid} className="kartu p-4 flex flex-col">
                <div className="lbl">{x.kode} · {t("tplVersi", { "%v": x.versi })}</div>
                <h3 className="text-[15px] font-bold mt-1 mb-1.5">{L(x.nama)}</h3>
                <div className="hint mb-3">
                  {x.fields.length} {t("genIsian")} · {t("tplJumlahTerbit", { "%n": n })}
                </div>
                <div className="flex flex-wrap gap-1 mb-3.5">
                  {x.fields.slice(0, 6).map((f) => (
                    <span key={f.key} className="chip">{`{{${f.key}}}`}</span>
                  ))}
                  {x.fields.length > 6 && <span className="chip">+{x.fields.length - 6}</span>}
                </div>
                <div className="flex gap-2 mt-auto">
                  <Link className="btn btn-kecil" to={`/setelan/template/${x.tid}`}>{t("tplBuka")}</Link>
                  <Link className="btn btn-kecil btn-utama" to={`/dokumen/terbitkan?tid=${x.tid}`}>
                    {t("tplTerbitkanDari")}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5"><Catatan>{t("tplCatatanVersi")}</Catatan></div>
    </>
  );
}
