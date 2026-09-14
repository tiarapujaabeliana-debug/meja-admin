import { useState } from "react";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import {
  KepalaHalaman, Bagian, Tabel, Isian, Catatan, usePesan, Pil,
} from "../components/ui.jsx";
import { panggil } from "../lib/api.js";

/**
 * Impor Chart of Account.
 *
 * Kode akun HARUS persis sama dengan yang ada di Journal Mekari — beda
 * satu karakter dan berkas impornya ditolak. Karena itu diimpor dari
 * ekspor Journal, bukan diketik ulang.
 */
function baca(teks) {
  const baris = teks.split("\n").map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const b of baris) {
    // Pemisah TITIK KOMA atau tab saja — bukan koma. Nama akun asli dari
    // Mekari kadang mengandung koma sendiri (mis. "Fuel, Toll and Parking"),
    // dan kalau koma juga dianggap pemisah, nama itu ikut terpotong jadi
    // dua kolom yang salah.
    const sel = b.split(/[;\t]/).map((s) => s.trim().replace(/^"|"$/g, ""));
    if (sel.length < 2) continue;
    const [kode, nama, grup, namaEn] = sel;
    if (!kode || /^(kode|code|account)/i.test(kode)) continue; // lewati baris judul
    out.push({ kode, nama, grup: grup || "", namaEn: namaEn || "" });
  }
  return out;
}

export default function Akun() {
  const { t } = useBahasa();
  const { akun, pengajuan } = useData();
  const pesan = usePesan();
  const [teks, setTeks] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const pratinjau = baca(teks);

  const dipakai = (kode) =>
    pengajuan.reduce((s, p) => s + (p.lines || []).filter((l) => l.akun === kode).length, 0);

  async function impor() {
    setSibuk(true);
    try {
      const r = await panggil("master-action", { aksi: "imporAkun", akun: pratinjau });
      pesan(r.pesan); setTeks("");
    } catch (e) { pesan(e.message, "bad"); }
    finally { setSibuk(false); }
  }

  async function ganti(kode, aktif) {
    try { const r = await panggil("master-action", { aksi: "aktifkanAkun", kode, aktif }); pesan(r.pesan); }
    catch (e) { pesan(e.message, "bad"); }
  }

  return (
    <>
      <KepalaHalaman judul={t("nAkun")} lede={t("akunLede")} />
      <Catatan nada="warn">{t("akunPeringatan")}</Catatan>

      <Bagian judul={t("akunImpor")} sub={t("akunImporPetunjuk")}>
        <div className="kartu p-4 grid gap-3.5">
          <Isian label="CSV" htmlFor="csv"
            hint="Urutan kolom: kode, nama, kelompok, nama Inggris (opsional). Pemisah titik koma atau tab (bukan koma — supaya nama akun yang mengandung koma tidak ikut terpotong).">
            <textarea id="csv" rows={6} value={teks} onChange={(e) => setTeks(e.target.value)}
              className="inp font-mono text-[12.5px] resize-y"
              placeholder={"6-1001; Beban Perjalanan Dinas; Beban Operasional\n6-1101; Beban ATK; Beban Kantor"} />
          </Isian>
          {pratinjau.length > 0 && (
            <div className="hint">{pratinjau.length} baris terbaca. Baris pertama: <span className="chip">
              {pratinjau[0].kode} · {pratinjau[0].nama}</span></div>
          )}
          <div>
            <button className="btn btn-utama" onClick={impor} disabled={sibuk || pratinjau.length === 0}>
              {sibuk ? "…" : `${t("akunImpor")} (${pratinjau.length})`}
            </button>
          </div>
        </div>
      </Bagian>

      <Bagian judul={t("nAkun")}>
        <Tabel kolom={[{ t: t("akunKode") }, { t: t("akunNama") }, { t: t("akunKelompok") },
          { t: t("akunDipakai"), num: true }, { t: "" }]}>
          {akun.map((a) => (
            <tr key={a.id}>
              <td><span className="kode">{a.id}</span></td>
              <td>{a.nama}{a.namaEn && a.namaEn !== a.nama && <div className="hint">{a.namaEn}</div>}</td>
              <td>{a.grup || "—"}</td>
              <td className="num">{dipakai(a.id)}</td>
              <td>
                {a.aktif !== false
                  ? <button className="btn btn-kecil btn-samar" onClick={() => ganti(a.id, false)}>
                    <Pil nada="ok">{t("aktif")}</Pil></button>
                  : <button className="btn btn-kecil btn-samar" onClick={() => ganti(a.id, true)}>
                    <Pil nada="muted">{t("nonaktif")}</Pil></button>}
              </td>
            </tr>
          ))}
        </Tabel>
      </Bagian>
    </>
  );
}