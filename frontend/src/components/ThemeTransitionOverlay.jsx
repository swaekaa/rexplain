/**
 * ThemeTransitionOverlay
 * ----------------------
 * Creates an expanding circular "ripple" reveal animation that spreads
 * from the theme toggle button across the entire viewport.
 *
 * How it works:
 * 1. User clicks the toggle → parent calls startTransition(x, y, newTheme)
 * 2. A full-viewport element in the *new* theme color clips to a circle
 *    centered on (x, y) and expands via clip-path animation.
 * 3. Once the animation ends, the actual theme data-attribute is updated
 *    and the overlay is removed — no flash, no abrupt swap.
 *
 * Usage:
 *   const overlayRef = useRef();
 *   // In ThemeToggle onClick:
 *   overlayRef.current?.startTransition(btnX, btnY, nextTheme);
 *
 *   <ThemeTransitionOverlay ref={overlayRef} />
 */
import { useImperativeHandle, forwardRef, useRef, useCallback } from "react";

const ThemeTransitionOverlay = forwardRef(function ThemeTransitionOverlay(_, ref) {
  const divRef = useRef(null);
  const animRef = useRef(null);

  useImperativeHandle(ref, () => ({
    startTransition(x, y, newTheme, onDone) {
      const el = divRef.current;
      if (!el) { onDone?.(); return; }

      // Cancel any in-flight animation
      if (animRef.current) {
        animRef.current.cancel();
        animRef.current = null;
      }

      // Diagonal of the viewport = max radius we need
      const maxR = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      ) + 16;

      // New-theme background color
      const bgColor = newTheme === "dark" ? "#07070d" : "#f8f6ff";

      el.style.setProperty("--cx", `${x}px`);
      el.style.setProperty("--cy", `${y}px`);
      el.style.background = bgColor;
      el.style.display = "block";

      const anim = el.animate(
        [
          { clipPath: `circle(0px at ${x}px ${y}px)` },
          { clipPath: `circle(${maxR}px at ${x}px ${y}px)` },
        ],
        {
          duration: 480,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          fill: "forwards",
        }
      );

      animRef.current = anim;

      anim.onfinish = () => {
        onDone?.();
        // Brief hold so the real theme can paint underneath before we fade out
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.style.display = "none";
            try { anim.cancel(); } catch (_) {}
            animRef.current = null;
          });
        });
      };
    },
  }));

  return (
    <div
      ref={divRef}
      aria-hidden="true"
      style={{
        display: "none",
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
        willChange: "clip-path",
      }}
    />
  );
});

export default ThemeTransitionOverlay;
