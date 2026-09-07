/**
 * Mengubah dokumen yang sudah terbit menjadi berkas .docx.
 *
 * Kenapa .docx dan bukan PDF: dokumen ini masih harus dicetak, ditempeli
 * meterai, dan kadang dirapikan Abeliana sebelum dikirim. PDF mengunci
 * isinya — bagus untuk arsip, merepotkan untuk pekerjaan sehari-hari.
 * Kalau nanti diputuskan sebaliknya, yang berubah cuma berkas ini.
 *
 * Yang dipakai adalah `isiJadi` — teks yang SUDAH terisi dan disimpan saat
 * dokumen diterbitkan. Bukan dirender ulang dari template. Kalau dirender
 * ulang, kontrak yang dicetak tahun ini bisa berbunyi berbeda tahun depan
 * hanya karena alamat karyawannya diperbarui di daftar master.
 */
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import { handlerAman, oke, salah } from "./_lib/admin.js";

/** Baris yang seluruhnya huruf kapital dianggap judul atau kepala pasal. */
function garisJadiParagraf(baris) {
  const teks = baris.replace(/\s+$/, "");
  if (!teks.trim()) return new Paragraph({ spacing: { after: 120 }, children: [] });

  const hurufSaja = teks.replace(/[^A-Za-z]/g, "");
  const judul = hurufSaja.length > 3 && hurufSaja === hurufSaja.toUpperCase();
  const judulUtama = judul && !/^PASAL/i.test(teks.trim());

  return new Paragraph({
    alignment: judulUtama ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { after: judul ? 160 : 100 },
    children: [new TextRun({
      text: teks,
      bold: judul,
      size: 22,                         // 11pt
      font: teks.includes("   ") ? "Courier New" : "Calibri",
    })],
  });
}

export const handler = handlerAman(async ({ db, aku, muatan }) => {
  const nomor = String(muatan.nomor || "");
  if (!nomor) throw salah("Nomor dokumen tidak disertakan.");

  const snap = await db.collection("dokumen").doc(nomor).get();
  if (!snap.exists) throw salah(`Dokumen ${nomor} tidak ditemukan di register.`);
  const d = snap.data();

  const isi = String(d.isiJadi || "");
  if (!isi.trim()) throw salah(
    `Dokumen ${nomor} tersimpan tanpa isi. Ini seharusnya tidak terjadi — laporkan nomor ini, ` +
    `dan sementara itu terbitkan ulang dokumennya dari template.`, 500);

  const paragraf = isi.split("\n").map(garisJadiParagraf);

  // Dokumen yang dibatalkan tetap bisa diunduh — arsipnya harus lengkap —
  // tapi diberi tanda supaya tidak pernah beredar sebagai dokumen sah.
  if (d.batal) {
    paragraf.unshift(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({
        text: `— DOKUMEN DIBATALKAN ${d.batal.waktu} — ${d.batal.alasan} —`,
        bold: true, size: 20, color: "A33A2F",
      })],
    }));
  }

  const doc = new Document({
    creator: "Meja Admin",
    title: nomor,
    description: d.perihal || "",
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      children: paragraf,
    }],
  });

  const buf = await Packer.toBuffer(doc);
  const namaBerkas = nomor.replace(/\//g, "-") + ".docx";

  return oke({
    nama: namaBerkas,
    base64: Buffer.from(buf).toString("base64"),
    tipe: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}, { perlu: ["pemohon", "superadmin", "director", "owner"] });
