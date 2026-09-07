import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import { KepalaHalaman, Modal, Isian, usePesan } from "../components/ui.jsx";
import TabelPermintaan from "../components/TabelPermintaan.jsx";
import { panggil } from "../lib/api.js";

export default function Permintaan() {
  const { t, L } = useBahasa();
  const { permintaan, templateAktif } = useData();
  const pesan = usePesan();
  const nav = useNavigate();
  const [buka, setBuka] = useState(false);
  const [tid, setTid] = useState("");
  const [untuk, setUntuk] = useState("");
  const [catatan, setCatatan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function kirim() {
    setSibuk(true);
    try {
      const r = await panggil("permintaan-action", { aksi: "buat", tid, untuk, catatan });
      pesan(`Permintaan ${r.no} terkirim.`);
      setBuka(false); setTid(""); setUntuk(""); setCatatan("");
      nav(`/permintaan/${r.no}`);
    } catch (e) { pesan(e.message, "bad"); }
    finally { setSibuk(false); }
  }

  return (
    <>
      <KepalaHalaman judul={t("nPermintaan")} lede={t("pdLede")}
        kanan={<button className="btn btn-utama" onClick={() => setBuka(true)}>+ {t("pdBaru")}</button>} />
      <TabelPermintaan baris={permintaan} />

      {buka && (
        <Modal judul={t("pdBuatJudul")} tutup={() => setBuka(false)}
          anak={
            <div className="grid gap-4">
              <Isian label={t("pdJenis")} wajib htmlFor="tj">
                <select id="tj" className="inp" value={tid} onChange={(e) => setTid(e.target.value)}>
                  <option value="">—</option>
                  {templateAktif.map((x) => (
                    <option key={x.tid} value={x.tid}>{x.kode} · {L(x.nama)}</option>
                  ))}
                </select>
              </Isian>
              <Isian label={t("pdUntuk")} wajib htmlFor="uu"
                hint="Nama karyawan atau nama vendor yang dituju dokumen ini.">
                <input id="uu" className="inp" value={untuk} onChange={(e) => setUntuk(e.target.value)} />
              </Isian>
              <Isian label={t("pdKeterangan")} htmlFor="kk">
                <textarea id="kk" rows={3} className="inp resize-y" value={catatan}
                  onChange={(e) => setCatatan(e.target.value)} />
              </Isian>
            </div>
          }
          kaki={
            <>
              <button className="btn" onClick={() => setBuka(false)}>{t("batal")}</button>
              <button className="btn btn-utama" disabled={sibuk || !tid || !untuk.trim()} onClick={kirim}>
                {sibuk ? "…" : t("kirim")}
              </button>
            </>
          } />
      )}
    </>
  );
}
