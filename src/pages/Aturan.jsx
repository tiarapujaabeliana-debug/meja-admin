import { useBahasa } from "../lib/i18n.jsx";
import { useData } from "../lib/store.jsx";
import { KepalaHalaman } from "../components/ui.jsx";
import { rupiah } from "../lib/format.js";
import { ambangBerlaku, CUT_OFF } from "../lib/reimburseMeta.js";

/**
 * Aturan hitung ditampilkan di layar, bukan disembunyikan di dokumentasi.
 *
 * Angka yang menentukan uang orang harus bisa diperiksa ulang oleh orang
 * yang datanya diproses, kapan saja — termasuk batas-batas yang merugikan
 * pemilik sistem sendiri.
 */
export default function Aturan() {
  const { t, lang } = useBahasa();
  const { ambang } = useData();
  const amb = ambangBerlaku(ambang, new Date().toISOString().slice(0, 10));
  const nilai = amb ? rupiah(amb.nilai) : "—";
  const sejak = amb ? amb.berlakuMulai : "—";

  const ID = [
    ["Siapa yang boleh apa",
      "Pemohon hanya melihat pengajuan dan permintaannya sendiri — bukan disaring di layar, tapi memang tidak diminta ke server. Superadmin melihat semuanya, memverifikasi, dan menerbitkan dokumen. Director menyetujui. Owner ikut menyetujui hanya kalau totalnya melewati ambang. Menu yang perannya tidak berhak tidak digambar sama sekali."],
    ["Ambang yang dipakai",
      `Sekarang ${nilai}, berlaku sejak ${sejak}. Yang dipakai untuk sebuah pengajuan adalah versi yang berlaku pada TANGGAL PENGAJUAN, bukan versi terbaru. Kalau ambang dinaikkan bulan depan, pengajuan bulan lalu tetap dinilai dengan ambang lamanya — kalau tidak begitu, riwayat persetujuan tidak lagi cocok dengan jejaknya sendiri.`],
    ["Periode",
      `Cut-off tanggal ${CUT_OFF} sampai ${CUT_OFF - 1}, dilabeli bulan tempat periode berakhir. Satu pengajuan hanya pernah masuk satu periode. Ini masih asumsi — lihat halaman Asumsi & pertanyaan.`],
    ["Dari mana tanggalnya",
      "Semua tanggal pengajuan dan tanggal terbit dokumen diambil dari jam server saat tombol ditekan. Tidak ada satu pun layar yang menyediakan kolom tanggal untuk itu, termasuk untuk superadmin. Begitu ada satu, seluruh alasan memakai jam server gugur. Tanggal MULAI KERJA atau MULAI BERLAKU di dalam kontrak memang diketik — itu isi dokumen, bukan catatan kapan sistem melakukan sesuatu."],
    ["Nomor dokumen keluar sekali",
      "Nomor diambil dari register di dalam satu transaksi, saat tombol Terbitkan ditekan, dan tidak pernah kembali ke kolam — walau dokumennya dibatalkan atau pengajuan yang memakainya dibatalkan. Alasannya: dokumen itu mungkin sudah dicetak dan beredar. Dua dokumen berbeda dengan nomor sama jauh lebih merepotkan daripada register yang bolong."],
    ["Satu nomor, satu pemakaian",
      "Sebuah dokumen terbit hanya bisa ditempel ke satu permintaan atau satu pengajuan reimburse. Pemeriksaannya diulang tepat sebelum menyimpan, bukan cuma waktu daftar pilihannya digambar — dua orang yang menekan tombol pada detik yang sama tidak boleh sama-sama berhasil."],
    ["Template ditambah versi, tidak ditimpa",
      "Mengubah template membuat versi baru. Dokumen yang sudah terbit menyimpan isi jadinya sendiri dan tetap menunjuk versi yang dipakai waktu itu — jadi kontrak yang dicetak tahun ini tetap berbunyi sama tahun depan, walau alamat karyawannya sudah diperbarui di daftar master."],
    ["Layar bilingual, dokumen tidak",
      "Tombol ID/EN mengubah seluruh teks layar, termasuk yang dibaca Director. Isi dokumen tidak ikut berubah: kontrak berbahasa Indonesia tetap tertulis “Sabtu, 5 September 2026” walau dibuka dengan layar berbahasa Inggris. Dokumen yang berubah isinya tergantung siapa yang membuka adalah dokumen yang tidak bisa dipakai sebagai bukti."],
    ["Kenapa tidak ada tombol hapus",
      "Pengajuan dan dokumen yang salah dibatalkan dengan alasan wajib, tidak dihapus. Baris yang hilang tanpa bekas membuat selisih angka antar periode dan lompatan nomor surat tidak bisa dijelaskan — dan yang paling dirugikan adalah orang yang harus menjelaskannya waktu diaudit."],
    ["Kenapa akun jurnal tidak boleh diketik bebas",
      "Berkas ekspornya masuk ke Journal. Kalau nama akun diketik bebas, tiap orang menulis versi berbeda dan berkasnya harus dirapikan tangan sebelum bisa diimpor — persis pekerjaan yang mau dihilangkan."],
    ["Lampiran tidak punya tautan permanen",
      "Nota belanja dibuka lewat tautan bertanda tangan yang mati dalam 10 menit. Tautan permanen berarti siapa pun yang pernah menerimanya bisa membukanya lagi bertahun-tahun kemudian, jauh setelah orangnya pindah kerja."],
    ["Jejak perubahan",
      "Setiap perubahan tercatat beserta nilai lamanya, siapa yang melakukan, dan jam servernya. Jejaknya ditulis dalam transaksi yang sama dengan perubahannya, jadi tidak pernah ada perubahan tanpa jejak atau jejak tanpa perubahan. Tidak bisa diedit atau dihapus oleh siapa pun, termasuk Owner."],
    ["Yang TIDAK dijaga sistem",
      "Superadmin bisa mengubah peran orang lain, termasuk mengangkat approver yang akan memeriksa pengajuannya sendiri. Yang menahan hal itu hanya jejak audit. Ini keputusan sadar, bukan kelalaian — ditulis di sini supaya tidak ada yang menemukannya sebagai kejutan."],
  ];

  const EN = [
    ["Who may do what",
      "A claimant sees only their own claims and requests — not filtered on screen, but never requested from the server at all. The superadmin sees everything, reviews, and issues documents. The Director approves. The Owner only joins when the total crosses the threshold. Menus a role has no right to are not drawn at all."],
    ["Which threshold applies",
      `Currently ${nilai}, effective ${sejak}. The version applied to a claim is the one in effect on the CLAIM DATE, not the newest one. Raising it next month leaves last month's claims judged by the old one — otherwise the approval history stops matching its own audit trail.`],
    ["The period",
      `Cut-off runs from the ${CUT_OFF}th to the ${CUT_OFF - 1}th, labelled by the month it ends in. A claim only ever falls in one period. This is still an assumption — see Assumptions & questions.`],
    ["Where dates come from",
      "Claim dates and document issue dates come from the server clock at the moment the button is pressed. No screen anywhere offers a field for them, superadmin included. The moment one does, the whole reason for using a server clock is gone. A START DATE inside a contract is typed — that is document content, not a record of when the system did something."],
    ["A number is drawn once",
      "The number comes from the register inside a single transaction, the moment Issue is pressed, and never returns to the pool — even if the document is cancelled or the claim using it is voided. The reason: that document may already be printed and circulating. Two different documents sharing one number is far worse than a register with a gap."],
    ["One number, one use",
      "An issued document attaches to one request or one claim, and no more. The check runs again right before saving, not only when the picker was drawn — two people pressing at the same second must not both succeed."],
    ["Templates gain versions, never get overwritten",
      "Editing a template creates a new version. Documents already issued store their own finished text and keep pointing at the version used at the time — so a contract printed this year still reads the same next year, even after the employee's address is updated in the master list."],
    ["The screen is bilingual, the document is not",
      "The ID/EN switch changes every word on screen, including what the Director reads. Document content does not follow: an Indonesian contract still reads “Sabtu, 5 September 2026” when opened in English. A document whose content depends on who opens it cannot serve as evidence."],
    ["Why there is no delete button",
      "Wrong claims and documents are cancelled with a mandatory reason, never deleted. A row that vanishes without a trace makes period differences and letter-number gaps unexplainable — and the person hurt most is the one who has to explain them in an audit."],
    ["Why the ledger account is not free text",
      "The export file goes into Journal. With free text, everyone writes their own version of an account name and the file has to be cleaned by hand before import — exactly the work this is meant to remove."],
    ["Attachments have no permanent link",
      "Receipts open through a signed link that dies in 10 minutes. A permanent link means anyone who ever received it can open it again years later, long after the person has left."],
    ["Change history",
      "Every change is recorded with its previous value, who did it, and the server time. The trail is written in the same transaction as the change, so there is never a change without a trail or a trail without a change. Nobody can edit or delete it, Owner included."],
    ["What the system does NOT protect",
      "The superadmin can change other people's roles, including appointing the approver who will review her own claims. Only the audit trail holds that in check. This is a deliberate choice, not an oversight — written here so nobody discovers it as a surprise."],
  ];

  const R = lang === "en" ? EN : ID;

  return (
    <>
      <KepalaHalaman judul={t("nAturan")} lede={t("aturanLede")} />
      <div className="grid gap-3.5">
        {R.map(([h, b], i) => (
          <div key={h} className="kartu p-4">
            <div className="lbl">{String(i + 1).padStart(2, "0")}</div>
            <h3 className="text-[14.5px] font-bold mt-0.5 mb-1.5">{h}</h3>
            <p className="text-[13px] text-ink-2 dark:text-ink-dark-2 max-w-[72ch] m-0">{b}</p>
          </div>
        ))}
      </div>
    </>
  );
}
