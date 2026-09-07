import { useState } from "react";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import {
  KepalaHalaman, Bagian, Tabel, Pil, Isian, Catatan, Kartu, Kv, KvBaris, usePesan,
} from "../components/ui.jsx";
import { rupiah } from "../lib/format.js";
import { ambangBerlaku, CUT_OFF, periodeDari, rentangPeriode } from "../lib/reimburseMeta.js";
import { KODE_PERUSAHAAN } from "../lib/dokumenMeta.js";
import { panggil } from "../lib/api.js";

export default function Kebijakan() {
  const { t } = useBahasa();
  const { ambang, templateAktif } = useData();
  const pesan = usePesan();
  const hariIni = new Date().toISOString().slice(0, 10);
  const aktif = ambangBerlaku(ambang, hariIni);
  const periodeIni = periodeDari(hariIni);
  const rentang = rentangPeriode(periodeIni);

  const [nilai, setNilai] = useState("");
  const [mulai, setMulai] = useState(hariIni);
  const [sibuk, setSibuk] = useState(false);

  const [kodeNo, setKodeNo] = useState(templateAktif[0]?.kode || "");
  const [mulaiDari, setMulaiDari] = useState("");
  const [alasanNo, setAlasanNo] = useState("");

  async function tambahAmbang() {
    setSibuk(true);
    try {
      const r = await panggil("master-action", { aksi: "tambahAmbang", nilai: Number(nilai), berlakuMulai: mulai });
      pesan(r.pesan); setNilai("");
    } catch (e) { pesan(e.message, "bad"); }
    finally { setSibuk(false); }
  }

  async function setelNomor() {
    setSibuk(true);
    try {
      const r = await panggil("template-action", {
        aksi: "setelNomorAwal", kode: kodeNo, mulaiDari: Number(mulaiDari),
        tahun: new Date().getFullYear(), alasan: alasanNo,
      });
      pesan(r.pesan); setMulaiDari(""); setAlasanNo("");
    } catch (e) { pesan(e.message, "bad"); }
    finally { setSibuk(false); }
  }

  return (
    <>
      <KepalaHalaman judul={t("nKebijakan")} lede={t("kebLede")} />

      <Bagian judul={t("kebAmbang")}
        sub="Versi lama tidak pernah dihapus. Yang dipakai untuk sebuah pengajuan adalah versi yang berlaku pada tanggal pengajuan itu — bukan versi terbaru.">
        <Tabel kolom={[{ t: t("kebAmbang"), num: true }, { t: t("kebBerlaku") },
          { t: t("kebDitetapkan") }, { t: "" }]}>
          {[...ambang].sort((a, b) => (a.berlakuMulai < b.berlakuMulai ? 1 : -1)).map((a) => (
            <tr key={a.id}>
              <td className="num">{rupiah(a.nilai)}</td>
              <td className="kode">{a.berlakuMulai}</td>
              <td>{a.olehNama || "—"}</td>
              <td>{aktif && a.berlakuMulai === aktif.berlakuMulai && <Pil nada="ok">{t("kebSekarang")}</Pil>}</td>
            </tr>
          ))}
        </Tabel>

        <div className="kartu p-4 mt-3.5 grid md:grid-cols-[1fr_1fr_auto] gap-3.5 items-end">
          <Isian label={t("kebAmbang")} wajib htmlFor="an">
            <input id="an" type="number" min="0" step="500000" className="inp" value={nilai}
              onChange={(e) => setNilai(e.target.value)} />
          </Isian>
          <Isian label={t("kebBerlaku")} wajib htmlFor="ab"
            hint="Hari ini atau ke depan. Ambang tidak boleh berlaku surut.">
            <input id="ab" type="date" min={hariIni} className="inp" value={mulai}
              onChange={(e) => setMulai(e.target.value)} />
          </Isian>
          <button className="btn btn-utama" disabled={sibuk || !(Number(nilai) > 0)} onClick={tambahAmbang}>
            {t("kebTambah")}
          </button>
        </div>
      </Bagian>

      <Bagian judul={t("kebPeriode")}>
        <Kartu className="p-4">
          <Kv>
            <KvBaris k="Rentang"><b>{CUT_OFF} → {CUT_OFF - 1}</b>, dilabeli bulan tempat periode berakhir</KvBaris>
            <KvBaris k="Periode ini"><span className="kode">{periodeIni}</span> ({rentang.mulai} → {rentang.selesai})</KvBaris>
          </Kv>
          <div className="mt-3"><Catatan nada="warn" html={t("kebPeriodeAsumsi")} /></div>
          <p className="hint mt-2">
            Mengubah cut-off berarti mengubah CUT_OFF di src/lib/reimburseMeta.js — satu tempat,
            dan seluruh aplikasi ikut. Tidak ada halaman lain yang menghitungnya sendiri.
          </p>
        </Kartu>
      </Bagian>

      <Bagian judul={t("kebNomor")}>
        <Kartu className="p-4">
          <Kv>
            <KvBaris k={t("kebFormat")}><span className="font-mono font-semibold">014/PKS/{KODE_PERUSAHAAN}/IX/2026</span></KvBaris>
            <KvBaris k={t("kebUrutan")}>{t("kebUrutanIsi")}</KvBaris>
            <KvBaris k={t("kebReset")}>{t("kebResetIsi")}</KvBaris>
          </Kv>
          <div className="mt-3"><Catatan nada="warn" html={t("kebNomorAsumsi")} /></div>

          <div className="grid md:grid-cols-[140px_160px_1fr_auto] gap-3.5 items-end mt-4
            border-t border-line dark:border-line-dark pt-4">
            <Isian label="Kode" htmlFor="kn">
              <select id="kn" className="inp" value={kodeNo} onChange={(e) => setKodeNo(e.target.value)}>
                {templateAktif.map((x) => <option key={x.kode} value={x.kode}>{x.kode}</option>)}
              </select>
            </Isian>
            <Isian label="Nomor terakhir terpakai" htmlFor="md"
              hint="Dari buku agenda surat.">
              <input id="md" type="number" min="0" className="inp" value={mulaiDari}
                onChange={(e) => setMulaiDari(e.target.value)} />
            </Isian>
            <Isian label={t("alasan")} htmlFor="al">
              <input id="al" className="inp" value={alasanNo} onChange={(e) => setAlasanNo(e.target.value)}
                placeholder="mis. melanjutkan buku agenda surat 2026" />
            </Isian>
            <button className="btn" disabled={sibuk || mulaiDari === ""} onClick={setelNomor}>
              Setel
            </button>
          </div>
          <p className="hint mt-2">
            Nomor berikutnya akan menjadi angka ini + 1. Hanya bisa dinaikkan, tidak bisa diturunkan —
            kalau diturunkan, nomor berikutnya akan menabrak dokumen yang sudah terbit.
          </p>
        </Kartu>
      </Bagian>
    </>
  );
}
