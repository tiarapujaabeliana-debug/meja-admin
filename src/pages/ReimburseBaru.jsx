import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import {
  KepalaHalaman, Bagian, Isian, Catatan, Kombo, usePesan,
} from "../components/ui.jsx";
import { rupiah } from "../lib/format.js";
import { ambangBerlaku, validasiPengajuan, JENIS_VENDOR } from "../lib/reimburseMeta.js";
import { panggil, ApiGagal } from "../lib/api.js";
import { supabase, BUCKET, SUPABASE_SIAP } from "../lib/supabase.js";

const barisKosong = () => ({ desc: "", akun: "", qty: 1, unit: "pcs", harga: 0 });
const rekeningKosong = () => ({ jenisVendor: "karyawan", nama: "", bank: "", norek: "" });

export default function ReimburseBaru() {
  const { t } = useBahasa();
  const { akun, ambang, rekeningTujuan } = useData();
  const pesan = usePesan();
  const nav = useNavigate();

  const [keperluan, setKeperluan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [noInvoice, setNoInvoice] = useState("");
  const [tanggalInvoice, setTanggalInvoice] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState([barisKosong()]);
  const [salah, setSalah] = useState([]);
  const [sibuk, setSibuk] = useState(false);

  // Lampiran boleh lebih dari satu berkas untuk satu pengajuan.
  const [lampiranList, setLampiranList] = useState([]);
  const [mengunggah, setMengunggah] = useState(false);

  // Rekening tujuan: pilih dari daftar yang sudah pernah diinput siapa pun
  // (supaya tidak ketik ulang), atau isi rekening baru.
  const [rekMode, setRekMode] = useState("pilih"); // "pilih" | "baru"
  const [rekPilih, setRekPilih] = useState("");
  const [rekBaru, setRekBaru] = useState(rekeningKosong());

  const akunAktif = akun.filter((a) => a.aktif !== false);
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.harga) || 0), 0);
  const ambangKini = ambangBerlaku(ambang, new Date().toISOString().slice(0, 10));
  const lewat = ambangKini && total > Number(ambangKini.nilai);

  const ubahBaris = (i, k, v) =>
    setLines((L) => L.map((b, j) => (j === i ? { ...b, [k]: v } : b)));

  /* Lampiran diunggah langsung ke Supabase lewat tautan bertanda tangan
     yang dibuat server, satu per satu. Berkasnya tidak pernah melewati
     Netlify Function — itu batas 10 MB-nya sendiri dan akan gagal untuk
     foto nota dari HP atau scan .docx yang lumayan besar. */
  async function pilihLampiran(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (!SUPABASE_SIAP) {
      pesan("Konfigurasi Supabase belum diisi (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). " +
        "Lampiran belum bisa diunggah sampai itu diisi di Netlify.", "bad");
      return;
    }
    setMengunggah(true);
    try {
      for (const file of files) {
        const izin = await panggil("lampiran-url", { aksi: "unggah", nama: file.name, ukuran: file.size });
        const { error } = await supabase.storage.from(BUCKET)
          .uploadToSignedUrl(izin.jalur, izin.token, file);
        if (error) throw new Error(error.message);
        setLampiranList((L) => [...L, { jalur: izin.jalur, nama: file.name }]);
      }
    } catch (e) {
      pesan(e instanceof ApiGagal ? e.message : "Gagal mengunggah lampiran: " + e.message, "bad");
    } finally {
      setMengunggah(false);
    }
  }
  const hapusLampiran = (jalur) => setLampiranList((L) => L.filter((x) => x.jalur !== jalur));

  const opsiRekening = rekeningTujuan.map((r) => ({
    nilai: r.id, label: `${r.nama} · ${r.bank} · ${r.norek}`,
    sub: r.jenisVendor === "pihak_ketiga" ? t("rtPihakKetiga") : t("rtKaryawan"),
  }));
  const rekeningTerpilih = rekeningTujuan.find((r) => r.id === rekPilih) || null;
  const rekeningDikirim = rekMode === "pilih"
    ? (rekeningTerpilih
      ? { jenisVendor: rekeningTerpilih.jenisVendor, nama: rekeningTerpilih.nama,
        bank: rekeningTerpilih.bank, norek: rekeningTerpilih.norek }
      : null)
    : rekBaru;

  const pesanSalah = {
    keperluan: () => t("e_keperluan"),
    noline: () => t("e_noline"),
    desc: (e) => t("e_desc", { "%n": e.n }),
    akun: (e) => t("e_akun", { "%n": e.n }),
    akunAsing: (e) => t("e_akunAsing", { "%n": e.n, "%v": e.v }),
    qty: (e) => t("e_qty", { "%n": e.n }),
    harga: (e) => t("e_harga", { "%n": e.n }),
    lampiran: () => t("e_lampiran"),
    tanggalInvoice: () => t("e_tanggalInvoice"),
    noInvoice: () => t("e_noInvoice"),
    rtJenis: () => t("e_rtJenis"),
    rtNama: () => t("e_rtNama"),
    rtBank: () => t("e_rtBank"),
    rtNorek: () => t("e_rtNorek"),
  };

  async function kirim() {
    const draft = {
      keperluan, catatan, lines, tanggalInvoice,
      noInvoice: noInvoice.trim() || null,
      lampiranList,
      rekeningTujuan: rekeningDikirim || {},
    };
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
        <Isian label={t("fTanggalInvoice")} wajib hint={t("fTanggalInvoiceHint")} htmlFor="ti">
          <input id="ti" type="date" className="inp" value={tanggalInvoice}
            onChange={(e) => setTanggalInvoice(e.target.value)} />
        </Isian>
        <Isian label={t("fDokDasar")} wajib hint={t("fDokPetunjuk")} htmlFor="dd">
          <input id="dd" className="inp" value={noInvoice} onChange={(e) => setNoInvoice(e.target.value)}
            placeholder={t("fDokKosong")} />
        </Isian>
      </div>

      <Bagian judul={t("fRincian")}>
        <div className="tabel-bungkus">
          <table className="tabel">
            <thead><tr>
              <th style={{ minWidth: 180 }}>{t("kDesk")} *</th>
              <th style={{ minWidth: 220 }}>{t("kAkun")} *</th>
              <th style={{ width: 76 }}>{t("kQty")} *</th>
              <th style={{ width: 88 }}>{t("kSatuan")}</th>
              <th style={{ width: 126 }}>{t("kHarga")} *</th>
              <th className="text-right" style={{ width: 116 }}>{t("kSubtotal")}</th>
              <th style={{ width: 38 }} />
            </tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td><input className="inp" value={l.desc} onChange={(e) => ubahBaris(i, "desc", e.target.value)} /></td>
                  <td>
                    <Kombo placeholder={t("pilihAkun")} nilai={l.akun}
                      onPilih={(v) => ubahBaris(i, "akun", v)}
                      opsi={akunAktif.map((a) => ({ nilai: a.id, label: `${a.id} · ${a.nama}` }))} />
                  </td>
                  <td><input type="number" min="0" className="inp" value={l.qty}
                    onChange={(e) => ubahBaris(i, "qty", e.target.value)} /></td>
                  <td><input className="inp" value={l.unit} onChange={(e) => ubahBaris(i, "unit", e.target.value)} /></td>
                  <td><input type="number" min="0" step="1000" className="inp" value={l.harga}
                    onChange={(e) => ubahBaris(i, "harga", e.target.value)} /></td>
                  <td className="num">{rupiah((Number(l.qty) || 0) * (Number(l.harga) || 0))}</td>
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

      <div className="kartu p-4 mt-5">
        <Isian label={t("kLampiran")} wajib hint={t("fLampiranHint")} htmlFor="lp">
          <div className="flex flex-col gap-2">
            {lampiranList.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {lampiranList.map((f) => (
                  <li key={f.jalur} className="flex items-center gap-2">
                    <span className="chip">{f.nama || "terlampir"}</span>
                    <button className="btn btn-kecil btn-samar" aria-label={t("kHapus")}
                      onClick={() => hapusLampiran(f.jalur)}>✕</button>
                  </li>
                ))}
              </ul>
            )}
            {mengunggah
              ? <span className="hint">{t("mengunggah")}</span>
              : <label className="btn btn-kecil cursor-pointer" style={{ display: "inline-flex", width: "fit-content" }}>
                + {t("pilihBerkas")}
                <input id="lp" type="file" multiple className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,.doc,.docx"
                  onChange={(e) => { pilihLampiran(e.target.files); e.target.value = ""; }} />
              </label>}
          </div>
        </Isian>
      </div>

      <Bagian judul={t("rtJudul")} sub={t("rtLede")}>
        <div className="kartu p-4 grid gap-4">
          <div className="flex gap-2">
            <button type="button"
              className={`btn btn-kecil ${rekMode === "pilih" ? "btn-utama" : ""}`}
              onClick={() => setRekMode("pilih")}>{t("rtPilihDaftar")}</button>
            <button type="button"
              className={`btn btn-kecil ${rekMode === "baru" ? "btn-utama" : ""}`}
              onClick={() => { setRekMode("baru"); setRekBaru(rekeningKosong()); }}>{t("rtTambahBaru")}</button>
          </div>

          {rekMode === "pilih" ? (
            <Isian label={t("rtCari")} hint={opsiRekening.length === 0 ? t("rtDaftarKosong") : undefined}>
              <Kombo placeholder={t("rtCariPlaceholder")} nilai={rekPilih} onPilih={setRekPilih}
                opsi={opsiRekening} kosong={t("rtTidakCocok")} />
            </Isian>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Isian label={t("rtJenisVendor")} wajib>
                <select className="inp" value={rekBaru.jenisVendor}
                  onChange={(e) => setRekBaru((x) => ({ ...x, jenisVendor: e.target.value }))}>
                  {JENIS_VENDOR.map((j) => <option key={j} value={j}>{j === "pihak_ketiga" ? t("rtPihakKetiga") : t("rtKaryawan")}</option>)}
                </select>
              </Isian>
              <Isian label={t("rtNama")} wajib>
                <input className="inp" value={rekBaru.nama}
                  onChange={(e) => setRekBaru((x) => ({ ...x, nama: e.target.value }))} />
              </Isian>
              <Isian label={t("rtBank")} wajib>
                <input className="inp" value={rekBaru.bank}
                  onChange={(e) => setRekBaru((x) => ({ ...x, bank: e.target.value }))} />
              </Isian>
              <Isian label={t("rtNorek")} wajib>
                <input className="inp" value={rekBaru.norek}
                  onChange={(e) => setRekBaru((x) => ({ ...x, norek: e.target.value }))} />
              </Isian>
            </div>
          )}
        </div>
      </Bagian>

      <div className="kartu p-4 mt-5 flex gap-6 flex-wrap items-end">
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
