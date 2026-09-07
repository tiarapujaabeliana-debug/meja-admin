/**
 * Uji logika dengan data sintetis. Jalankan: npm run uji
 *
 * Yang diuji di sini adalah yang tidak kelihatan di layar: batas periode,
 * pemilihan ambang menurut tanggal, keseimbangan jurnal, dan pengisian
 * dokumen. Semuanya rumus yang salahnya baru ketahuan berbulan-bulan
 * kemudian kalau tidak diuji sekarang.
 */
import assert from "node:assert/strict";
import {
  periodeDari, rentangPeriode, ambangBerlaku, setelahDirector, totalPengajuan,
  validasiPengajuan, barisJurnal, keCsv, aksiTersedia, jalurPersetujuan, CUT_OFF,
} from "../src/lib/reimburseMeta.js";
import {
  susunNomor, kunciCounter, isiDokumen, slugKunci, kunciDipakai,
  dokumenBebas, isianKurang, kodeSah,
} from "../src/lib/dokumenMeta.js";
import { rupiah, tanggalPanjang } from "../src/lib/format.js";

let lulus = 0, gagal = 0;
function uji(nama, fn) {
  try { fn(); lulus++; console.log("  ✓ " + nama); }
  catch (e) { gagal++; console.log("  ✗ " + nama + "\n      " + e.message); }
}
const bagian = (s) => console.log("\n" + s);

/* ================================================================
   PERIODE — cut-off 26 → 25
   ================================================================ */
bagian("Periode (cut-off " + CUT_OFF + ")");

uji("tanggal 25 masuk periode bulan berjalan", () => {
  assert.equal(periodeDari("2026-09-25"), "2026-09");
});
uji("tanggal 26 melompat ke periode bulan berikutnya", () => {
  assert.equal(periodeDari("2026-09-26"), "2026-10");
});
uji("tanggal 1 masih periode bulan berjalan", () => {
  assert.equal(periodeDari("2026-09-01"), "2026-09");
});
uji("26 Desember melompat ke Januari tahun berikutnya", () => {
  assert.equal(periodeDari("2026-12-26"), "2027-01");
});
uji("25 Desember tetap Desember", () => {
  assert.equal(periodeDari("2026-12-25"), "2026-12");
});
uji("satu tanggal hanya pernah masuk satu periode", () => {
  // Setiap hari sepanjang setahun harus menghasilkan tepat satu label.
  const hitung = {};
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 28; d++) {
      const iso = `2026-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const p = periodeDari(iso);
      hitung[iso] = (hitung[iso] || 0) + 1;
      assert.match(p, /^\d{4}-\d{2}$/);
    }
  }
  assert.ok(Object.values(hitung).every((n) => n === 1));
});
uji("rentang periode menutup rapat tanpa celah", () => {
  const r = rentangPeriode("2026-09");
  assert.equal(r.mulai, "2026-08-26");
  assert.equal(r.selesai, "2026-09-25");
  // hari sesudah selesai harus jadi periode berikutnya
  assert.equal(periodeDari("2026-09-26"), "2026-10");
});
uji("rentang periode Januari mundur ke Desember tahun lalu", () => {
  const r = rentangPeriode("2027-01");
  assert.equal(r.mulai, "2026-12-26");
  assert.equal(r.selesai, "2027-01-25");
});

/* ================================================================
   AMBANG — append-only, dipilih menurut tanggal pengajuan
   ================================================================ */
bagian("Ambang berversi");

const AMBANG = [
  { nilai: 3000000, berlakuMulai: "2026-01-01" },
  { nilai: 5000000, berlakuMulai: "2026-09-01" },
  { nilai: 8000000, berlakuMulai: "2026-12-01" },
];

uji("pengajuan Agustus memakai ambang lama", () => {
  assert.equal(ambangBerlaku(AMBANG, "2026-08-26").nilai, 3000000);
});
uji("pengajuan September memakai ambang baru", () => {
  assert.equal(ambangBerlaku(AMBANG, "2026-09-03").nilai, 5000000);
});
uji("tepat di tanggal berlaku sudah memakai yang baru", () => {
  assert.equal(ambangBerlaku(AMBANG, "2026-09-01").nilai, 5000000);
});
uji("ambang masa depan TIDAK mempengaruhi pengajuan hari ini", () => {
  // Inti aturannya: menetapkan ambang Desember tidak boleh mengubah
  // penilaian pengajuan September yang sudah selesai.
  assert.equal(ambangBerlaku(AMBANG, "2026-09-15").nilai, 5000000);
});
uji("daftar tidak urut tetap memilih yang benar", () => {
  const acak = [AMBANG[2], AMBANG[0], AMBANG[1]];
  assert.equal(ambangBerlaku(acak, "2026-09-15").nilai, 5000000);
});

/* ================================================================
   JALUR PERSETUJUAN
   ================================================================ */
bagian("Jalur persetujuan");

const buatPengajuan = (harga, dibuat = "2026-09-10 10:00") => ({
  no: "RB-2026-0001", pemohonUid: "u4", status: "menunggu_director", dibuat,
  lines: [{ desc: "x", akun: "6-1001", qty: 1, unit: "pcs", harga, file: "a.pdf" }],
});

uji("di bawah ambang berhenti di Director", () => {
  assert.equal(setelahDirector(buatPengajuan(4_000_000), AMBANG), "disetujui");
});
uji("di atas ambang lanjut ke Owner", () => {
  assert.equal(setelahDirector(buatPengajuan(6_000_000), AMBANG), "menunggu_owner");
});
uji("tepat DI ambang belum lewat — masih berhenti di Director", () => {
  assert.equal(setelahDirector(buatPengajuan(5_000_000), AMBANG), "disetujui");
});
uji("pengajuan Agustus 4 juta LEWAT ambang lamanya", () => {
  // Kalau ambang dipilih dari versi terbaru (5jt), ini akan salah jadi
  // "disetujui" — padahal waktu itu ambangnya masih 3jt.
  assert.equal(setelahDirector(buatPengajuan(4_000_000, "2026-08-20 09:00"), AMBANG), "menunggu_owner");
});
uji("jalur digambar dengan langkah Owner hanya kalau perlu", () => {
  assert.equal(jalurPersetujuan(buatPengajuan(1_000_000), AMBANG).langkah.length, 3);
  assert.equal(jalurPersetujuan(buatPengajuan(9_000_000), AMBANG).langkah.length, 4);
});

/* ================================================================
   IZIN — layar dan server memakai fungsi yang sama
   ================================================================ */
bagian("Izin aksi");

uji("superadmin boleh verifikasi yang baru diajukan", () => {
  const p = { ...buatPengajuan(1e6), status: "diajukan" };
  assert.deepEqual(aksiTersedia(p, "superadmin", "u1").sort(), ["return", "verify", "void"].sort());
});
uji("director TIDAK boleh menyentuh yang belum diverifikasi", () => {
  const p = { ...buatPengajuan(1e6), status: "diajukan" };
  assert.deepEqual(aksiTersedia(p, "director", "u2"), []);
});
uji("owner hanya muncul di langkah owner", () => {
  assert.deepEqual(aksiTersedia({ ...buatPengajuan(9e6), status: "menunggu_director" }, "owner", "u3"), []);
  assert.deepEqual(
    aksiTersedia({ ...buatPengajuan(9e6), status: "menunggu_owner" }, "owner", "u3").sort(),
    ["approve", "return"].sort());
});
uji("pemohon bisa mengajukan ulang yang dikembalikan", () => {
  const p = { ...buatPengajuan(1e6), status: "dikembalikan", pemohonUid: "u4" };
  assert.ok(aksiTersedia(p, "pemohon", "u4").includes("submit"));
});
uji("pemohon TIDAK bisa menyentuh punya orang lain", () => {
  const p = { ...buatPengajuan(1e6), status: "dikembalikan", pemohonUid: "u5" };
  assert.deepEqual(aksiTersedia(p, "pemohon", "u4"), []);
});
uji("yang sudah disetujui tidak bisa diapa-apakan lagi", () => {
  const p = { ...buatPengajuan(1e6), status: "disetujui" };
  for (const r of ["pemohon", "superadmin", "director", "owner"]) {
    assert.deepEqual(aksiTersedia(p, r, "u1"), [], "peran " + r);
  }
});

/* ================================================================
   VALIDASI — semua diperiksa, bukan berhenti di kesalahan pertama
   ================================================================ */
bagian("Validasi pengajuan");

const AKUN_SAH = ["6-1001", "6-1101"];

uji("pengajuan lengkap lolos", () => {
  const d = { keperluan: "ATK", lines: [{ desc: "kertas", akun: "6-1101", qty: 2, harga: 62000, file: "a.pdf" }] };
  assert.deepEqual(validasiPengajuan(d, AKUN_SAH), []);
});
uji("SEMUA kesalahan dilaporkan sekaligus, bukan satu per satu", () => {
  const d = { keperluan: "", lines: [{ desc: "", akun: "", qty: 0, harga: 0, file: "" }] };
  const e = validasiPengajuan(d, AKUN_SAH);
  assert.equal(e.length, 6, "harus 6: keperluan + desc + akun + qty + harga + file");
});
uji("akun di luar daftar ditolak", () => {
  const d = { keperluan: "x", lines: [{ desc: "y", akun: "9-9999", qty: 1, harga: 1000, file: "a.pdf" }] };
  assert.ok(validasiPengajuan(d, AKUN_SAH).some((x) => x.k === "akunAsing"));
});
uji("lampiran wajib — tanpa itu tidak bisa dikirim", () => {
  const d = { keperluan: "x", lines: [{ desc: "y", akun: "6-1001", qty: 1, harga: 1000, file: "" }] };
  assert.ok(validasiPengajuan(d, AKUN_SAH).some((x) => x.k === "file"));
});
uji("nomor baris di pesan kesalahan menunjuk baris yang benar", () => {
  const d = { keperluan: "x", lines: [
    { desc: "ok", akun: "6-1001", qty: 1, harga: 1000, file: "a.pdf" },
    { desc: "", akun: "6-1001", qty: 1, harga: 1000, file: "a.pdf" },
  ] };
  const e = validasiPengajuan(d, AKUN_SAH);
  assert.equal(e[0].n, 2);
});

/* ================================================================
   EKSPOR JURNAL — harus seimbang
   ================================================================ */
bagian("Ekspor jurnal");

const DAFTAR_AKUN = [
  { kode: "6-1001", nama: "Beban Perjalanan Dinas", namaEn: "Business Travel Expense" },
  { kode: "6-1101", nama: "Beban ATK", namaEn: "Office Supplies" },
];
const P_EKSPOR = {
  no: "RB-2026-0041", pemohonNama: "Rizky Pratama", dibuat: "2026-09-03 09:14",
  lines: [
    { desc: "Tiket", akun: "6-1001", qty: 2, harga: 200000, file: "a.pdf" },
    { desc: "Kertas", akun: "6-1101", qty: 10, harga: 62000, file: "b.pdf" },
  ],
};

uji("debit sama dengan kredit", () => {
  const rows = barisJurnal(P_EKSPOR, DAFTAR_AKUN);
  const d = rows.reduce((s, r) => s + r.Debit, 0);
  const k = rows.reduce((s, r) => s + r.Credit, 0);
  assert.equal(d, k);
  assert.equal(d, totalPengajuan(P_EKSPOR));
});
uji("tiap baris biaya jadi satu baris debit + satu baris kredit utang", () => {
  assert.equal(barisJurnal(P_EKSPOR, DAFTAR_AKUN).length, P_EKSPOR.lines.length + 1);
});
uji("kode akun ikut terbawa, bukan cuma namanya", () => {
  const rows = barisJurnal(P_EKSPOR, DAFTAR_AKUN);
  assert.equal(rows[0]["Account Code"], "6-1001");
  assert.equal(rows[0]["Account Name"], "Business Travel Expense");
});
uji("CSV membungkus sel yang mengandung koma", () => {
  const csv = keCsv([{ A: 'ada, koma', B: 1 }]);
  assert.ok(csv.includes('"ada, koma"'));
});
uji("CSV tidak rusak oleh tanda kutip di deskripsi", () => {
  const csv = keCsv([{ A: 'rak 60" akrilik', B: 1 }]);
  assert.ok(csv.includes('"rak 60"" akrilik"'));
});

/* ================================================================
   NOMOR DOKUMEN
   ================================================================ */
bagian("Nomor dokumen");

uji("format nomor sesuai contoh", () => {
  assert.equal(susunNomor({ urut: 14, kode: "PKS", bulan: 8, tahun: 2026 }), "014/PKS/SM/IX/2026");
});
uji("urutan di bawah 100 tetap tiga digit", () => {
  assert.equal(susunNomor({ urut: 1, kode: "PK", bulan: 0, tahun: 2026 }), "001/PK/SM/I/2026");
});
uji("urutan di atas 999 tidak dipotong", () => {
  assert.equal(susunNomor({ urut: 1234, kode: "SK", bulan: 11, tahun: 2026 }), "1234/SK/SM/XII/2026");
});
uji("penghitung terpisah per kode per tahun", () => {
  assert.notEqual(kunciCounter("PKS", 2026), kunciCounter("PK", 2026));
  assert.notEqual(kunciCounter("PKS", 2026), kunciCounter("PKS", 2027));
});
uji("kode harus kapital tanpa spasi", () => {
  assert.ok(kodeSah("PKS"));
  assert.ok(!kodeSah("pks"));
  assert.ok(!kodeSah("PK S"));
  assert.ok(!kodeSah(""));
});

/* ================================================================
   KOLAM DOKUMEN — sekali terpakai, tidak pernah kembali
   ================================================================ */
bagian("Kolam dokumen bebas");

const DOKUMEN = [
  { nomor: "001/PKS/SM/IX/2026", pakai: { ref: "PD-1" }, batal: null },
  { nomor: "002/PKS/SM/IX/2026", pakai: null, batal: null },
  { nomor: "001/PK/SM/IX/2026", pakai: null, batal: { alasan: "salah NIK" } },
  { nomor: "002/PK/SM/IX/2026", pakai: { ref: "RB-1" }, batal: { alasan: "x" } },
];

uji("hanya yang belum terpakai DAN belum dibatalkan yang bebas", () => {
  assert.deepEqual(dokumenBebas(DOKUMEN).map((d) => d.nomor), ["002/PKS/SM/IX/2026"]);
});
uji("dokumen yang dibatalkan tidak kembali ke kolam", () => {
  assert.ok(!dokumenBebas(DOKUMEN).some((d) => d.nomor === "001/PK/SM/IX/2026"));
});

/* ================================================================
   PENGISIAN DOKUMEN
   ================================================================ */
bagian("Pengisian dokumen");

const MASTER = {
  karyawan: [
    { id: "k1", nama: "Rizky Pratama", nik: "3174052809980003", jabatan: "Store Crew", alamat: "Jl. Bintaro Utama IX No. 24" },
    { id: "k4", nama: "David Chen", nik: "3174051103850001", jabatan: "Director", alamat: "Jl. Senopati No. 51" },
  ],
  vendor: [{ id: "v1", nama: "CV Kulit Garut", npwp: "01.234.567.8-424.000", pic: "Asep Rahmat", alamat: "Garut" }],
};
const FIELDS = [
  { key: "perusahaan", label: { id: "Perusahaan" }, tipe: "karyawan", wajib: true },
  { key: "karyawan", label: { id: "Karyawan" }, tipe: "karyawan", wajib: true },
  { key: "gaji", label: { id: "Upah" }, tipe: "rupiah", wajib: true },
  { key: "mulai", label: { id: "Mulai kerja" }, tipe: "tanggal", wajib: true },
  { key: "penempatan", label: { id: "Penempatan" }, tipe: "pilihan", wajib: false, opsi: ["Bintaro"] },
];
const ISI = `Nomor: {{nomor_surat}}
Pada {{tanggal_terbit_panjang}}.
Pihak I : {{perusahaan.nama}}, {{perusahaan.jabatan}}
Pihak II: {{karyawan.nama}}, NIK {{karyawan.nik}}, {{karyawan.alamat}}
Upah {{gaji}} sejak {{mulai}}. Penempatan {{penempatan}}.`;

const NILAI = { perusahaan: "k4", karyawan: "k1", gaji: "5200000", mulai: "2026-09-16", penempatan: "Bintaro" };
const META = { nomor: "003/PK/SM/IX/2026", terbit: "2026-09-07 10:00" };

uji("tidak ada placeholder yang tersisa", () => {
  const out = isiDokumen(ISI, FIELDS, NILAI, META, MASTER);
  assert.equal((out.match(/\{\{/g) || []).length, 0);
  assert.equal((out.match(/…/g) || []).length, 0);
});
uji("sub-kunci menarik dari daftar master", () => {
  const out = isiDokumen(ISI, FIELDS, NILAI, META, MASTER);
  assert.ok(out.includes("3174052809980003"), "NIK karyawan");
  assert.ok(out.includes("Jl. Bintaro Utama IX No. 24"), "alamat karyawan");
  assert.ok(out.includes("David Chen"), "nama pihak pertama");
});
uji("rupiah diformat, bukan angka telanjang", () => {
  assert.ok(isiDokumen(ISI, FIELDS, NILAI, META, MASTER).includes("Rp 5.200.000"));
});
uji("isian kosong jadi titik-titik, bukan 'undefined'", () => {
  const out = isiDokumen(ISI, FIELDS, { perusahaan: "k4" }, META, MASTER);
  assert.ok(out.includes("…"));
  assert.ok(!out.includes("undefined"));
  assert.ok(!out.includes("null"));
});
uji("orang yang tidak ada di master jadi titik-titik, bukan error", () => {
  const out = isiDokumen(ISI, FIELDS, { ...NILAI, karyawan: "k-hilang" }, META, MASTER);
  assert.ok(out.includes("…"));
});
uji("ISI DOKUMEN tidak ikut bahasa layar", () => {
  // Kontrak berbahasa Indonesia harus tetap "Senin", bukan "Monday",
  // walau dibuka Director dengan layar berbahasa Inggris.
  const out = isiDokumen(ISI, FIELDS, NILAI, META, MASTER);
  assert.ok(out.includes("Rabu") || out.includes("Senin") || out.includes("Selasa")
    || out.includes("Kamis") || out.includes("Jumat") || out.includes("Sabtu") || out.includes("Minggu"),
    "nama hari harus Bahasa Indonesia; dapat: " + out.slice(0, 200));
  assert.ok(!/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/.test(out));
});
uji("tanggalPanjang layar tetap bisa Inggris kalau diminta", () => {
  assert.ok(tanggalPanjang("2026-09-07", "en").includes("September"));
  assert.match(tanggalPanjang("2026-09-07", "en"), /Monday/);
  assert.match(tanggalPanjang("2026-09-07", "id"), /Senin/);
});
uji("isian wajib yang kosong terdeteksi, yang opsional tidak", () => {
  const kurang = isianKurang({ fields: FIELDS }, { perusahaan: "k4" });
  assert.deepEqual(kurang.map((f) => f.key).sort(), ["gaji", "karyawan", "mulai"]);
});

/* ================================================================
   KUNCI ISIAN
   ================================================================ */
bagian("Kunci isian");

uji("nama isian jadi kunci yang aman", () => {
  assert.equal(slugKunci("Nama Pihak Kedua"), "nama_pihak_kedua");
  assert.equal(slugKunci("Upah / bulan (Rp)"), "upah_bulan_rp");
  assert.equal(slugKunci("Kedüa Belàh"), "kedua_belah");
  assert.equal(slugKunci(""), "isian");
});
uji("kunci yang masih dipakai di badan dokumen terdeteksi", () => {
  assert.ok(kunciDipakai("Halo {{karyawan.nama}}", "karyawan"));
  assert.ok(kunciDipakai("Halo {{gaji}}", "gaji"));
  assert.ok(!kunciDipakai("Halo {{gaji}}", "karyawan"));
});
uji("kunci mirip tidak salah tangkap", () => {
  assert.ok(!kunciDipakai("{{karyawan_lama}}", "karyawan"));
});

/* ================================================================
   FORMAT
   ================================================================ */
bagian("Format");

uji("rupiah dibulatkan dan dipisah titik", () => {
  assert.equal(rupiah(5200000), "Rp 5.200.000");
  assert.equal(rupiah("1234567.6"), "Rp 1.234.568");
});
uji("rupiah dari nilai tidak sah tidak menghasilkan NaN", () => {
  assert.equal(rupiah("abc"), "—");
  assert.equal(rupiah(null), "Rp 0");
});

/* ================================================================ */
console.log(`\n${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal ? 1 : 0);
