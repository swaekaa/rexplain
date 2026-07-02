/**
 * NoiseBackground
 * ---------------
 * Replaces VantaBackground. Zero external dependencies.
 *
 * Light mode: soft lavender-to-white gradient (preserves existing feel)
 * Dark mode:  deep dark gradient + subtle noise texture overlay
 *
 * Props:
 *   subtle — when true (loading/analysis pages), tones down the effect
 */
import { useEffect, useState } from "react";
import NoiseTexture from "./components/magicui/NoiseTexture";

export default function NoiseBackground({ subtle = false }) {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute("data-theme") === "dark"
  );

  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  // Respect reduced-motion preference — no animations
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Background gradient ──────────────────────────────────────────────────────
  const lightGradient = subtle
    ? "linear-gradient(135deg, #f5f3ff 0%, #fafafa 40%, #fff0f3 100%)"
    : "linear-gradient(135deg, #f0ecff 0%, #faf5ff 50%, #fff0f3 100%)";

  const darkGradient = subtle
    ? "linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 50%, #100810 100%)"
    : "linear-gradient(135deg, #07070d 0%, #0c0c1e 40%, #100610 80%, #0e080e 100%)";

  const gradient = isDark ? darkGradient : lightGradient;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          background: gradient,
          transition: prefersReducedMotion ? "none" : "background 0.5s ease",
          pointerEvents: "none",
        }}
      >
        {/* Subtle animated orbs — light mode only, disabled if subtle */}
        {!isDark && !subtle && !prefersReducedMotion && (
          <>
            <div
              style={{
                position: "absolute",
                top: "10%",
                left: "15%",
                width: 400,
                height: 400,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)",
                animation: "liquidPulse 8s ease-in-out infinite",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "15%",
                right: "10%",
                width: 320,
                height: 320,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(128,0,32,0.06) 0%, transparent 70%)",
                animation: "liquidPulse 10s ease-in-out 2s infinite",
                pointerEvents: "none",
              }}
            />
          </>
        )}

        {/* Dark mode: accent glow orbs */}
        {isDark && !subtle && !prefersReducedMotion && (
          <>
            <div
              style={{
                position: "absolute",
                top: "8%",
                left: "10%",
                width: 500,
                height: 500,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)",
                animation: "liquidPulse 10s ease-in-out infinite",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "10%",
                right: "8%",
                width: 400,
                height: 400,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(128,0,32,0.05) 0%, transparent 70%)",
                animation: "liquidPulse 12s ease-in-out 3s infinite",
                pointerEvents: "none",
              }}
            />
          </>
        )}
      </div>

      {/* Noise texture overlay (dark mode only) */}
      <NoiseTexture opacity={0.04} />
    </>
  );
}
