/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: { deep: "#0B111F", panel: "#131C30", panel2: "#1B2740", line: "#2A3550" },
        gold: { DEFAULT: "#C9A24B", bright: "#E4C170" },
        teal: "#3E9199",
        coral: "#D97757",
        ink: { DEFAULT: "#ECE8DD", dim: "#9AA3B8", faint: "#69738C" },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
