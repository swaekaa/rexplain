/**
 * AnimatedList
 * ------------
 * Wraps children with staggered slide-up + fade-in entry animations.
 * Each child is animated sequentially with a configurable delay.
 */
import { useEffect, useRef, useState } from "react";

export function AnimatedListItem({ children, delay = 0, className = "" }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const timer = setTimeout(() => setVisible(true), delay);
          observer.disconnect();
          return () => clearTimeout(timer);
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

export default function AnimatedList({ children, className = "", itemDelay = 80 }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className={className}>
      {items.map((child, i) => (
        <AnimatedListItem key={i} delay={i * itemDelay}>
          {child}
        </AnimatedListItem>
      ))}
    </div>
  );
}
