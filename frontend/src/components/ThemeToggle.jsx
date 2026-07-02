/**
 * ThemeToggle
 * -----------
 * Animated sun/moon toggle with an expanding circular reveal animation.
 *
 * The toggle itself is purely visual — the actual theme change is deferred
 * until the ripple covers the viewport, so there's never a visible
 * instant-swap moment.
 *
 * Props:
 *   theme        - current theme string ("dark" | "light")
 *   toggleTheme  - function that sets new theme in App state
 *   overlayRef   - ref to ThemeTransitionOverlay (passed from App)
 *   className
 */
import { useEffect, useRef, useState } from "react";

function SunIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function ThemeToggle({ theme, toggleTheme, overlayRef, className = "" }) {
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef(null);
  const pending = useRef(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div style={{ width: 40, height: 40, flexShrink: 0 }} />;

  const isDark = theme === "dark";

  const handleClick = () => {
    if (pending.current) return;

    const nextTheme = isDark ? "light" : "dark";

    // If overlay is available, use the circular reveal animation
    if (overlayRef?.current) {
      pending.current = true;
      const btn = btnRef.current;
      let x = window.innerWidth / 2;
      let y = 60; // fallback: top center
      if (btn) {
        const r = btn.getBoundingClientRect();
        x = r.left + r.width / 2;
        y = r.top + r.height / 2;
      }
      overlayRef.current.startTransition(x, y, nextTheme, () => {
        toggleTheme();
        pending.current = false;
      });
    } else {
      // Graceful fallback: instant switch (no overlay mounted yet)
      toggleTheme();
    }
  };

  return (
    <button
      ref={btnRef}
      id="theme-toggle"
      onClick={handleClick}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      className={className}
      style={{
        position: "relative",
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "1px solid",
        borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.25s, border-color 0.25s, transform 0.15s",
        color: isDark ? "#e5e7eb" : "#374151",
        flexShrink: 0,
        outline: "none",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "scale(1.1)";
        e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.09)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
      }}
    >
      {/* Sun — visible in dark mode (switch to light) */}
      <span
        style={{
          position: "absolute",
          opacity: isDark ? 1 : 0,
          transform: isDark ? "rotate(0deg) scale(1)" : "rotate(-90deg) scale(0.4)",
          transition: "opacity 0.3s, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <SunIcon size={17} />
      </span>

      {/* Moon — visible in light mode (switch to dark) */}
      <span
        style={{
          position: "absolute",
          opacity: isDark ? 0 : 1,
          transform: isDark ? "rotate(90deg) scale(0.4)" : "rotate(0deg) scale(1)",
          transition: "opacity 0.3s, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <MoonIcon size={17} />
      </span>
    </button>
  );
}
