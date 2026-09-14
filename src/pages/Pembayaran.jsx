import { useState } from "react";
import { Link } from "react-router-dom";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import { useSesi } from "../auth/useAuth.jsx";
import { KepalaHalaman, Bagian, Tabel, Kosong, usePesan } from "../components/ui.jsx";
import { rupiah } from "../lib/format.js";
import { totalPengajuan, aksiTersedia } from "../lib/reimburseMeta.js";
import { panggil } from "../lib/api.js";
import { slugNomor } from "../lib/nav.js";

/**
 * Satu halaman, dua peran berbeda:
 *  - Director melepas pengajuan yang sudah disetujui ke antrean bayar.
 *  - Finance melihat rekening tujuan lalu menandai sudah ditransfer.
 * Superadmin/Owner melihat keduanya tanpa tombol aksi (read-only), supaya
 * tetap bisa memantau sejauh mana pembayaran berjalan tanpa ikut memegang
 * tombolnya sendiri.
 */
export default function Pembayaran() {
  const { t } = useBahasa();
  const { pengajuan, rekeningUser } = useData();
  const { peran, uid } = useSesi();
  const pesan = usePesan();
  const [sibuk, setSibuk] = useState(null); // no pengajuan yang sedang diproses

  const menungguRilis = pengajuan.filter((p) => p.status === "disetujui");
  const untukDibayar = pengajuan.filter((p) => p.status === "menunggu_pembayaran");
  const sudahDibayar = pengajuan.filter((p) => p.status === "dibayar").slice(0, 30);

  async function jalankan(no, aksi) {
    setSibuk(no);
    try {
      const r = await panggil("reimburse-action", { aksi, no });
      pesan(aksi === "antriBayar" ? t("okAntriBayar") : t("okBayar"));
    } catch (e) { pesan(e.message, "bad"); }
    finally { setSibuk(null); }
  }

  return (
    <>
      <KepalaHalaman judul={t("nPembayaran")} lede={t("pbLede")} />

      <Bagian judul={t("pbMenungguRilis")}>
        {menungguRilis.length === 0 ? (
          <Kosong judul={t("pbKosongRilis")} />
        ) : (
          <Tabel kolom={[
            { t: t("rbNomor") }, { t: t("rbPemohon") }, { t: t("rbKeperluan"), lebar: 220 },
            { t: t("rbTotal"), num: true }, { t: "" },
          ]}>
            {menungguRilis.map((p) => {
              const boleh = aksiTersedia(p, peran, uid).includes("antriBayar");
              return (
                <tr key={p.no}>
                  <td><Link className="kode underline underline-offset-2" to={`/reimburse/${slugNomor(p.no)}`}>{p.no}</Link></td>
                  <td>{p.pemohonNama}</td>
                  <td className="max-w-[260px]">{p.keperluan}</td>
                  <td className="num">{rupiah(totalPengajuan(p))}</td>
                  <td>
                    {boleh && (
                      <button className="btn btn-kecil btn-utama" disabled={sibuk === p.no}
                        onClick={() => jalankan(p.no, "antriBayar")}>
                        {sibuk === p.no ? "…" : t("aAntriBayar")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Tabel>
        )}
      </Bagian>

      <Bagian judul={t("pbUntukDibayar")}>
        {untukDibayar.length === 0 ? (
          <Kosong judul={t("pbKosongBayar")} />
        ) : (
          <Tabel kolom={[
            { t: t("rbNomor") }, { t: t("rbPemohon") }, { t: t("pbRekening"), lebar: 200 },
            { t: t("rbTotal"), num: true }, { t: "" },
          ]}>
            {untukDibayar.map((p) => {
              const rek = rekeningUser(p.pemohonUid);
              const boleh = aksiTersedia(p, peran, uid).includes("bayar");
              return (
                <tr key={p.no}>
                  <td><Link className="kode underline underline-offset-2" to={`/reimburse/${slugNomor(p.no)}`}>{p.no}</Link></td>
                  <td>{p.pemohonNama}</td>
                  <td>
                    {rek?.bankNorek
                      ? <>
                        <div className="font-mono">{rek.bankNorek}</div>
                        <div className="hint">{rek.bankNama} · a.n. {rek.bankAtasNama}</div>
                      </>
                      : <span className="hint">{t("pbTakAdaRekening")}</span>}
                  </td>
                  <td className="num">{rupiah(totalPengajuan(p))}</td>
                  <td>
                    {boleh && (
                      <button className="btn btn-kecil btn-utama" disabled={sibuk === p.no}
                        onClick={() => jalankan(p.no, "bayar")}>
                        {sibuk === p.no ? "…" : t("aBayar")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Tabel>
        )}
      </Bagian>

      <Bagian judul={t("pbRiwayat")}>
        {sudahDibayar.length === 0 ? (
          <Kosong judul={t("pbKosongBayar")} />
        ) : (
          <Tabel kolom={[
            { t: t("rbNomor") }, { t: t("rbPemohon") }, { t: t("rbTotal"), num: true }, { t: t("terakhir") },
          ]}>
            {sudahDibayar.map((p) => (
              <tr key={p.no}>
                <td><Link className="kode underline underline-offset-2" to={`/reimburse/${slugNomor(p.no)}`}>{p.no}</Link></td>
                <td>{p.pemohonNama}</td>
                <td className="num">{rupiah(totalPengajuan(p))}</td>
                <td className="kode text-[11.5px]">{p.diubah}</td>
              </tr>
            ))}
          </Tabel>
        )}
      </Bagian>
    </>
  );
}