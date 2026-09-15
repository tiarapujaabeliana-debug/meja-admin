import { useMemo, useState } from "react";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import {
  KepalaHalaman, Bagian, Kosong, LampiranPreviewModal, usePesan,
} from "../components/ui.jsx";
import { rentangPeriode } from "../lib/reimburseMeta.js";
import { panggil } from "../lib/api.js";

/**
 * "Pembukuan" invoice — bukan folder sungguhan (semua bukti tetap satu
 * bucket privat di Supabase, lihat lampiran-url.js), tapi TAMPILANNYA
 * disusun seperti struktur folder yang diminta: Periode (bulan) →
 * Pemohon → berkas, supaya superadmin bisa menelusuri bukti reimburse
 * tanpa harus buka satu-satu pengajuan dari menu Reimburse biasa.
 *
 * Sumber datanya sama persis dengan yang dipakai menu Reimburse/Rekap —
 * tidak ada query atau koleksi baru — cuma disusun ulang di layar.
 */
export default function ArsipInvoice() {
  const { t } = useBahasa();
  const { pengajuan, akun } = useData();
  const pesan = usePesan();
  const [pratinjau, setPratinjau] = useState(null); // { url, nama } | null
  const [sibuk, setSibuk] = useState(null); // jalur yang lagi dimuat

  const namaAkun = (kode) => akun.find((a) => a.id === kode)?.nama || kode;

  const struktur = useMemo(() => {
    const per = {};
    for (const p of pengajuan) {
      if (!p.lampiranList || p.lampiranList.length === 0) continue;
      per[p.periode] ??= {};
      per[p.periode][p.pemohonNama || "—"] ??= [];
      per[p.periode][p.pemohonNama || "—"].push(p);
    }
    // Terbaru dulu, dan tiap pemohon diurutkan dari pengajuan terbaru juga.
    const periodeUrut = Object.keys(per).sort().reverse();
    for (const bln of periodeUrut) {
      for (const nm of Object.keys(per[bln])) {
        per[bln][nm].sort((a, b) => (a.dibuat < b.dibuat ? 1 : -1));
      }
    }
    return { per, periodeUrut };
  }, [pengajuan]);

  async function bukaLampiran(jalur, nama) {
    setSibuk(jalur);
    try {
      const r = await panggil("lampiran-url", { aksi: "buka", jalur });
      setPratinjau({ url: r.url, nama });
    } catch (e) { pesan(e.message, "bad"); }
    finally { setSibuk(null); }
  }

  return (
    <>
      <KepalaHalaman judul={t("arsipJudul")} lede={t("arsipLede")} />

      {struktur.periodeUrut.length === 0 ? (
        <Kosong judul={t("arsipKosong")} sub={t("arsipKosongSub")} />
      ) : struktur.periodeUrut.map((bln) => {
        const rentang = rentangPeriode(bln);
        const pemohonList = Object.keys(struktur.per[bln]).sort();
        return (
          <Bagian key={bln}
            judul={`📁 ${t("rbPeriode")} ${bln}`}
            sub={`${rentang.mulai} → ${rentang.selesai}`}>
            <div className="flex flex-col gap-3">
              {pemohonList.map((nm) => (
                <div key={nm} className="kartu p-4">
                  <div className="font-bold text-[13.5px] mb-2.5 flex items-center gap-1.5">
                    <span>📂</span> {nm}
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {struktur.per[bln][nm].flatMap((p) => {
                      const akunUnik = [...new Set((p.lines || []).map((l) => l.akun))]
                        .map(namaAkun).join(", ");
                      const tgl = p.tanggalInvoice || String(p.dibuat).slice(0, 10);
                      return p.lampiranList.map((f, i) => (
                        <li key={p.no + "-" + i}
                          className="flex items-center justify-between gap-3 flex-wrap
                            py-1.5 border-t border-line dark:border-line-dark first:border-t-0 first:pt-0">
                          <div className="min-w-0 text-[12.5px]">
                            <div className="font-medium truncate">
                              {tgl} · <span className="kode">{p.no}</span> · {nm}
                              {akunUnik && <> · {akunUnik}</>}
                            </div>
                            <div className="hint truncate">{f.nama || "berkas"}</div>
                          </div>
                          <button className="btn btn-kecil btn-samar shrink-0" disabled={sibuk === f.jalur}
                            onClick={() => bukaLampiran(f.jalur, f.nama)}>
                            {sibuk === f.jalur ? "…" : t("arsipLihat")}
                          </button>
                        </li>
                      ));
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Bagian>
        );
      })}

      {pratinjau && (
        <LampiranPreviewModal url={pratinjau.url} nama={pratinjau.nama} tutup={() => setPratinjau(null)} />
      )}
    </>
  );
}
