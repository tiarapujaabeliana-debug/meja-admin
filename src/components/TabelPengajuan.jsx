import { useNavigate } from "react-router-dom";
import { Tabel, Pil, Kosong } from "./ui.jsx";
import { useBahasa } from "../lib/i18n.jsx";
import { rupiah } from "../lib/format.js";
import { totalPengajuan, STATUS_NADA } from "../lib/reimburseMeta.js";

export default function TabelPengajuan({ baris, kosongJudul, kosongSub }) {
  const { t } = useBahasa();
  const nav = useNavigate();
  if (!baris.length) {
    return <Kosong judul={kosongJudul || t("rbKosong")} sub={kosongSub || t("rbKosongSub")} />;
  }
  return (
    <Tabel kolom={[
      { t: t("rbNomor") }, { t: t("rbPemohon") }, { t: t("rbKeperluan"), lebar: 220 },
      { t: t("rbTotal"), num: true }, { t: t("rbStatus") }, { t: t("terakhir") },
    ]}>
      {baris.map((p) => (
        <tr key={p.no} className="baris-klik" onClick={() => nav(`/reimburse/${p.no}`)}>
          <td>
            <span className="kode">{p.no}</span>
            {p.dokumen && <div className="hint font-mono">{p.dokumen}</div>}
          </td>
          <td>{p.pemohonNama}</td>
          <td className="max-w-[260px]">{p.keperluan}</td>
          <td className="num">{rupiah(totalPengajuan(p))}</td>
          <td><Pil nada={STATUS_NADA[p.status]}>{t("st_" + p.status)}</Pil></td>
          <td className="kode text-[11.5px]">{p.diubah}</td>
        </tr>
      ))}
    </Tabel>
  );
}
