import { Routes, Route, Navigate } from "react-router-dom";
import { PenyediaSesi, useSesi, ADMIN, LUAS } from "./auth/useAuth.jsx";
import { PenyediaData, useData } from "./lib/store.jsx";
import { PenyediaPesan, Memuat, Catatan } from "./components/ui.jsx";
import Shell, { pulihkanTema } from "./components/Shell.jsx";
import { useBahasa } from "./lib/i18n.jsx";

import Login from "./pages/Login.jsx";
import Beranda from "./pages/Beranda.jsx";
import Reimburse from "./pages/Reimburse.jsx";
import ReimburseBaru from "./pages/ReimburseBaru.jsx";
import ReimburseDetail from "./pages/ReimburseDetail.jsx";
import Permintaan from "./pages/Permintaan.jsx";
import PermintaanDetail from "./pages/PermintaanDetail.jsx";
import DokumenTerbit from "./pages/DokumenTerbit.jsx";
import DokumenDetail from "./pages/DokumenDetail.jsx";
import Terbitkan from "./pages/Terbitkan.jsx";
import Template from "./pages/Template.jsx";
import TemplateEdit from "./pages/TemplateEdit.jsx";
import Pihak from "./pages/Pihak.jsx";
import Akun from "./pages/Akun.jsx";
import Kebijakan from "./pages/Kebijakan.jsx";
import Pengguna from "./pages/Pengguna.jsx";
import Aturan from "./pages/Aturan.jsx";
import Asumsi from "./pages/Asumsi.jsx";
import Pembayaran from "./pages/Pembayaran.jsx";
import ReimburseRekap from "./pages/ReimburseRekap.jsx";
import ArsipInvoice from "./pages/ArsipInvoice.jsx";

pulihkanTema();

/** Halaman yang cuma untuk superadmin/owner. */
function HanyaAdmin({ children }) {
  const { peran } = useSesi();
  const { t } = useBahasa();
  if (!ADMIN.includes(peran)) {
    return (
      <Catatan nada="bad">
        {t("belumDibuat")} — halaman ini hanya untuk Superadmin dan Owner.
        Kalau peranmu seharusnya berbeda, minta superadmin mengubahnya di menu Pengguna &amp; peran.
      </Catatan>
    );
  }
  return children;
}

/** Halaman yang butuh visibilitas penuh reimburse: superadmin/owner/director/finance. */
function HanyaLuas({ children }) {
  const { peran } = useSesi();
  const { t } = useBahasa();
  if (!LUAS.includes(peran)) {
    return (
      <Catatan nada="bad">
        {t("belumDibuat")} — halaman ini hanya untuk Superadmin, Owner, Director, dan Finance.
        Kalau peranmu seharusnya berbeda, minta superadmin mengubahnya di menu Pengguna &amp; peran.
      </Catatan>
    );
  }
  return children;
}

/** Halaman yang cuma untuk superadmin — bukan Owner juga (beda dari HanyaAdmin
 * di atas). Dipakai untuk Arsip Invoice, karena itu yang diminta: "khusus
 * untuk superadmin". */
function HanyaSuperadmin({ children }) {
  const { peran } = useSesi();
  const { t } = useBahasa();
  if (peran !== "superadmin") {
    return (
      <Catatan nada="bad">
        {t("belumDibuat")} — halaman ini hanya untuk Superadmin.
        Kalau peranmu seharusnya berbeda, minta superadmin mengubahnya di menu Pengguna &amp; peran.
      </Catatan>
    );
  }
  return children;
}

function Isi() {
  const { memuat, akun, profil, konfigLengkap } = useSesi();
  const { t } = useBahasa();

  if (!konfigLengkap) {
    return (
      <div className="max-w-xl mx-auto p-6 mt-16">
        <Catatan nada="bad">{t("loginKonfigKurang")}</Catatan>
      </div>
    );
  }
  if (memuat) return <Memuat teks={t("memuat")} />;
  if (!akun || !profil) return <Login />;

  return (
    <PenyediaData>
      <PenjagaData />
    </PenyediaData>
  );
}

function PenjagaData() {
  const { semuaSiap, galatIzin } = useData();
  const { t } = useBahasa();

  if (galatIzin === "permission-denied") {
    return (
      <div className="max-w-2xl mx-auto p-6 mt-16">
        <Catatan nada="bad">
          <b>Firestore menolak permintaan baca.</b>
          <div className="mt-2">
            Aturan keamanannya kemungkinan belum terpasang. Buka Firebase Console → Firestore Database →
            Rules, tempel isi berkas <code>firestore.rules</code> dari repo, lalu tekan Publish.
          </div>
        </Catatan>
      </div>
    );
  }
  if (!semuaSiap) return <Memuat teks={t("memuat")} />;

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Beranda />} />

        <Route path="/reimburse" element={<Reimburse />} />
        <Route path="/reimburse/baru" element={<ReimburseBaru />} />
        <Route path="/reimburse/:no" element={<ReimburseDetail />} />

        <Route path="/permintaan" element={<Permintaan />} />
        <Route path="/permintaan/:no" element={<PermintaanDetail />} />

        <Route path="/dokumen" element={<DokumenTerbit />} />
        <Route path="/dokumen/terbitkan" element={<HanyaAdmin><Terbitkan /></HanyaAdmin>} />
        <Route path="/dokumen/:slug" element={<DokumenDetail />} />

        <Route path="/aturan" element={<Aturan />} />
        <Route path="/asumsi" element={<Asumsi />} />

        <Route path="/pembayaran" element={<HanyaLuas><Pembayaran /></HanyaLuas>} />
        <Route path="/reimburse-rekap" element={<HanyaLuas><ReimburseRekap /></HanyaLuas>} />

        <Route path="/setelan/template" element={<HanyaAdmin><Template /></HanyaAdmin>} />
        <Route path="/setelan/template/:tid" element={<HanyaAdmin><TemplateEdit /></HanyaAdmin>} />
        <Route path="/setelan/pihak" element={<HanyaAdmin><Pihak /></HanyaAdmin>} />
        <Route path="/setelan/akun" element={<HanyaAdmin><Akun /></HanyaAdmin>} />
        <Route path="/setelan/kebijakan" element={<HanyaAdmin><Kebijakan /></HanyaAdmin>} />
        <Route path="/setelan/pengguna" element={<HanyaAdmin><Pengguna /></HanyaAdmin>} />
        <Route path="/setelan/arsip-invoice" element={<HanyaSuperadmin><ArsipInvoice /></HanyaSuperadmin>} />

        {/* Alamat lama tetap hidup. Tautan yang pernah dikirim lewat WA
            tidak boleh mati hanya karena menunya dirapikan. */}
        <Route path="/terbit" element={<Navigate to="/dokumen" replace />} />
        <Route path="/template" element={<Navigate to="/setelan/template" replace />} />
        <Route path="/pengguna" element={<Navigate to="/setelan/pengguna" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  return (
    <PenyediaPesan>
      <PenyediaSesi>
        <Isi />
      </PenyediaSesi>
    </PenyediaPesan>
  );
}