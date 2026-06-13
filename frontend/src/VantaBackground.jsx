import { useEffect, useRef } from "react";

/**
 * VantaBackground
 * ---------------
 * Renders the Vanta.js CLOUDS animated effect as a fixed, full-viewport
 * background on the landing page.
 *
 * Props:
 *   subtle — when true, applies a strong white overlay + desaturate filter
 *            to tone down the effect on content-heavy pages (e.g. analysis view)
 *
 * Key implementation decisions:
 *   - Loaded via CDN scripts in index.html (avoids CRA webpack/CommonJS issues)
 *   - Uses `prefers-reduced-motion` to show a static CSS fallback for accessibility
 *   - ResizeObserver calls vanta.resize() to keep canvas dimensions in sync
 *   - Vanta instance destroyed on unmount to prevent GPU/memory leaks
 */
export default function VantaBackground({ subtle = false }) {
  const vantaRef = useRef(null);
  const vantaEffect = useRef(null);

  // Respect the user's OS-level motion preference
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (prefersReducedMotion) return;

    let initAttempts = 0;
    let timeoutId;

    const initVanta = () => {
      // Guard: wait until the CDN scripts have loaded the global VANTA and THREE objects
      if (typeof window.VANTA === "undefined" || !window.VANTA.CLOUDS || typeof window.THREE === "undefined") {
        initAttempts++;
        if (initAttempts < 50) { // Try for up to 5 seconds
          timeoutId = setTimeout(initVanta, 100);
        } else {
          console.warn("VantaBackground: VANTA.CLOUDS not available. CDN scripts failed to load.");
        }
        return;
      }

      // Initialise the effect if not already done
      if (!vantaEffect.current && vantaRef.current) {
        vantaEffect.current = window.VANTA.CLOUDS({
          el: vantaRef.current,
          THREE: window.THREE,

          // ----- Color palette (matches RExplain brand) -----
          skyColor: 0xf0ecff,        // very pale lavender sky
          cloudColor: 0xd8b4fe,      // soft purple clouds (matches accent-purple)
          cloudShadowColor: 0x9333ea, // deeper purple shadow
          sunColor: 0x800020,        // burgundy sun (matches accent-burgundy)
          sunGlareColor: 0xb03060,   // lighter burgundy/rose glare
          sunlightColor: 0xffffff,   // white sunlight

          // ----- Animation settings -----
          speed: 0.5,                // subtle — not distracting
          zoom: 0.75,                // pull back slightly for an airy, open feel

          // ----- Sizing -----
          minWidth: 200,
          minHeight: 200,

          mouseControls: false,      // disable mouse parallax for a calmer feel
          touchControls: false,      // no touch parallax on mobile
          gyroControls: false,       // no gyro on mobile — prevents disorientation
        });
      }
    };

    initVanta();

    // ResizeObserver keeps the canvas sized correctly when the window changes.
    // Without this, Vanta's canvas stays the initial viewport size after resize.
    const observer = new ResizeObserver(() => {
      vantaEffect.current?.resize();
    });
    if (vantaRef.current) observer.observe(vantaRef.current);

    // Cleanup on unmount — prevents GPU memory leaks
    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
      vantaEffect.current?.destroy();
      vantaEffect.current = null;
    };
  }, [prefersReducedMotion]);

  // Static fallback shown when Vanta is disabled (reduced-motion or script failure)
  const staticFallback = {
    background:
      "linear-gradient(135deg, #f0ecff 0%, #faf5ff 40%, #fff0f3 100%)",
  };

  return (
    <div
      ref={vantaRef}
      aria-hidden="true"           // decorative — no semantic meaning
      style={{
        position: "fixed",
        inset: 0,                  // top/right/bottom/left: 0
        zIndex: 0,                 // behind all content
        width: "100%",
        height: "100%",
        overflow: "hidden",
        pointerEvents: "none",     // clicks/scrolls pass straight through
        ...(prefersReducedMotion ? staticFallback : {}),
      }}
    >
      {/* Primary overlay — always present, softens raw cloud colours */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: subtle
            ? "rgba(255,255,255,0.82)"   // heavy white wash for content pages
            : "rgba(255,255,255,0.42)",  // lighter wash for landing page
          backdropFilter: subtle ? "blur(24px) saturate(0.3)" : "blur(2px) saturate(0.85)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
