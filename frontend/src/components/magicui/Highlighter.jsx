/**
 * Highlighter
 * -----------
 * Wraps children with an animated highlight sweep — like a marker
 * drawing over the text. Triggers when the element enters the viewport.
 *
 * Props:
 *   color    - highlight color (default warm amber/brand)
 *   delay    - start delay in ms
 *   height   - highlight bar height in px (default 0.35em)
 *   children - text content to highlight
 *   className
 */
import { useEffect, useRef, useState } from "react";

export default function Highlighter({
  children,
  color = "rgba(128, 0, 32, 0.25)",
  delay = 400,
  height = "0.32em",
  className = "",
}) {
  const [drawn, setDrawn] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const t = setTimeout(() => setDrawn(true), delay);
          observer.disconnect();
          return () => clearTimeout(t);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <span
      ref={ref}
      className={className}
      style={{ position: "relative", display: "inline" }}
    >
      {/* Highlight bar slides in from left */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "0.05em",
          left: "-0.05em",
          right: "-0.05em",
          height,
          background: color,
          borderRadius: "2px",
          transformOrigin: "left center",
          transform: drawn ? "scaleX(1)" : "scaleX(0)",
          transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: -1,
        }}
      />
      {children}
    </span>
  );
}
