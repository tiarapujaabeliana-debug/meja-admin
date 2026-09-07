/**
 * Uji penulis .docx.
 *
 * Berkas .docx yang rusak tidak memberi tanda apa pun sampai seseorang
 * mencoba membukanya di Word dan dapat pesan "unreadable content". Karena
 * itu yang diuji di sini bukan cuma "fungsinya jalan", tapi susunan ZIP
 * dan XML-nya benar-benar sah.
 *
 * Pemeriksaan terakhir — membuka berkasnya sungguhan dengan pembaca docx
 * lain — dijalankan terpisah oleh uji/periksa-docx.py.
 */
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { buatDocx, _uji } from "../netlify/functions/_lib/docx.js";

let lulus = 0, gagal = 0;
function uji(nama, fn) {
  try { fn(); lulus++; console.log("  ✓ " + nama); }
  catch (e) { gagal++; console.log("  ✗ " + nama + "\n      " + e.message); }
}
const bagian = (s) => console.log("\n" + s);

/** Pembaca ZIP sederhana: membaca direktori pusat, bukan menebak dari depan. */
function bacaZip(buf) {
  const tandaPenutup = 0x06054b50;
  let p = buf.length - 22;
  while (p >= 0 && buf.readUInt32LE(p) !== tandaPenutup) p--;
  assert.ok(p >= 0, "penutup direktori ZIP tidak ditemukan");
  const jumlah = buf.readUInt16LE(p + 10);
  let posisi = buf.readUInt32LE(p + 16);
  const isi = {};
  for (let i = 0; i < jumlah; i++) {
    assert.equal(buf.readUInt32LE(posisi), 0x02014b50, "tanda catatan direktori salah");
    const metode = buf.readUInt16LE(posisi + 10);
    const crc = buf.readUInt32LE(posisi + 16);
    const ukuranMampat = buf.readUInt32LE(posisi + 20);
    const ukuranAsli = buf.readUInt32LE(posisi + 24);
    const panjangNama = buf.readUInt16LE(posisi + 28);
    const panjangTambahan = buf.readUInt16LE(posisi + 30);
    const panjangKomentar = buf.readUInt16LE(posisi + 32);
    const posisiLokal = buf.readUInt32LE(posisi + 42);
    const nama = buf.toString("utf8", posisi + 46, posisi + 46 + panjangNama);

    assert.equal(buf.readUInt32LE(posisiLokal), 0x04034b50, `tanda kepala lokal salah untuk ${nama}`);
    const namaLokal = buf.readUInt16LE(posisiLokal + 26);
    const tambahanLokal = buf.readUInt16LE(posisiLokal + 28);
    const awalData = posisiLokal + 30 + namaLokal + tambahanLokal;
    const mampat = buf.subarray(awalData, awalData + ukuranMampat);
    const mentah = metode === 8 ? zlib.inflateRawSync(mampat) : mampat;

    assert.equal(mentah.length, ukuranAsli, `ukuran asli tidak cocok untuk ${nama}`);
    assert.equal(_uji.crc32(mentah), crc, `CRC tidak cocok untuk ${nama}`);
    isi[nama] = mentah.toString("utf8");
    posisi += 46 + panjangNama + panjangTambahan + panjangKomentar;
  }
  return isi;
}

/** Pemeriksa XML sederhana: tag yang dibuka harus ditutup dengan urutan benar. */
function xmlSeimbang(teks) {
  const tumpukan = [];
  const re = /<\/?([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
  let m;
  let sisa = teks.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  while ((m = re.exec(sisa))) {
    const penuh = m[0], tag = m[1], tutupSendiri = m[3] === "/";
    if (penuh.startsWith("</")) {
      const atas = tumpukan.pop();
      if (atas !== tag) throw new Error(`tag </${tag}> menutup <${atas}>`);
    } else if (!tutupSendiri) {
      tumpukan.push(tag);
    }
  }
  if (tumpukan.length) throw new Error("tag belum ditutup: " + tumpukan.join(", "));
  return true;
}

/* ================================================================ */
bagian("Susunan ZIP");

const CONTOH = [
  { teks: "PERJANJIAN KERJA WAKTU TERTENTU", tebal: true, rata: "tengah" },
  { teks: "Nomor: 003/PK/SM/IX/2026" },
  { teks: "" },
  { teks: "Nama       : Rizky Pratama", mono: true },
  { teks: "NIK        : 3174052809980003", mono: true },
  { teks: "PASAL 1 — JABATAN", tebal: true },
  { teks: "PIHAK KEDUA diterima sebagai Store Crew." },
];
const buf = buatDocx(CONTOH, { judul: "003/PK/SM/IX/2026", penulis: "Abeliana Putri" });

uji("menghasilkan Buffer yang tidak kosong", () => {
  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.length > 800, "terlalu kecil: " + buf.length);
});
uji("diawali tanda ZIP (PK\\x03\\x04)", () => {
  assert.equal(buf.readUInt32LE(0), 0x04034b50);
});
uji("direktori pusat, CRC, dan ukuran tiap berkas cocok", () => {
  bacaZip(buf); // seluruh pemeriksaannya di dalam
});

const isi = bacaZip(buf);

uji("berisi enam bagian yang diwajibkan format Office", () => {
  for (const n of [
    "[Content_Types].xml", "_rels/.rels", "word/document.xml",
    "word/_rels/document.xml.rels", "word/styles.xml", "docProps/core.xml",
  ]) assert.ok(isi[n], "hilang: " + n);
});

bagian("XML");

uji("setiap bagian XML-nya seimbang", () => {
  for (const [nama, teks] of Object.entries(isi)) {
    try { xmlSeimbang(teks); }
    catch (e) { throw new Error(`${nama}: ${e.message}`); }
  }
});
uji("document.xml memakai namespace w yang benar", () => {
  assert.match(isi["word/document.xml"],
    /xmlns:w="http:\/\/schemas\.openxmlformats\.org\/wordprocessingml\/2006\/main"/);
});
uji("jumlah paragraf sama dengan jumlah baris yang dikirim", () => {
  const n = (isi["word/document.xml"].match(/<w:p[ >]/g) || []).length;
  assert.equal(n, CONTOH.length);
});
uji("ukuran halaman A4 dan margin 2 cm", () => {
  assert.match(isi["word/document.xml"], /w:w="11906" w:h="16838"/);
  assert.match(isi["word/document.xml"], /w:top="1134"/);
});
uji("baris berspasi rata memakai huruf lebar tetap", () => {
  const d = isi["word/document.xml"];
  const potong = d.slice(d.indexOf("Rizky Pratama") - 400, d.indexOf("Rizky Pratama"));
  assert.match(potong, /Courier New/);
});
uji("judul rata tengah, kepala pasal tidak", () => {
  const d = isi["word/document.xml"];
  const iJudul = d.indexOf("PERJANJIAN KERJA");
  const iPasal = d.indexOf("PASAL 1");
  assert.match(d.slice(iJudul - 300, iJudul), /w:jc w:val="center"/);
  assert.ok(!/w:jc w:val="center"/.test(d.slice(iPasal - 200, iPasal)), "kepala pasal ikut ke tengah");
});
uji("spasi perataan tidak dimakan Word", () => {
  assert.match(isi["word/document.xml"], /xml:space="preserve"/);
});

bagian("Pelolosan karakter — ini yang merusak berkas kalau salah");

uji("ampersand di nama vendor tidak merusak XML", () => {
  const b = buatDocx([{ teks: "PT Sol & Sole Nusantara" }], { judul: "x" });
  const d = bacaZip(b)["word/document.xml"];
  xmlSeimbang(d);
  assert.ok(d.includes("PT Sol &amp; Sole Nusantara"));
  assert.ok(!/PT Sol & Sole/.test(d), "ampersand mentah lolos ke XML");
});
uji("tanda kurung siku di alamat tidak merusak XML", () => {
  const b = buatDocx([{ teks: 'Jl. Merdeka <No. 5> "Blok A"' }], { judul: "x" });
  const d = bacaZip(b)["word/document.xml"];
  xmlSeimbang(d);
  assert.ok(d.includes("&lt;No. 5&gt;"));
});
uji("judul dokumen yang mengandung & juga dilolosi", () => {
  const b = buatDocx([{ teks: "isi" }], { judul: "PKS A & B", penulis: "R&D" });
  const c = bacaZip(b)["docProps/core.xml"];
  xmlSeimbang(c);
  assert.ok(c.includes("PKS A &amp; B"));
});
uji("karakter kendali dibuang, bukan diloloskan", () => {
  // Karakter kendali ditulis lewat fromCharCode, bukan literal — kalau
  // ditulis literal, dia hilang waktu berkas ini disunting dan ujinya
  // diam-diam berhenti menguji apa pun.
  const kendali = String.fromCharCode(7) + String.fromCharCode(1) + String.fromCharCode(31);
  const b = buatDocx([{ teks: "Rizky " + kendali + "Pratama" }], { judul: "x" });
  const d = bacaZip(b)["word/document.xml"];
  xmlSeimbang(d);
  assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(d));
  assert.ok(d.includes("Rizky Pratama"), "teks di sekitar karakter kendali ikut hilang");
});
uji("teks Indonesia beraksen utuh setelah bolak-balik ZIP", () => {
  const b = buatDocx([{ teks: "Perjanjian ditandatangani — Rp 5.200.000 “lima juta”" }], { judul: "x" });
  const d = bacaZip(b)["word/document.xml"];
  assert.ok(d.includes("Rp 5.200.000"));
  assert.ok(d.includes("—"), "tanda pisah panjang hilang");
  assert.ok(d.includes("“lima juta”"), "tanda kutip lengkung hilang");
});

uji("baris tanda tangan berspasi rata TIDAK ditengahkan", () => {
  // Regresi 7 Sep 2026: "PIHAK PERTAMA        PIHAK KEDUA" hurufnya kapital
  // semua, jadi sempat dianggap judul dan ditengahkan — kolom tanda
  // tangannya berhenti sejajar dengan nama di bawahnya.
  const b = buatDocx([{ teks: "PIHAK PERTAMA          PIHAK KEDUA", tebal: true, mono: true }], {});
  const d = bacaZip(b)["word/document.xml"];
  assert.ok(!/w:jc w:val="center"/.test(d), "baris tanda tangan ikut ditengahkan");
  assert.match(d, /Courier New/);
});

bagian("Kasus batas");

uji("dokumen satu baris tetap sah", () => {
  const b = buatDocx([{ teks: "Halo" }], {});
  assert.ok(bacaZip(b)["word/document.xml"].includes("Halo"));
});
uji("baris kosong tetap jadi paragraf, bukan hilang", () => {
  const b = buatDocx([{ teks: "A" }, { teks: "" }, { teks: "B" }], {});
  const n = (bacaZip(b)["word/document.xml"].match(/<w:p[ >]/g) || []).length;
  assert.equal(n, 3);
});
uji("dokumen panjang (600 baris) tetap sah", () => {
  const banyak = Array.from({ length: 600 }, (_, i) => ({ teks: `Baris ke-${i + 1} dengan isi secukupnya.` }));
  const b = buatDocx(banyak, { judul: "panjang" });
  const d = bacaZip(b)["word/document.xml"];
  xmlSeimbang(d);
  assert.ok(d.includes("Baris ke-600"));
});
uji("isi sama menghasilkan berkas yang sama persis", () => {
  // Stempel waktu ZIP-nya tetap, jadi dua kali jalan harus identik —
  // itu yang membuat "berkas ini pernah diubah atau tidak" bisa dibuktikan.
  const a = buatDocx(CONTOH, { judul: "sama", penulis: "x" });
  const b = buatDocx(CONTOH, { judul: "sama", penulis: "x" });
  assert.ok(a.equals(b));
});

/* Simpan satu berkas untuk diperiksa pembaca docx lain. */
mkdirSync("uji/keluaran", { recursive: true });
writeFileSync("uji/keluaran/contoh.docx", buf);
console.log(`\nBerkas contoh ditulis ke uji/keluaran/contoh.docx (${buf.length} byte)`);

console.log(`\n${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal ? 1 : 0);
