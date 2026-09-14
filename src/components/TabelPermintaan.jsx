import { useNavigate } from "react-router-dom";
import { Tabel, Pil, Kosong } from "./ui.jsx";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import { PERMINTAAN_NADA } from "../lib/dokumenMeta.js";

export default function TabelPermintaan({ baris }) {
  const { t, L } = useBahasa();
  const { cariTemplate } = useData();
  const nav = useNavigate();
  if (!baris.length) return <Kosong judul={t("pdKosong")} sub={t("pdKosongSub")} />;
  return (
    <Tabel kolom={[
      { t: t("rbNomor") }, { t: t("pdJenis") }, { t: t("pdUntuk") },
      { t: t("pdNomor") }, { t: t("rbStatus") }, { t: t("terakhir") },
    ]}>
      {baris.map((r) => {
        const tpl = cariTemplate(r.tid);
        return (
          <tr key={r.no} className="baris-klik" onClick={() => nav(`/permintaan/${r.no}`)}>
            <td><span className="kode">{r.no}</span></td>
            <td>{tpl ? L(tpl.nama) : "—"}</td>
            <td>{r.untuk}</td>
            <td>{r.dokumen
              ? <span className="font-mono font-semibold text-[12.5px]">{r.dokumen}</span>
              : <span className="hint">{t("pdBelumTerbit")}</span>}</td>
            <td><Pil nada={PERMINTAAN_NADA[r.status]}>{t("pd_" + r.status)}</Pil></td>
            <td className="kode text-[11.5px]">{r.diubah}</td>
          </tr>
        );
      })}
    </Tabel>
  );
}