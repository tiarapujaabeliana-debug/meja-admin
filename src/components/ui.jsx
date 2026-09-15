/**
 * Komponen dasar. Semuanya mengambil warna dari kelas di index.css, yang
 * mengambil dari tailwind.config.js. Jangan menulis warna literal di sini.
 */
import { useEffect, useState, useRef, createContext, useContext, useCallback } from "react";
import { createPortal } from "react-dom";

/* ---------- pil status ---------- */
export function Pil({ nada = "muted", children, besar }) {
  return (
    <span className={`pil pil-${nada} ${besar ? "text-[12.5px] px-3 py-1" : ""}`}>{children}</span>
  );
}

/* ---------- kartu & tata letak ---------- */
export const Kartu = ({ children, className = "", ...p }) => (
  <div className={`kartu ${className}`} {...p}>{children}</div>
);
export const KartuIsi = ({ children, className = "" }) => (
  <div className={`kartu p-4 ${className}`}>{children}</div>
);

export function KepalaHalaman({ eyebrow, judul, kanan, lede }) {
  return (
    <div className="mb-5">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="min-w-0">
          {eyebrow && <div className="lbl mb-0.5">{eyebrow}</div>}
          <h1 className="text-[23px] font-extrabold tracking-tight">{judul}</h1>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">{kanan}</div>
      </div>
      {lede && <p className="mt-2 max-w-[65ch] text-[13.5px] text-ink-2 dark:text-ink-dark-2">{lede}</p>}
    </div>
  );
}

export const Bagian = ({ judul, sub, children, kanan }) => (
  <section className="mt-7">
    {judul && (
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h2 className="text-[15px] font-bold">{judul}</h2>
        <div className="ml-auto">{kanan}</div>
      </div>
    )}
    {sub && <p className="mb-3 max-w-[65ch] text-[12.5px] text-ink-2 dark:text-ink-dark-2">{sub}</p>}
    {children}
  </section>
);

/* ---------- catatan / peringatan ---------- */
export function Catatan({ nada, children, html }) {
  const k = nada === "warn" ? "catatan catatan-warn" : nada === "bad" ? "catatan catatan-bad" : "catatan";
  if (html) return <div className={k} dangerouslySetInnerHTML={{ __html: html }} />;
  return <div className={k}>{children}</div>;
}

/* ---------- keadaan kosong yang mengajari langkah berikutnya ---------- */
export const Kosong = ({ judul, sub, aksi }) => (
  <div className="kartu py-10 px-5 text-center">
    <h3 className="text-[14.5px] font-bold mb-1.5">{judul}</h3>
    {sub && <p className="hint max-w-[46ch] mx-auto">{sub}</p>}
    {aksi && <div className="mt-4 flex justify-center">{aksi}</div>}
  </div>
);

/* ---------- angka besar ---------- */
export const Statistik = ({ n, l }) => (
  <div className="kartu p-4 flex flex-col gap-0.5">
    <span className="font-display text-[25px] font-extrabold tracking-tight tabular-nums leading-tight">{n}</span>
    <span className="text-[11.5px] font-semibold text-ink-3 dark:text-ink-dark-3">{l}</span>
  </div>
);

/* ---------- isian ---------- */
export function Isian({ label, wajib, hint, salah, children, htmlFor }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="lbl" htmlFor={htmlFor}>
          {label} {wajib && <span className="text-bad dark:text-bad-dark font-extrabold">*</span>}
        </label>
      )}
      {children}
      {hint && <span className="hint">{hint}</span>}
      {salah && <span className="text-[11.5px] text-bad dark:text-bad-dark">{salah}</span>}
    </div>
  );
}

/* ---------- pencarian & pilihan (combobox) ----------
   Dipakai untuk daftar yang panjang (akun jurnal, rekening tujuan) supaya
   orang bisa MENGETIK untuk mencari, bukan scroll satu-satu. Daftarnya
   digambar lewat portal ke <body> dan diposisikan "fixed" mengikuti kotak
   isiannya — supaya tidak terpotong kalau kotaknya ada di dalam tabel yang
   bisa di-scroll (overflow-x-auto pada .tabel-bungkus akan memotong
   dropdown yang absolute biasa). */
export function Kombo({ opsi, nilai, onPilih, placeholder, kosong = "Tidak ada yang cocok.", salah }) {
  const [buka, setBuka] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState(null);
  const bungkusRef = useRef(null);
  const inputRef = useRef(null);

  const bukaDaftar = () => {
    const r = inputRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    setQ(""); setBuka(true);
  };

  useEffect(() => {
    if (!buka) return;
    const diLuar = (e) =>
      !bungkusRef.current?.contains(e.target) && !e.target.closest?.("[data-kombo-daftar]");
    const tutupSaja = () => setBuka(false);
    document.addEventListener("mousedown", diLuar);
    window.addEventListener("scroll", tutupSaja, true);
    window.addEventListener("resize", tutupSaja);
    return () => {
      document.removeEventListener("mousedown", diLuar);
      window.removeEventListener("scroll", tutupSaja, true);
      window.removeEventListener("resize", tutupSaja);
    };
  }, [buka]);

  const terpilih = opsi.find((o) => o.nilai === nilai);
  const kunci = q.trim().toLowerCase();
  const cocok = kunci
    ? opsi.filter((o) => (o.label + " " + (o.sub || "")).toLowerCase().includes(kunci))
    : opsi;

  return (
    <div ref={bungkusRef} className="relative">
      <input ref={inputRef} className={`inp ${salah ? "inp-salah" : ""}`} placeholder={placeholder}
        value={buka ? q : (terpilih ? terpilih.label : "")}
        onFocus={bukaDaftar}
        onClick={bukaDaftar}
        onChange={(e) => { setQ(e.target.value); if (!buka) setBuka(true); }} />
      {buka && pos && createPortal(
        <div data-kombo-daftar
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
          className="z-[70] max-h-64 overflow-auto rounded-lg border border-line dark:border-line-dark
            bg-surface dark:bg-surface-dark shadow-xl">
          {cocok.length === 0 ? (
            <div className="px-3 py-2 text-[12.5px] hint">{kosong}</div>
          ) : cocok.map((o) => (
            <button key={o.nilai} type="button"
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-surface-2 dark:hover:bg-surface-dark-2"
              onClick={() => { onPilih(o.nilai); setBuka(false); setQ(""); }}>
              <div className="font-medium">{o.label}</div>
              {o.sub && <div className="hint">{o.sub}</div>}
            </button>
          ))}
        </div>, document.body)}
    </div>
  );
}

/* ---------- daftar kunci-nilai ---------- */
export const Kv = ({ children }) => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[13px]">{children}</dl>
);
export const KvBaris = ({ k, children }) => (
  <>
    <dt className="lbl pt-0.5">{k}</dt>
    <dd className="m-0 min-w-0 break-words">{children}</dd>
  </>
);

/* ---------- modal ---------- */
export function Modal({ judul, anak, kaki, tutup, lebar = "max-w-lg" }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && tutup();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [tutup]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-5 bg-ink/55 dark:bg-black/70"
      onClick={(e) => e.target === e.currentTarget && tutup()}>
      <div role="dialog" aria-modal="true"
        className={`kartu w-full ${lebar} max-h-[88vh] overflow-auto shadow-xl`}>
        <h3 className="text-[16px] font-bold px-5 pt-5">{judul}</h3>
        <div className="px-5 py-4">{anak}</div>
        <div className="px-5 pb-5 flex gap-2 justify-end flex-wrap">{kaki}</div>
      </div>
    </div>
  );
}

/* ---------- modal alasan wajib ---------- */
export function ModalAlasan({ judul, tanya, keterangan, tombol, tutup, kirim, sibuk }) {
  const [teks, setTeks] = useState("");
  const [salah, setSalah] = useState(false);
  return (
    <Modal judul={judul} tutup={tutup}
      anak={
        <div className="flex flex-col gap-2">
          <Isian label={tanya} wajib hint={keterangan} salah={salah ? keterangan : null}>
            <textarea autoFocus rows={4} value={teks}
              onChange={(e) => { setTeks(e.target.value); setSalah(false); }}
              className={`inp resize-y ${salah ? "inp-salah" : ""}`} />
          </Isian>
        </div>
      }
      kaki={
        <>
          <button className="btn" onClick={tutup}>Batal</button>
          <button className="btn btn-bahaya" disabled={sibuk}
            onClick={() => { if (!teks.trim()) { setSalah(true); return; } kirim(teks.trim()); }}>
            {tombol}
          </button>
        </>
      } />
  );
}

/* ---------- toast ---------- */
const ToastCtx = createContext(() => {});
export const usePesan = () => useContext(ToastCtx);

export function PenyediaPesan({ children }) {
  const [antre, setAntre] = useState([]);
  const dorong = useCallback((teks, nada = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setAntre((a) => [...a, { id, teks, nada }]);
    setTimeout(() => setAntre((a) => a.filter((x) => x.id !== id)), nada === "bad" ? 9000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={dorong}>
      {children}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[60] flex flex-col gap-2 w-[min(560px,92vw)]">
        {antre.map((p) => (
          <div key={p.id} role="status"
            className={`rounded-xl px-4 py-3 text-[13px] font-medium shadow-lg border whitespace-pre-line
              ${p.nada === "bad"
                ? "bg-bad-soft text-bad border-bad dark:bg-bad-dark-soft dark:text-bad-dark dark:border-bad-dark"
                : "bg-ink text-ground border-ink dark:bg-surface-dark-3 dark:text-ink-dark dark:border-line-dark-strong"}`}>
            {p.teks}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- pemuat ---------- */
export const Memuat = ({ teks = "Memuat…" }) => (
  <div className="py-16 text-center text-ink-3 dark:text-ink-dark-3 text-[13px]">{teks}</div>
);

/* ---------- tabel ---------- */
export const Tabel = ({ kolom, children }) => (
  <div className="tabel-bungkus">
    <table className="tabel">
      <thead><tr>{kolom.map((k, i) => (
        <th key={i} className={k.num ? "text-right" : ""} style={k.lebar ? { minWidth: k.lebar } : undefined}>
          {k.t}
        </th>))}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

/* ---------- jejak audit ---------- */
export function Jejak({ baris, labelStatus = (s) => s, labelAksi = (a) => a }) {
  if (!baris.length) return <p className="hint">Belum ada jejak.</p>;
  return (
    <div className="kartu p-4 flex flex-col">
      {baris.map((e, i) => (
        <div key={e.id || i}
          className={`grid md:grid-cols-[112px_1fr] gap-x-4 py-2.5 ${i ? "border-t border-line dark:border-line-dark" : ""}`}>
          <div className="font-mono text-[11px] text-ink-3 dark:text-ink-dark-3 leading-snug">{e.waktu}</div>
          <div className="text-[12.5px]">
            <b className="font-semibold">{e.aktorNama}</b> — {labelAksi(e.aksi)}
            {(e.dari || e.ke) && (
              <div className="font-mono text-[11.5px] text-ink-2 dark:text-ink-dark-2 mt-0.5">
                <s className="text-ink-3 dark:text-ink-dark-3">{labelStatus(e.dari)}</s> → {labelStatus(e.ke)}
              </div>
            )}
            {e.alasan && (
              <div className="font-mono text-[11.5px] text-ink-2 dark:text-ink-dark-2 mt-0.5">“{e.alasan}”</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
