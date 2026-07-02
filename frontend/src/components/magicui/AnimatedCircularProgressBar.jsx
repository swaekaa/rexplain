/**
 * AnimatedCircularProgressBar
 * ---------------------------
 * SVG circle with stroke-dashoffset animation.
 * Smoothly animates from 0 → value on mount.
 *
 * Props:
 *   value    - 0–100 completion percentage
 *   size     - diameter in px (default 80)
 *   stroke   - stroke width (default 6)
 *   color    - stroke color (default accent purple)
 *   trackColor - track ring color
 *   label    - center text (defaults to "{value}%")
 *   animate  - whether to animate (default true)
 *   duration - animation duration in ms (default 1500)
 */
import { useEffect, useRef, useState } from "react";

export default function AnimatedCircularProgressBar({
  value = 0,
  size = 80,
  stroke = 6,
  color = "#a855f7",
  trackColor = "rgba(168,85,247,0.12)",
  label,
  animate = true,
  duration = 1500,
  className = "",
}) {
  const [displayed, setDisplayed] = useState(animate ? 0 : value);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!animate) { setDisplayed(value); return; }
    const start = performance.now();
    const from = 0;

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + (value - from) * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, animate, duration]);

  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (displayed / 100) * circumference;

  return (
    <div
      className={className}
      style={{ position: "relative", width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.05s linear" }}
        />
      </svg>
      {/* Center label */}
      <span
        style={{
          position: "absolute",
          fontSize: size * 0.2,
          fontWeight: 700,
          color,
          fontFamily: "Manrope, Inter, sans-serif",
          letterSpacing: "-0.02em",
        }}
      >
        {label !== undefined ? label : `${displayed}%`}
      </span>
    </div>
  );
}
