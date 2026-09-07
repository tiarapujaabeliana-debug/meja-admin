/**
 * Palet "Frost" — SUMBER TUNGGAL warna aplikasi.
 * Jangan pernah menulis warna literal (#hex / rgb) di komponen; kalau
 * warnanya tidak ada di sini, tambahkan di sini dulu. Tanpa aturan itu,
 * tema gelap akan bocor sebagian dan ketahuannya baru di layar orang lain.
 */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        ground:  { DEFAULT: "#F1F5F7", dark: "#0A1116" },
        surface: { DEFAULT: "#FFFFFF", 2: "#E8EFF2", 3: "#DCE7EB",
                   dark: "#101B21", "dark-2": "#15232A", "dark-3": "#1B2D35" },
        line:    { DEFAULT: "#D2DFE4", strong: "#B2C4CB",
                   dark: "#213640", "dark-strong": "#31505C" },
        ink:     { DEFAULT: "#0F1F27", 2: "#3E545E", 3: "#6B838C",
                   dark: "#E6F0F3", "dark-2": "#A5BDC6", "dark-3": "#78929C" },
        frost:   { DEFAULT: "#0D6B79", soft: "#D8EBEE", deep: "#095561",
                   dark: "#48BCCC", "dark-soft": "#0F373E", "dark-deep": "#8CDBE6" },
        ok:      { DEFAULT: "#1B6B49", soft: "#D9EDE3", dark: "#5BC894", "dark-soft": "#0F3025" },
        warn:    { DEFAULT: "#8E5B14", soft: "#F5E7D0", dark: "#DFAC5D", "dark-soft": "#33250F" },
        bad:     { DEFAULT: "#A33A2F", soft: "#F6DFDB", dark: "#EC8375", "dark-soft": "#3A1A16" },
      },
      borderRadius: { card: "10px" },
    },
  },
  plugins: [],
};
