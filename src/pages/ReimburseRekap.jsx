import { useMemo } from "react";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import { KepalaHalaman, Bagian, Tabel, Statistik, Kosong } from "../components/ui.jsx";
import { rupiah } from "../lib/format.js";
import { totalPengajuan, periodeDari, rentangPeriode } from "../lib/reimburseMeta.js";

/**
 * Rekap periode BERJALAN — bukan laporan historis. Yang dibatalkan tidak
 * dihitung (memang tidak jadi biaya); yang lain, apa pun statusnya, tetap
 * dihitung karena tetap merupakan pengajuan periode ini.
 */
export default function ReimburseRekap() {
  const { t } = useBahasa();
  const { pengajuan } = useData();

  const periodeIni = periodeDari(new Date().toISOString().slice(0, 10));
  const rentang = rentangPeriode(periodeIni);

  const baris = useMemo(() => {
    const milikPeriode = pengajuan.filter((p) => p.periode === periodeIni && p.status !== "dibatalkan");
    const per = {};
    for (const p of milikPeriode) {
      const k = p.pemohonUid;
      if (!per[k]) per[k] = { nama: p.pemohonNama, jumlah: 0, total: 0 };
      per[k].jumlah += 1;
      per[k].total += totalPengajuan(p);
    }
    return Object.values(per).sort((a, b) => b.total - a.total);
  }, [pengajuan, periodeIni]);

  const totalPeriode = baris.reduce((s, b) => s + b.total, 0);

  return (
    <>
      <KepalaHalaman judul={t("nRekap")} lede={t("rkLede")} />

      <div className="mb-2 hint">
        {t("rbPeriode")} {periodeIni} ({rentang.mulai} → {rentang.selesai})
      </div>

      <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(155px,1fr))] mb-2">
        <Statistik n={rupiah(totalPeriode)} l={t("rkTotalPeriode")} />
        <Statistik n={baris.reduce((s, b) => s + b.jumlah, 0)} l={t("rkJumlahPengajuan")} />
        <Statistik n={baris.length} l={t("rkJumlahPengaju")} />
      </div>

      <Bagian judul={t("rkPerOrang")}>
        {baris.length === 0 ? (
          <Kosong judul={t("rbKosong")} />
        ) : (
          <Tabel kolom={[
            { t: t("rbPemohon") }, { t: t("rkJumlahPengajuan"), num: true }, { t: t("rbTotal"), num: true },
          ]}>
            {baris.map((b) => (
              <tr key={b.nama}>
                <td>{b.nama}</td>
                <td className="num">{b.jumlah}</td>
                <td className="num font-semibold">{rupiah(b.total)}</td>
              </tr>
            ))}
          </Tabel>
        )}
      </Bagian>
    </>
  );
}
