/**
 * AnimatedBeam
 * ------------
 * Draws an animated SVG beam (dashed line that flows) between two
 * referenced DOM elements. Great for pipeline / flow diagrams.
 *
 * Usage:
 *   const fromRef = useRef(null);
 *   const toRef   = useRef(null);
 *   const containerRef = useRef(null);
 *
 *   <div ref={containerRef} style={{ position: 'relative' }}>
 *     <div ref={fromRef}>Source</div>
 *     <div ref={toRef}>Target</div>
 *     <AnimatedBeam containerRef={containerRef} fromRef={fromRef} toRef={toRef} />
 *   </div>
 */
import { useEffect, useRef, useState } from "react";

function getCenter(el, container) {
  const er = el.getBoundingClientRect();
  const cr = container.getBoundingClientRect();
  return {
    x: er.left - cr.left + er.width / 2,
    y: er.top - cr.top + er.height / 2,
  };
}

export default function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  color = "#a855f7",
  width = 2,
  dasharray = "6 4",
  duration = 2,
  curvature = 0.3,
  reverse = false,
  className = "",
}) {
  const [path, setPath] = useState("");
  const svgRef = useRef(null);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current || !fromRef.current || !toRef.current) return;
      const from = getCenter(fromRef.current, containerRef.current);
      const to = getCenter(toRef.current, containerRef.current);
      const dx = to.x - from.x;
      const cy = curvature * Math.abs(dx);
      setPath(
        `M ${from.x},${from.y} C ${from.x + dx * 0.4},${from.y - cy} ${from.x + dx * 0.6},${to.y + cy} ${to.x},${to.y}`
      );
    };

    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [containerRef, fromRef, toRef, curvature]);

  if (!path) return null;

  const gradId = `beam-grad-${Math.random().toString(36).slice(2)}`;

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="50%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Static track */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeOpacity="0.15"
        strokeWidth={width}
        strokeDasharray={dasharray}
      />

      {/* Animated beam */}
      <path
        d={path}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={width + 1}
        strokeLinecap="round"
        strokeDasharray="20 200"
        strokeDashoffset={reverse ? "0" : "220"}
      >
        <animate
          attributeName="stroke-dashoffset"
          from={reverse ? "220" : "0"}
          to={reverse ? "0" : "220"}
          dur={`${duration}s`}
          repeatCount="indefinite"
          calcMode="linear"
        />
      </path>
    </svg>
  );
}
