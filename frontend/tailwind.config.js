/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Same names as before, so every page picks up the refreshed palette.
        navy: { deep: "#0B1020", panel: "#121A2E", panel2: "#1A2540", line: "#1F2A44" },
        gold: { DEFAULT: "#E0B04C", bright: "#F2CB78" },
        teal: "#5FB8C0",
        coral: "#EE8A6A",
        mint: "#7FD6A6",
        ink: { DEFAULT: "#E8ECF5", dim: "#9AA6BF", faint: "#8590AB" },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        glow: "0 10px 40px -12px rgba(224, 176, 76, 0.35)",
        lift: "0 14px 34px -14px rgba(0, 0, 0, 0.6)",
      },
    },
  },
  plugins: [],
};
