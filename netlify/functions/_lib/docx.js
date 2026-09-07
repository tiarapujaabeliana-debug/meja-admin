/**
 * Penulis berkas .docx tanpa dependensi luar.
 *
 * KENAPA DITULIS SENDIRI, BUKAN MEMAKAI PAKET `docx`
 * --------------------------------------------------
 * Paket `docx` v8 memakai "exports" bersyarat di package.json-nya:
 *   import  -> build/index.mjs
 *   require -> build/index.cjs
 *   main    -> build/index.umd.js
 *
 * Penyalin berkas Netlify menelusuri `main`, sementara runtime Lambda
 * meminta jalur `require`. Dua jalur berbeda, sehingga build/index.cjs
 * tidak pernah ikut tersalin ke dalam zip fungsinya, dan fungsinya mati
 * dengan Runtime.ImportModuleError sebelum satu baris kode kita jalan
 * (7 Sep 2026, di produksi).
 *
 * Itu bisa ditambal dengan mengubah setelan bundler Netlify, tapi
 * tambalan itu tidak bisa diuji dari luar Netlify — baru ketahuan
 * berhasil atau tidak setelah deploy. Berkas ini bisa diuji sepenuhnya
 * di komputer mana pun, dan menghapus 7,7 MB dependensi sekalian.
 *
 * APA ITU .docx
 * -------------
 * Sebuah berkas ZIP berisi beberapa berkas XML. Tidak ada sihir di
 * dalamnya. Node sudah punya zlib, jadi yang perlu ditulis sendiri cuma
 * susunan ZIP-nya dan XML-nya.
 */

import zlib from "node:zlib";

/* ------------------------------------------------------------------
   ZIP
   ------------------------------------------------------------------ */

/** Tabel CRC-32 standar (polinomial 0xEDB88320), disiapkan sekali. */
const TABEL_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABEL_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/**
 * Menyusun berkas ZIP dari daftar {nama, data}.
 *
 * Semua stempel waktu di dalam ZIP sengaja disetel tetap ke 1980-01-01.
 * Bukan kemalasan: dua dokumen dengan isi sama harus menghasilkan berkas
 * yang sama persis, supaya kalau nanti ada pertanyaan "apakah berkas ini
 * pernah diubah", jawabannya bisa dibuktikan dengan membandingkan isinya.
 */
function susunZip(daftar) {
  const potongan = [];
  const direktori = [];
  let posisi = 0;

  for (const berkas of daftar) {
    const nama = Buffer.from(berkas.nama, "utf8");
    const mentah = Buffer.isBuffer(berkas.data) ? berkas.data : Buffer.from(berkas.data, "utf8");
    const mampat = zlib.deflateRawSync(mentah, { level: 9 });
    const crc = crc32(mentah);

    const kepala = Buffer.alloc(30);
    kepala.writeUInt32LE(0x04034b50, 0);   // tanda kepala berkas lokal
    kepala.writeUInt16LE(20, 4);           // versi minimum
    kepala.writeUInt16LE(0, 6);            // bendera
    kepala.writeUInt16LE(8, 8);            // metode: deflate
    kepala.writeUInt16LE(0, 10);           // jam 00:00
    kepala.writeUInt16LE(0x0021, 12);      // tanggal 1980-01-01
    kepala.writeUInt32LE(crc, 14);
    kepala.writeUInt32LE(mampat.length, 18);
    kepala.writeUInt32LE(mentah.length, 22);
    kepala.writeUInt16LE(nama.length, 26);
    kepala.writeUInt16LE(0, 28);           // panjang bidang tambahan
    potongan.push(kepala, nama, mampat);

    const catatan = Buffer.alloc(46);
    catatan.writeUInt32LE(0x02014b50, 0);  // tanda catatan direktori pusat
    catatan.writeUInt16LE(20, 4);          // versi pembuat
    catatan.writeUInt16LE(20, 6);          // versi minimum
    catatan.writeUInt16LE(0, 8);
    catatan.writeUInt16LE(8, 10);
    catatan.writeUInt16LE(0, 12);
    catatan.writeUInt16LE(0x0021, 14);
    catatan.writeUInt32LE(crc, 16);
    catatan.writeUInt32LE(mampat.length, 20);
    catatan.writeUInt32LE(mentah.length, 24);
    catatan.writeUInt16LE(nama.length, 28);
    catatan.writeUInt16LE(0, 30);          // bidang tambahan
    catatan.writeUInt16LE(0, 32);          // komentar
    catatan.writeUInt16LE(0, 34);          // nomor disk
    catatan.writeUInt16LE(0, 36);          // atribut internal
    catatan.writeUInt32LE(0, 38);          // atribut eksternal
    catatan.writeUInt32LE(posisi, 42);     // posisi kepala berkas lokal
    direktori.push(catatan, nama);

    posisi += kepala.length + nama.length + mampat.length;
  }

  const isiDirektori = Buffer.concat(direktori);
  const penutup = Buffer.alloc(22);
  penutup.writeUInt32LE(0x06054b50, 0);    // tanda penutup direktori
  penutup.writeUInt16LE(0, 4);
  penutup.writeUInt16LE(0, 6);
  penutup.writeUInt16LE(daftar.length, 8);
  penutup.writeUInt16LE(daftar.length, 10);
  penutup.writeUInt32LE(isiDirektori.length, 12);
  penutup.writeUInt32LE(posisi, 16);
  penutup.writeUInt16LE(0, 20);            // panjang komentar

  return Buffer.concat([...potongan, isiDirektori, penutup]);
}

/* ------------------------------------------------------------------
   XML
   ------------------------------------------------------------------ */

/**
 * Pengaman paling penting di berkas ini.
 *
 * Nama vendor atau alamat yang mengandung & atau < akan merusak seluruh
 * berkas kalau tidak dilolosi — Word menolak membukanya dengan pesan
 * "unreadable content", dan orangnya tidak akan tahu kenapa. Karakter
 * kendali juga dibuang karena XML 1.0 tidak mengizinkannya sama sekali.
 */
function xml(s) {
  return String(s ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/**
 * Satu paragraf.
 * @param {{teks?:string, tebal?:boolean, rata?:"kiri"|"tengah", warna?:string,
 *          mono?:boolean, ukuran?:number, jarakSesudah?:number}} p
 */
function paragraf(p) {
  const teks = String(p.teks ?? "");
  if (!teks.trim()) {
    // Baris kosong tetap perlu paragraf, kalau tidak jarak antar bagian hilang.
    return `<w:p><w:pPr><w:spacing w:after="${p.jarakSesudah ?? 120}"/></w:pPr></w:p>`;
  }
  const rPr =
    "<w:rPr>" +
    (p.tebal ? "<w:b/>" : "") +
    `<w:rFonts w:ascii="${p.mono ? "Courier New" : "Calibri"}" w:hAnsi="${p.mono ? "Courier New" : "Calibri"}"/>` +
    `<w:sz w:val="${p.ukuran ?? 22}"/><w:szCs w:val="${p.ukuran ?? 22}"/>` +
    (p.warna ? `<w:color w:val="${xml(p.warna)}"/>` : "") +
    "</w:rPr>";
  const pPr =
    "<w:pPr>" +
    (p.rata === "tengah" ? '<w:jc w:val="center"/>' : "") +
    `<w:spacing w:after="${p.jarakSesudah ?? 100}" w:line="276" w:lineRule="auto"/>` +
    "</w:pPr>";
  // xml:space="preserve" wajib — tanpa itu Word memakan spasi perataan
  // di baris seperti "Nama       : Rizky", dan titik duanya jadi tidak lurus.
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${xml(teks)}</w:t></w:r></w:p>`;
}

const BAGIAN = [
  {
    nama: "[Content_Types].xml",
    isi: XML_HEAD +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      "</Types>",
  },
  {
    nama: "_rels/.rels",
    isi: XML_HEAD +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      "</Relationships>",
  },
  {
    nama: "word/_rels/document.xml.rels",
    isi: XML_HEAD +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>",
  },
  {
    nama: "word/styles.xml",
    isi: XML_HEAD +
      `<w:styles xmlns:w="${NS_W}">` +
      '<w:docDefaults><w:rPrDefault><w:rPr>' +
      '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>' +
      '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="id-ID"/>' +
      "</w:rPr></w:rPrDefault></w:docDefaults>" +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      "</w:styles>",
  },
];

/**
 * Menyusun berkas .docx.
 *
 * @param {Array} paragrafs daftar paragraf, lihat paragraf()
 * @param {{judul?:string, penulis?:string}} meta
 * @returns {Buffer} isi berkas .docx, siap dikirim
 */
export function buatDocx(paragrafs, meta = {}) {
  const badan = paragrafs.map(paragraf).join("");

  // A4 (11906 × 16838 twip) dengan margin 2 cm di keempat sisi.
  const sectPr =
    "<w:sectPr>" +
    '<w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" ' +
    'w:header="708" w:footer="708" w:gutter="0"/>' +
    "</w:sectPr>";

  const dokumen = XML_HEAD +
    `<w:document xmlns:w="${NS_W}"><w:body>${badan}${sectPr}</w:body></w:document>`;

  const core = XML_HEAD +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    `<dc:title>${xml(meta.judul || "")}</dc:title>` +
    `<dc:creator>${xml(meta.penulis || "Meja Admin")}</dc:creator>` +
    `<cp:lastModifiedBy>${xml(meta.penulis || "Meja Admin")}</cp:lastModifiedBy>` +
    "</cp:coreProperties>";

  return susunZip([
    ...BAGIAN,
    { nama: "docProps/core.xml", isi: core },
    { nama: "word/document.xml", isi: dokumen },
  ].map((b) => ({ nama: b.nama, data: Buffer.from(b.isi, "utf8") })));
}

export const _uji = { crc32, susunZip, xml };
