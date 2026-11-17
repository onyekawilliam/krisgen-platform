/** @type {import('tailwindcss').Config} */

// Every colour is a CSS variable (see src/index.css) so the whole site switches
// between the light and dark themes. The token NAMES are unchanged from the
// original design, so existing classes keep working.
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        navy: {
          deep: token("--c-bg"), // page background
          panel: token("--c-surface"), // cards and panels
          panel2: token("--c-surface-2"), // subtle fills, hovers
          line: token("--c-line"), // borders and dividers
        },
        gold: { DEFAULT: token("--c-gold"), bright: token("--c-gold-text") },
        teal: token("--c-link"),
        coral: token("--c-danger"),
        mint: token("--c-success"),
        ink: { DEFAULT: token("--c-ink"), dim: token("--c-ink-dim"), faint: token("--c-ink-faint") },
        // Always-dark brand surfaces (announcement bar, hero, footer) in both themes.
        brand: { DEFAULT: "#0B1020", raised: "#131C33", line: "#222E4D", text: "#E8ECF5", dim: "#A3AECA" },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
        glow: "0 12px 34px -12px rgb(240 180 41 / 0.55)",
      },
    },
  },
  plugins: [],
};
