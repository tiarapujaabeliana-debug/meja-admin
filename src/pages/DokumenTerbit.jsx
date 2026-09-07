import { Link, useNavigate } from "react-router-dom";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import { useSesi, ADMIN } from "../auth/useAuth.jsx";
import { KepalaHalaman, Tabel, Pil, Kosong, Statistik, Catatan } from "../components/ui.jsx";
import { dokumenBebas } from "../lib/dokumenMeta.js";
import { slugNomor } from "../lib/nav.js";

export default function DokumenTerbit() {
  const { t, L } = useBahasa();
  const { dokumen, cariTemplate } = useData();
  const { peran } = useSesi();
  const nav = useNavigate();
  const admin = ADMIN.includes(peran);

  return (
    <>
      <KepalaHalaman judul={t("nTerbit")} lede={t("tbLede")}
        kanan={admin && <Link className="btn btn-utama" to="/dokumen/terbitkan">+ {t("genJudul")}</Link>} />

      <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-5">
        <Statistik n={dokumen.length} l={t("nTerbit")} />
        <Statistik n={dokumenBebas(dokumen).length} l={t("tbBebas")} />
        <Statistik n={dokumen.filter((d) => d.pakai).length} l={t("tbTerpakai")} />
        <Statistik n={dokumen.filter((d) => d.batal).length} l={t("tbBatal")} />
      </div>

      {dokumen.length === 0 ? (
        <Kosong judul={t("tbKosong")} sub={t("tbKosongSub")}
          aksi={admin && <Link className="btn btn-utama" to="/dokumen/terbitkan">{t("genJudul")}</Link>} />
      ) : (
        <Tabel kolom={[
          { t: t("tbNomor") }, { t: t("tbTemplate") }, { t: t("tbPerihal"), lebar: 220 },
          { t: t("tbTerbit") }, { t: t("tbPemakaian") },
        ]}>
          {dokumen.map((d) => {
            const tpl = cariTemplate(d.tid, d.versi);
            return (
              <tr key={d.nomor} className="baris-klik" onClick={() => nav(`/dokumen/${slugNomor(d.nomor)}`)}>
                <td><span className="font-mono font-semibold text-[12.5px]">{d.nomor}</span></td>
                <td>{tpl ? L(tpl.nama) : "—"}<div className="hint">{t("tbVersi")} {d.versi}</div></td>
                <td className="max-w-[260px]">{d.perihal}</td>
                <td className="kode text-[11.5px]">{d.terbit}<div className="hint">{d.olehNama}</div></td>
                <td>
                  {d.batal ? <Pil nada="muted">{t("tbBatal")}</Pil>
                    : d.pakai ? <><Pil nada="info">{t("tbTerpakai")}</Pil>
                      <div className="hint">{d.pakai.ref}</div></>
                      : <Pil nada="ok">{t("tbBebas")}</Pil>}
                </td>
              </tr>
            );
          })}
        </Tabel>
      )}

      <div className="mt-5">
        <Catatan>
          {t("tbLede")} Lompatan nomor di register ini normal selama tiap lompatan punya alasan
          tertulis — buka nomor yang bertanda “{t("tbBatal")}” untuk membacanya.
        </Catatan>
      </div>
    </>
  );
}
