import { useState } from "react";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import { useSesi } from "../auth/useAuth.jsx";
import {
  KepalaHalaman, Tabel, Pil, Modal, Isian, Catatan, usePesan, Bagian,
} from "../components/ui.jsx";
import { panggil } from "../lib/api.js";

const PERAN = ["pemohon", "superadmin", "director", "owner", "finance"];

export default function Pengguna() {
  const { t } = useBahasa();
  const { users } = useData();
  const { uid } = useSesi();
  const pesan = usePesan();
  const [edit, setEdit] = useState(null);
  const [sibuk, setSibuk] = useState(false);

  async function simpan() {
    setSibuk(true);
    try {
      const r = await panggil("master-action", {
        aksi: "simpanPengguna",
        uid: edit.uid, nama: edit.nama, email: edit.email,
        peran: edit.peran, job: edit.job, aktif: edit.aktif,
      });
      pesan(r.pesan); setEdit(null);
    } catch (e) { pesan(e.message, "bad"); }
    finally { setSibuk(false); }
  }

  return (
    <>
      <KepalaHalaman judul={t("nPengguna")} lede={t("pgLede")}
        kanan={<button className="btn btn-utama"
          onClick={() => setEdit({ uid: "", nama: "", email: "", job: "", peran: "pemohon", aktif: true, baru: true })}>
          + {t("pgTambah")}</button>} />

      {/* Batas yang diterima sadar ditulis di layar, bukan disembunyikan
          di dokumentasi. Orang yang datanya diproses di sini berhak tahu
          apa yang TIDAK dijaga sistem. */}
      <Catatan nada="warn" html={t("pgBatasSadar")} />

      <div className="mt-5">
        <Tabel kolom={[{ t: t("pgNama") }, { t: t("pgPekerjaan") },
          { t: t("pgPeran"), lebar: 150 }, { t: t("aktif") }, { t: "" }]}>
          {users.map((u) => {
            const aku = u.id === uid;
            return (
              <tr key={u.id}>
                <td>
                  {u.nama}{aku && <span className="chip ml-1.5">{t("pgKamu")}</span>}
                  <div className="hint">{u.email}</div>
                </td>
                <td className="text-ink-2 dark:text-ink-dark-2">{u.job || "—"}</td>
                <td>
                  <Pil nada={u.peran === "pemohon" ? "muted" : "info"}>{t("r_" + u.peran)}</Pil>
                  {aku && <div className="hint mt-1">{t("pgTakBisaSendiri")}</div>}
                </td>
                <td>{u.aktif === false ? <Pil nada="muted">{t("nonaktif")}</Pil> : <Pil nada="ok">{t("aktif")}</Pil>}</td>
                <td>
                  <button className="btn btn-kecil btn-samar"
                    onClick={() => setEdit({ uid: u.id, nama: u.nama || "", email: u.email || "",
                      job: u.job || "", peran: u.peran, aktif: u.aktif !== false, baru: false, aku })}>
                    {t("pUbah")}
                  </button>
                </td>
              </tr>
            );
          })}
        </Tabel>
      </div>

      <Bagian judul="Cara menambah orang">
        <ol className="list-decimal pl-5 text-[13px] text-ink-2 dark:text-ink-dark-2 max-w-[70ch] flex flex-col gap-1.5">
          <li>Buka Firebase Console → Authentication → Users → <b>Add user</b>, isi email dan kata sandi sementara.</li>
          <li>Salin <b>User UID</b> yang muncul di baris orang itu.</li>
          <li>Kembali ke sini, tekan “{t("pgTambah")}”, tempel UID-nya, isi nama dan peran.</li>
          <li>Beri tahu orangnya untuk masuk lalu mengganti kata sandi lewat “{t("loginLupa")}”.</li>
        </ol>
        <p className="hint mt-2 max-w-[70ch]">
          Aplikasi ini tidak membuat akun login sendiri. Alasannya: membuat akun berarti menyimpan atau
          mengirim kata sandi, dan tidak ada cara melakukan itu yang tidak menambah satu tempat lagi di
          mana kata sandi bisa bocor.
        </p>
      </Bagian>

      {edit && (
        <Modal judul={edit.baru ? t("pgTambah") : edit.nama} tutup={() => setEdit(null)}
          anak={
            <div className="grid gap-4">
              <Isian label={t("pgUid")} wajib hint={t("pgUidPetunjuk")}>
                <input className="inp font-mono text-[12.5px]" value={edit.uid} disabled={!edit.baru}
                  onChange={(e) => setEdit((x) => ({ ...x, uid: e.target.value.trim() }))} />
              </Isian>
              <Isian label={t("pgNama")} wajib>
                <input className="inp" value={edit.nama}
                  onChange={(e) => setEdit((x) => ({ ...x, nama: e.target.value }))} />
              </Isian>
              <Isian label={t("pgEmail")}>
                <input className="inp" type="email" value={edit.email}
                  onChange={(e) => setEdit((x) => ({ ...x, email: e.target.value }))} />
              </Isian>
              <Isian label={t("pgPekerjaan")}>
                <input className="inp" value={edit.job}
                  onChange={(e) => setEdit((x) => ({ ...x, job: e.target.value }))} />
              </Isian>
              <Isian label={t("pgPeran")} wajib
                salah={edit.aku ? t("pgTakBisaSendiri") : null}>
                <select className="inp" value={edit.peran} disabled={edit.aku}
                  onChange={(e) => setEdit((x) => ({ ...x, peran: e.target.value }))}>
                  {PERAN.map((p) => <option key={p} value={p}>{t("r_" + p)}</option>)}
                </select>
              </Isian>
              <label className="flex items-center gap-2 text-[13px] font-medium cursor-pointer">
                <input type="checkbox" checked={edit.aktif}
                  onChange={(e) => setEdit((x) => ({ ...x, aktif: e.target.checked }))} />
                {t("aktif")}
              </label>
            </div>
          }
          kaki={
            <>
              <button className="btn" onClick={() => setEdit(null)}>{t("batal")}</button>
              <button className="btn btn-utama" disabled={sibuk || !edit.uid.trim() || !edit.nama.trim()}
                onClick={simpan}>{sibuk ? "…" : t("simpan")}</button>
            </>
          } />
      )}
    </>
  );
}
