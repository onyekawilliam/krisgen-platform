import { useEffect, useState } from "react";

function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

// Switches between the light and dark look and remembers the choice on this device.
export default function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("krisgen-theme", theme);
    } catch {
      /* private mode: the choice just will not be remembered */
    }
  }, [theme]);

  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex h-10 w-10 items-center justify-center rounded-full text-ink-dim transition-colors hover:bg-navy-panel2 hover:text-ink ${className}`}
    >
      {dark ? (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
