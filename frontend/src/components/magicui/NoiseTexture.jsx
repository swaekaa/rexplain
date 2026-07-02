/**
 * NoiseTexture
 * -----------
 * Renders a subtle full-viewport noise texture overlay.
 * Only visible in dark mode — adds premium AI/SaaS texture.
 *
 * Implementation: CSS-based SVG filter noise (no canvas, no deps).
 * Performance: single div with CSS filter, no JS animation loop.
 */
import { useEffect, useState } from "react";

export default function NoiseTexture({ opacity = 0.04, className = "" }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () =>
      setIsDark(
        document.documentElement.getAttribute("data-theme") === "dark"
      );
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  if (!isDark) return null;

  return (
    <>
      {/* SVG filter definition */}
      <svg
        aria-hidden="true"
        style={{ position: "fixed", width: 0, height: 0, top: 0, left: 0, pointerEvents: "none" }}
      >
        <defs>
          <filter id="rexplain-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
      </svg>

      {/* Noise overlay */}
      <div
        aria-hidden="true"
        className={className}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          filter: "url(#rexplain-noise)",
          opacity,
          mixBlendMode: "overlay",
        }}
      />
    </>
  );
}
