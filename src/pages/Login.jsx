import { useState } from "react";
import { useSesi } from "../auth/useAuth.jsx";
import { useBahasa } from "../lib/i18n.jsx";
import { Isian, Catatan } from "../components/ui.jsx";

export default function Login() {
  const { masuk, resetSandi, akun, profil, keluar } = useSesi();
  const { t, lang, setLang } = useBahasa();
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [pesan, setPesan] = useState(null);
  const [nada, setNada] = useState("bad");
  const [sibuk, setSibuk] = useState(false);

  // Sudah lolos login Firebase, tapi belum punya dokumen users/{uid}.
  // Dibedakan dari "password salah" dengan sengaja — obatnya berbeda:
  // yang ini bukan salah ketik, tapi belum didaftarkan.
  const masukTapiBelumTerdaftar = akun && profil === null;

  async function kirim(e) {
    e.preventDefault();
    setPesan(null); setSibuk(true);
    try {
      await masuk(email.trim(), sandi);
    } catch (err) {
      const k = err?.code || "";
      setNada("bad");
      if (k.includes("too-many-requests")) {
        setPesan("Terlalu banyak percobaan. Tunggu beberapa menit, atau pakai “Lupa kata sandi?”.");
      } else if (k.includes("network")) {
        setPesan("Tidak bisa menghubungi server. Periksa koneksi internetmu.");
      } else {
        setPesan(t("loginSalah"));
      }
    } finally { setSibuk(false); }
  }

  async function reset() {
    if (!email.trim()) { setNada("bad"); setPesan("Isi dulu kolom email, baru tekan ini."); return; }
    try {
      await resetSandi(email.trim());
      setNada("ok"); setPesan(t("loginResetTerkirim", { "%e": email.trim() }));
    } catch {
      setNada("bad"); setPesan("Gagal mengirim tautan. Periksa lagi alamat emailnya.");
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 py-10 bg-ground dark:bg-ground-dark">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-lg bg-frost dark:bg-frost-dark text-white dark:text-ground-dark
            grid place-items-center font-display font-extrabold">MA</div>
          <div>
            <div className="font-display font-extrabold text-[17px] tracking-tight">Meja Admin</div>
            <div className="hint">Reimburse &amp; dokumen</div>
          </div>
          <div className="ml-auto flex rounded-lg p-0.5 border border-line dark:border-line-dark
            bg-surface-2 dark:bg-surface-dark-2">
            {["id", "en"].map((l) => (
              <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
                className={`px-2 py-0.5 rounded text-[11.5px] font-semibold ${lang === l
                  ? "bg-surface dark:bg-surface-dark" : "text-ink-3 dark:text-ink-dark-3"}`}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {masukTapiBelumTerdaftar ? (
          <div className="kartu p-5 flex flex-col gap-4">
            <Catatan nada="warn">{t("loginBelumTerdaftar")}</Catatan>
            <p className="hint">
              UID akunmu: <code className="chip">{akun.uid}</code><br />
              Sebutkan UID ini ke superadmin — itu yang dia butuhkan untuk menambahkanmu.
            </p>
            <button className="btn" onClick={keluar}>{t("keluar")}</button>
          </div>
        ) : (
          <form onSubmit={kirim} className="kartu p-5 flex flex-col gap-4">
            <h1 className="text-[17px] font-bold">{t("loginJudul")}</h1>
            <Isian label={t("loginEmail")} htmlFor="em">
              <input id="em" type="email" autoComplete="username" className="inp"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Isian>
            <Isian label={t("loginSandi")} htmlFor="pw">
              <input id="pw" type="password" autoComplete="current-password" className="inp"
                value={sandi} onChange={(e) => setSandi(e.target.value)} required />
            </Isian>
            {pesan && <Catatan nada={nada === "ok" ? undefined : "bad"}>{pesan}</Catatan>}
            <button className="btn btn-utama justify-center" disabled={sibuk}>
              {sibuk ? "…" : t("masuk")}
            </button>
            <button type="button" onClick={reset}
              className="text-[12.5px] underline underline-offset-2 text-ink-2 dark:text-ink-dark-2">
              {t("loginLupa")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
