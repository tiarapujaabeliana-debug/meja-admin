import { useState } from "react";
import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import {
  KepalaHalaman, Bagian, Tabel, Modal, Isian, Catatan, usePesan,
} from "../components/ui.jsx";
import { panggil } from "../lib/api.js";

const KOSONG_KARYAWAN = { nama: "", nik: "", jabatan: "", alamat: "" };
const KOSONG_VENDOR = { nama: "", npwp: "", pic: "", alamat: "" };

export default function Pihak() {
  const { t } = useBahasa();
  const { karyawan, vendor, dokumen } = useData();
  const pesan = usePesan();
  const [edit, setEdit] = useState(null);
  const [sibuk, setSibuk] = useState(false);

  const dipakai = (id) => dokumen.filter((d) => Object.values(d.nilai || {}).includes(id)).length;

  async function simpan() {
    setSibuk(true);
    try {
      const r = await panggil("master-action", { aksi: "simpanPihak", jenis: edit.jenis, data: edit.data });
      pesan(r.pesan); setEdit(null);
    } catch (e) { pesan(e.message, "bad"); }
    finally { setSibuk(false); }
  }

  return (
    <>
      <KepalaHalaman judul={t("nPihak")} lede={t("pihakLede")} />

      <Bagian judul={t("pKaryawan")}
        kanan={<button className="btn btn-kecil"
          onClick={() => setEdit({ jenis: "karyawan", data: { ...KOSONG_KARYAWAN } })}>
          + {t("pTambah")}</button>}>
        <Tabel kolom={[{ t: t("pNama") }, { t: t("pNik") }, { t: t("pJabatan") },
          { t: t("pAlamat") }, { t: t("akunDipakai"), num: true }, { t: "" }]}>
          {karyawan.map((k) => (
            <tr key={k.id}>
              <td>{k.nama}</td>
              <td className="kode">{k.nik || "—"}</td>
              <td>{k.jabatan || "—"}</td>
              <td className="text-ink-2 dark:text-ink-dark-2">{k.alamat || "—"}</td>
              <td className="num">{dipakai(k.id)}</td>
              <td><button className="btn btn-kecil btn-samar"
                onClick={() => setEdit({ jenis: "karyawan", data: { id: k.id, ...k } })}>{t("pUbah")}</button></td>
            </tr>
          ))}
        </Tabel>
      </Bagian>

      <Bagian judul={t("pVendor")}
        kanan={<button className="btn btn-kecil"
          onClick={() => setEdit({ jenis: "vendor", data: { ...KOSONG_VENDOR } })}>
          + {t("pTambah")}</button>}>
        <Tabel kolom={[{ t: t("pNama") }, { t: t("pNpwp") }, { t: t("pPic") },
          { t: t("pAlamat") }, { t: t("akunDipakai"), num: true }, { t: "" }]}>
          {vendor.map((v) => (
            <tr key={v.id}>
              <td>{v.nama}</td>
              <td className="kode">{v.npwp || "—"}</td>
              <td>{v.pic || "—"}</td>
              <td className="text-ink-2 dark:text-ink-dark-2">{v.alamat || "—"}</td>
              <td className="num">{dipakai(v.id)}</td>
              <td><button className="btn btn-kecil btn-samar"
                onClick={() => setEdit({ jenis: "vendor", data: { id: v.id, ...v } })}>{t("pUbah")}</button></td>
            </tr>
          ))}
        </Tabel>
      </Bagian>

      <div className="mt-5"><Catatan>{t("pihakCatatan")}</Catatan></div>

      {edit && (
        <Modal judul={edit.jenis === "karyawan" ? t("pKaryawan") : t("pVendor")} tutup={() => setEdit(null)}
          anak={
            <div className="grid gap-4">
              {(edit.jenis === "karyawan"
                ? [["nama", t("pNama"), true], ["nik", t("pNik")], ["jabatan", t("pJabatan")], ["alamat", t("pAlamat")]]
                : [["nama", t("pNama"), true], ["npwp", t("pNpwp")], ["pic", t("pPic")], ["alamat", t("pAlamat")]]
              ).map(([k, label, wajib]) => (
                <Isian key={k} label={label} wajib={wajib}>
                  <input className="inp" value={edit.data[k] || ""}
                    onChange={(e) => setEdit((x) => ({ ...x, data: { ...x.data, [k]: e.target.value } }))} />
                </Isian>
              ))}
            </div>
          }
          kaki={
            <>
              <button className="btn" onClick={() => setEdit(null)}>{t("batal")}</button>
              <button className="btn btn-utama" disabled={sibuk || !edit.data.nama?.trim()} onClick={simpan}>
                {sibuk ? "…" : t("simpan")}
              </button>
            </>
          } />
      )}
    </>
  );
}
