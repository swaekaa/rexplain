/**
 * ProgressiveBlur
 * ---------------
 * A subtle gradient fade that makes content dissolve into the background.
 * Works by overlaying a gradient that goes from transparent to the current
 * page background color — creating the illusion of content fading out.
 *
 * This is the correct approach for non-backdrop-filter blur effects.
 * It reads the --bg-page CSS variable so it adapts to light/dark themes.
 *
 * Props:
 *   direction  - "bottom" | "top" | "left" | "right" (default: "bottom")
 *   size       - height/width of the fade zone in px (default: 140)
 *   strength   - opacity of the fade (0-1, default: 1)
 *   className  - additional CSS classes for positioning
 *   zIndex     - (default: 10)
 *
 * Usage:
 *   <div style={{ position: 'relative' }}>
 *     ...content...
 *     <ProgressiveBlur direction="bottom" size={160} />
 *   </div>
 */
import { useEffect, useState } from "react";

export default function ProgressiveBlur({
  direction = "bottom",
  size = 140,
  strength = 1,
  className = "",
  zIndex = 10,
  style = {},
}) {
  // Read the current --bg-page color reactively (theme changes update it)
  const [bgColor, setBgColor] = useState("transparent");

  useEffect(() => {
    const read = () => {
      const val = getComputedStyle(document.documentElement)
        .getPropertyValue("--bg-page")
        .trim();
      // CSS variable might return a raw hex, rgb(), or 'transparent'
      setBgColor(val || "transparent");
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => mo.disconnect();
  }, []);

  const axis = "to " + direction;
  // We use both a subtle background fade and an intense blur mask
  const bgGradient = `linear-gradient(${axis}, transparent 0%, ${bgColor} 100%)`;
  const maskGradient = `linear-gradient(${axis}, transparent 0%, black 100%)`;

  const sizeStyle =
    direction === "bottom" || direction === "top"
      ? { height: size }
      : { width: size };

  const posStyle = {
    bottom: { bottom: 0, left: 0, right: 0 },
    top:    { top: 0,    left: 0, right: 0 },
    left:   { top: 0, left: 0,  bottom: 0 },
    right:  { top: 0, right: 0, bottom: 0 },
  }[direction];

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        ...posStyle,
        ...sizeStyle,
        background: bgGradient,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        maskImage: maskGradient,
        WebkitMaskImage: maskGradient,
        opacity: strength,
        pointerEvents: "none",
        zIndex,
        ...style,
      }}
    />
  );
}
