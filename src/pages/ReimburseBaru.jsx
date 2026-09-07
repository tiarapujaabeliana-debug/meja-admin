import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import {
  KepalaHalaman, Bagian, Isian, Catatan, usePesan,
} from "../components/ui.jsx";
import { rupiah } from "../lib/format.js";
import { ambangBerlaku, validasiPengajuan } from "../lib/reimburseMeta.js";
import { dokumenBebas } from "../lib/dokumenMeta.js";
import { panggil, ApiGagal } from "../lib/api.js";
import { supabase, BUCKET, SUPABASE_SIAP } from "../lib/supabase.js";

const barisKosong = () => ({ desc: "", akun: "", qty: 1, unit: "pcs", harga: 0, file: "", fileNama: "" });

export default function ReimburseBaru() {
  const { t } = useBahasa();
  const { akun, dokumen, ambang } = useData();
  const pesan = usePesan();
  const nav = useNavigate();

  const [keperluan, setKeperluan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [dokDasar, setDokDasar] = useState("");
  const [lines, setLines] = useState([barisKosong()]);
  const [salah, setSalah] = useState([]);
  const [sibuk, setSibuk] = useState(false);
  const [unggah, setUnggah] = useState({});

  const akunAktif = akun.filter((a) => a.aktif !== false);
  const bebas = dokumenBebas(dokumen);
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.harga) || 0), 0);
  const ambangKini = ambangBerlaku(ambang, new Date().toISOString().slice(0, 10));
  const lewat = ambangKini && total > Number(ambangKini.nilai);

  const ubahBaris = (i, k, v) =>
    setLines((L) => L.map((b, j) => (j === i ? { ...b, [k]: v } : b)));

  /* Unggah langsung ke Supabase lewat tautan bertanda tangan yang dibuat
     server. Berkasnya tidak pernah melewati Netlify Function — itu batas
     10 MB-nya sendiri dan akan gagal untuk foto nota dari HP. */
  async function pilihBerkas(i, file) {
    if (!file) return;
    if (!SUPABASE_SIAP) {
      pesan("Konfigurasi Supabase belum diisi (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). " +
        "Lampiran belum bisa diunggah sampai itu diisi di Netlify.", "bad");
      return;
    }
    setUnggah((u) => ({ ...u, [i]: true }));
    try {
      const izin = await panggil("lampiran-url", { aksi: "unggah", nama: file.name, ukuran: file.size });
      const { error } = await supabase.storage.from(BUCKET)
        .uploadToSignedUrl(izin.jalur, izin.token, file);
      if (error) throw new Error(error.message);
      ubahBaris(i, "file", izin.jalur);
      ubahBaris(i, "fileNama", file.name);
    } catch (e) {
      pesan(e instanceof ApiGagal ? e.message : "Gagal mengunggah lampiran: " + e.message, "bad");
    } finally {
      setUnggah((u) => ({ ...u, [i]: false }));
    }
  }

  const pesanSalah = {
    keperluan: () => t("e_keperluan"),
    noline: () => t("e_noline"),
    desc: (e) => t("e_desc", { "%n": e.n }),
    akun: (e) => t("e_akun", { "%n": e.n }),
    akunAsing: (e) => t("e_akunAsing", { "%n": e.n, "%v": e.v }),
    qty: (e) => t("e_qty", { "%n": e.n }),
    harga: (e) => t("e_harga", { "%n": e.n }),
    file: (e) => t("e_file", { "%n": e.n }),
  };

  async function kirim() {
    const draft = { keperluan, catatan, dokumen: dokDasar || null, lines };
    // Divalidasi di layar dulu supaya orang tidak menunggu perjalanan ke
    // server untuk tahu kolom mana yang kosong. Server memvalidasi ulang
    // dengan fungsi yang sama — layar tidak pernah jadi satu-satunya penjaga.
    const e = validasiPengajuan(draft, akunAktif.map((a) => a.id));
    setSalah(e);
    if (e.length) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }

    setSibuk(true);
    try {
      const r = await panggil("reimburse-action", { aksi: "buat", draft });
      pesan(t("okKirim"));
      nav(`/reimburse/${r.no}`);
    } catch (err) {
      pesan(err.message, "bad");
    } finally { setSibuk(false); }
  }

  return (
    <>
      <KepalaHalaman judul={t("rbBaru")} lede={t("rbLede")}
        kanan={<Link className="btn" to="/reimburse">{t("batal")}</Link>} />

      {salah.length > 0 && (
        <div className="mb-4">
          <Catatan nada="bad">
            <b>{t("fSalahHead")}</b>
            <ul className="mt-1.5 pl-5 list-disc">
              {salah.map((e, i) => <li key={i}>{(pesanSalah[e.k] || (() => e.k))(e)}</li>)}
            </ul>
          </Catatan>
        </div>
      )}

      <div className="kartu p-4 grid gap-4">
        <Isian label={t("rbKeperluan")} wajib hint={t("fKeperluanHint") || undefined} htmlFor="kp">
          <input id="kp" className="inp" value={keperluan} onChange={(e) => setKeperluan(e.target.value)} />
        </Isian>
        <Isian label={t("fCatatan")} htmlFor="ct">
          <textarea id="ct" rows={2} className="inp resize-y" value={catatan}
            onChange={(e) => setCatatan(e.target.value)} />
        </Isian>
        <Isian label={t("fDokDasar")} hint={t("fDokPetunjuk")} htmlFor="dd">
          <select id="dd" className="inp" value={dokDasar} onChange={(e) => setDokDasar(e.target.value)}>
            <option value="">{t("fDokKosong")}</option>
            {bebas.map((d) => (
              <option key={d.nomor} value={d.nomor}>{d.nomor} — {d.perihal}</option>
            ))}
          </select>
        </Isian>
      </div>

      <Bagian judul={t("fRincian")}>
        <div className="tabel-bungkus">
          <table className="tabel">
            <thead><tr>
              <th style={{ minWidth: 180 }}>{t("kDesk")} *</th>
              <th style={{ minWidth: 200 }}>{t("kAkun")} *</th>
              <th style={{ width: 76 }}>{t("kQty")} *</th>
              <th style={{ width: 88 }}>{t("kSatuan")}</th>
              <th style={{ width: 126 }}>{t("kHarga")} *</th>
              <th className="text-right" style={{ width: 116 }}>{t("kSubtotal")}</th>
              <th style={{ minWidth: 150 }}>{t("kLampiran")} *</th>
              <th style={{ width: 38 }} />
            </tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td><input className="inp" value={l.desc} onChange={(e) => ubahBaris(i, "desc", e.target.value)} /></td>
                  <td>
                    <select className="inp" value={l.akun} onChange={(e) => ubahBaris(i, "akun", e.target.value)}>
                      <option value="">{t("pilihAkun")}</option>
                      {akunAktif.map((a) => <option key={a.id} value={a.id}>{a.id} · {a.nama}</option>)}
                    </select>
                  </td>
                  <td><input type="number" min="0" className="inp" value={l.qty}
                    onChange={(e) => ubahBaris(i, "qty", e.target.value)} /></td>
                  <td><input className="inp" value={l.unit} onChange={(e) => ubahBaris(i, "unit", e.target.value)} /></td>
                  <td><input type="number" min="0" step="1000" className="inp" value={l.harga}
                    onChange={(e) => ubahBaris(i, "harga", e.target.value)} /></td>
                  <td className="num">{rupiah((Number(l.qty) || 0) * (Number(l.harga) || 0))}</td>
                  <td>
                    {l.file ? <span className="chip">{l.fileNama || "terlampir"}</span>
                      : unggah[i] ? <span className="hint">{t("mengunggah")}</span>
                        : <label className="btn btn-kecil cursor-pointer">
                          {t("pilihBerkas")}
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
                            onChange={(e) => pilihBerkas(i, e.target.files?.[0])} />
                        </label>}
                  </td>
                  <td>
                    <button className="btn btn-kecil btn-samar" aria-label={t("kHapus")}
                      onClick={() => setLines((L) => L.filter((_, j) => j !== i))}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <button className="btn" onClick={() => setLines((L) => [...L, barisKosong()])}>
            + {t("fTambahBaris")}
          </button>
        </div>
      </Bagian>

      <div className="kartu p-4 mt-7 flex gap-6 flex-wrap items-end">
        <div className="flex flex-col">
          <span className="font-display text-[25px] font-extrabold tabular-nums leading-tight">{rupiah(total)}</span>
          <span className="text-[11.5px] font-semibold text-ink-3 dark:text-ink-dark-3">{t("fTotalPengajuan")}</span>
        </div>
        <div>
          <div className="lbl">{t("fJalur")}</div>
          <div className="font-semibold mt-0.5 text-[13px]">{lewat ? t("jalur3") : t("jalur2")}</div>
          <div className="hint">
            {ambangKini
              ? (lewat ? t("jalurKenapa", { "%a": rupiah(ambangKini.nilai) })
                : t("jalurKenapa2", { "%a": rupiah(ambangKini.nilai) }))
              : "Ambang belum diisi di menu Ambang & periode."}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Link className="btn" to="/reimburse">{t("batal")}</Link>
          <button className="btn btn-utama" onClick={kirim} disabled={sibuk}>
            {sibuk ? "…" : t("fKirim")}
          </button>
        </div>
      </div>

      <div className="mt-4"><Catatan>{t("tanpaKolomTanggal")}</Catatan></div>
    </>
  );
}
