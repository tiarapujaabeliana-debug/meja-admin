import { useBahasa } from "../lib/i18n.jsx";
import { KepalaHalaman, Tabel, Catatan } from "../components/ui.jsx";

/**
 * Asumsi ditulis di layar, bukan cuma di dokumen serah terima.
 *
 * Selama sebuah hal masih ada di halaman ini, dia asumsi — bukan
 * keputusan. Halaman ini juga yang dipakai Sony sebagai daftar pertanyaan
 * lanjutan ke Abeliana.
 */
const ID = [
  ["Cut-off periode", "Tanggal 26 sampai 25, dilabeli bulan tempat periode berakhir.",
    "Formulir 6.3 dijawab “belum bisa dijawab, belum trial”. Kalau perusahaan memakai kalender biasa atau ikut tanggal gajian, seluruh label periode dan berkas ekspornya bergeser. Diubah di satu tempat: CUT_OFF di src/lib/reimburseMeta.js."],
  ["Ambang wajib Owner", "Diisi lewat menu Ambang & periode; belum ada nilai bawaan.",
    "Angkanya belum pernah disebut siapa pun. Sebelum diisi, semua pengajuan berhenti di Director."],
  ["Format nomor surat", "NNN/KODE/SM/BULAN-ROMAWI/TAHUN, urut per kode per tahun, reset tiap Januari.",
    "Kode “SM” dan aturan resetnya karangan kami. HARUS DIBERESKAN SEBELUM DOKUMEN PERTAMA TERBIT: kalau kantor sudah punya buku agenda surat berjalan, nomor pertama harus disetel dari nomor terakhir di buku itu lewat menu Ambang & periode — nomor yang sudah keluar tidak bisa ditarik kembali."],
  ["Revisi dokumen yang salah", "Dibatalkan dengan alasan, lalu diterbitkan ulang dengan nomor baru.",
    "Perlu dipastikan cocok dengan kebiasaan kantor. Sebagian kantor memakai nomor yang sama dengan tambahan “Rev.1”. Kalau begitu, aturannya beda dan harus diubah sebelum dipakai."],
  ["Bentuk berkas dokumen", "Unduhan berupa .docx.",
    "Dipilih supaya Abeliana masih bisa merapikan sebelum dicetak dan ditandatangani. Kalau yang dibutuhkan justru dokumen yang tidak bisa diubah setelah bernomor, gantinya PDF — dan itu mengubah cara dokumen ini dianggap sah."],
  ["Cara-cara gagal", "Baru tiga yang dipasang: dikembalikan, dibatalkan, dokumen dibatalkan.",
    "Formulir 4.3 dijawab “belum trial”. Sebelum dipakai sungguhan perlu tahu: pemohon yang keburu resign, invoice ganda, dan nominal yang berubah setelah disetujui."],
  ["Batas 3 hari", "Belum ada pengingat maupun penanda lewat waktu.",
    "Formulir 4.4 menyebut maksimal 3 hari. Perlu diputuskan: yang lewat ditandai merah saja, atau dikirim pengingat ke approver — dan ke siapa kalau approver-nya cuti."],
  ["Email pemberitahuan", "Belum terpasang di rilis pertama.",
    "Formulir 7.3 minta email ke approver. Perlu tahu alamat mana yang dipakai dan apakah pemohon juga dikabari waktu dikembalikan. Sampai itu ada, approver harus membuka aplikasinya sendiri."],
  ["Peran diatur lewat aplikasi", "Superadmin bisa mengubah semua peran, kecuali perannya sendiri.",
    "Keputusan sadar dan ada harganya: Abeliana ikut mengajukan reimburse, jadi dia bisa mengganti siapa yang memeriksanya. Yang menahan cuma jejak audit. Kalau nanti terasa terlalu longgar, peran approver dipindah ke Firebase Console."],
  ["Kunci periode", "Sudah ada di server, tapi belum ada tombolnya di layar.",
    "Fungsi penguncinya sudah jalan (master-action → kunciPeriode). Tombolnya sengaja belum dipasang sampai jelas siapa yang berhak mengunci dan kapan."],
  ["Stock opname & rilis produk", "Belum dibangun sama sekali.",
    "Disebut di formulir 1.1 tanpa rincian. Formulir 8.4 menempatkannya setelah reimburse selesai."],
];

const EN = [
  ["Period cut-off", "The 26th to the 25th, labelled by the month it ends in.",
    "Item 6.3 was answered “cannot answer yet”. If the company uses a plain calendar month or follows payday, every period label and export file shifts. Changed in one place: CUT_OFF in src/lib/reimburseMeta.js."],
  ["Owner threshold", "Set from the Threshold & period page; there is no default.",
    "Nobody has ever named the figure. Until it is set, every claim stops at the Director."],
  ["Letter-number format", "NNN/CODE/SM/ROMAN-MONTH/YEAR, sequenced per code per year, reset each January.",
    "The code “SM” and the reset rule are our invention. MUST BE SETTLED BEFORE THE FIRST DOCUMENT IS ISSUED: if a paper register already runs, the first number must continue from it, set on the Threshold & period page — an issued number cannot be taken back."],
  ["Revising a wrong document", "Cancelled with a reason, then reissued under a new number.",
    "Needs checking against office habit. Some offices keep the same number and add “Rev.1”. If so, the rule differs and must change before real use."],
  ["Document file format", "The download is a .docx.",
    "Chosen so Abeliana can still tidy it before printing and signing. If what is needed is a file that cannot be altered once numbered, it becomes PDF — and that changes what the document is worth legally."],
  ["Ways it can fail", "Only three are wired: returned, voided, document cancelled.",
    "Item 4.3 was answered “no trial yet”. Before real use: claimants who resign mid-claim, duplicate invoices, amounts changing after approval."],
  ["The 3-day limit", "No reminder and no overdue marker yet.",
    "Item 4.4 names a 3-day maximum. Someone must decide: flag in red, or email the approver — and who gets it when the approver is away."],
  ["Notification email", "Not in the first release.",
    "Item 7.3 asks for email to the approver. We need the mailbox, and whether the claimant is notified on a return. Until then, approvers must open the app themselves."],
  ["Roles managed in-app", "The superadmin may change every role except her own.",
    "A deliberate choice with a price: she also files claims, so she can change who reviews her. Only the audit trail holds that in check."],
  ["Period lock", "Live on the server, but no button on screen yet.",
    "The locking function works (master-action → kunciPeriode). The button is deliberately absent until it is clear who may lock and when."],
  ["Stock opname & product release", "Not built at all.",
    "Mentioned in item 1.1 with no detail. Item 8.4 places it after reimbursement."],
];

export default function Asumsi() {
  const { t, lang } = useBahasa();
  const rows = lang === "en" ? EN : ID;
  return (
    <>
      <KepalaHalaman judul={t("nAsumsi")} lede={t("asumsiLede")} />
      <div className="mb-4">
        <Catatan nada="warn">
          {lang === "en"
            ? "The letter-number row is the urgent one: it must be settled before the first document is issued."
            : "Baris format nomor surat yang paling mendesak: harus beres sebelum dokumen pertama terbit."}
        </Catatan>
      </div>
      <Tabel kolom={[
        { t: t("asumsiHal"), lebar: 150 }, { t: t("asumsiDipakai"), lebar: 200 }, { t: t("asumsiPerlu") },
      ]}>
        {rows.map(([a, b, c]) => (
          <tr key={a}>
            <td className="font-semibold">{a}</td>
            <td className="text-ink-2 dark:text-ink-dark-2">{b}</td>
            <td className="text-ink-2 dark:text-ink-dark-2">{c}</td>
          </tr>
        ))}
      </Tabel>
    </>
  );
}
