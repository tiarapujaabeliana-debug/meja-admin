import { Link } from "react-router-dom";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import { KepalaHalaman } from "../components/ui.jsx";
import TabelPengajuan from "../components/TabelPengajuan.jsx";

export default function Reimburse() {
  const { t } = useBahasa();
  const { pengajuan } = useData();
  return (
    <>
      <KepalaHalaman judul={t("nReimburse")} lede={t("rbLede")}
        kanan={<Link className="btn btn-utama" to="/reimburse/baru">+ {t("rbBaru")}</Link>} />
      <TabelPengajuan baris={pengajuan} />
    </>
  );
}
