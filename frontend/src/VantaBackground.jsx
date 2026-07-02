/**
 * VantaBackground — Restored & Enhanced
 * ----------------------------------------
 * Premium Vanta CLOUDS background for BOTH Light and Dark modes.
 *
 * Performance improvements:
 * - Vanta instance stored in a module-level singleton to survive React
 *   unmount/remount cycles without re-initializing the GPU effect.
 * - ResizeObserver debounced to avoid spamming canvas redraws.
 * - Theme-aware: dynamically updates Vanta options instead of destroying
 *   and recreating the WebGL context on theme toggle.
 */
import { useEffect, useRef, useState } from "react";

// Module-level singleton — survives React strict-mode double-mount
let _vantaEffect = null;
let _vantaEl = null;

export default function VantaBackground({ subtle = false }) {
  const elRef = useRef(null);
  const roRef = useRef(null);
  const roTimer = useRef(null);

  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute("data-theme") === "dark"
  );

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Watch data-theme attribute ────────────────────────────────────────────
  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    const mo = new MutationObserver(check);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => mo.disconnect();
  }, []);

  // ── Vanta init / update ────────────────────────────────────────────────
  useEffect(() => {
    if (prefersReducedMotion) return;

    // Dark mode colors (deep, rich, atmospheric)
    const darkColors = {
      skyColor: 0x07070f,
      cloudColor: 0x1b1328,
      cloudShadowColor: 0x090610,
      sunColor: 0x6a0028,
      sunGlareColor: 0x4a0b22,
      sunlightColor: 0x332a40,
    };

    // Light mode colors (original bright theme)
    const lightColors = {
      skyColor: 0xf0ecff,
      cloudColor: 0xd8b4fe,
      cloudShadowColor: 0x9333ea,
      sunColor: 0x800020,
      sunGlareColor: 0xb03060,
      sunlightColor: 0xffffff,
    };

    const currentColors = isDark ? darkColors : lightColors;

    // If already running on the same DOM element, just update colors
    if (_vantaEffect && _vantaEl === elRef.current) {
      if (typeof _vantaEffect.setOptions === 'function') {
        _vantaEffect.setOptions(currentColors);
      }
      return;
    }

    // If running on a *different* element (e.g. HMR remount), destroy first
    if (_vantaEffect) {
      _vantaEffect.destroy();
      _vantaEffect = null;
      _vantaEl = null;
    }

    let attempts = 0;
    let tid;

    const init = () => {
      if (
        typeof window.VANTA === "undefined" ||
        !window.VANTA?.CLOUDS ||
        typeof window.THREE === "undefined"
      ) {
        if (++attempts < 60) {
          tid = setTimeout(init, 150);
        } else {
          console.warn("[VantaBackground] CDN scripts failed to load.");
        }
        return;
      }
      if (!elRef.current) return;
      _vantaEl = elRef.current;
      _vantaEffect = window.VANTA.CLOUDS({
        el: _vantaEl,
        THREE: window.THREE,
        ...currentColors,
        speed: 1.2,
        zoom: 0.75,
        minWidth: 200,
        minHeight: 200,
        mouseControls: false,
        touchControls: false,
        gyroControls: false,
      });
    };

    init();

    // Debounced ResizeObserver — prevents excessive canvas redraws
    roRef.current = new ResizeObserver(() => {
      clearTimeout(roTimer.current);
      roTimer.current = setTimeout(() => {
        _vantaEffect?.resize?.();
      }, 120);
    });
    if (elRef.current) roRef.current.observe(elRef.current);

    return () => {
      clearTimeout(tid);
      clearTimeout(roTimer.current);
      roRef.current?.disconnect();
      // NOTE: we intentionally do NOT destroy _vantaEffect on unmount —
      // this lets it survive React re-renders without GPU re-init.
    };
  }, [isDark, prefersReducedMotion]);

  // ── Cleanup on final unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimeout(roTimer.current);
      roRef.current?.disconnect();
    };
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      ref={elRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        pointerEvents: "none",
        ...(prefersReducedMotion
          ? { background: isDark ? "linear-gradient(135deg, #050510 0%, #0a0a1a 40%, #100810 100%)" : "linear-gradient(135deg, #f0ecff 0%, #faf5ff 40%, #fff0f3 100%)" }
          : {}),
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: isDark
            ? (subtle ? "rgba(12,12,18,0.85)" : "rgba(12,12,18,0.25)")
            : (subtle ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.38)"),
          backdropFilter: subtle ? "blur(24px) saturate(0.3)" : "blur(1px) saturate(0.9)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
