/**
 * KineticText
 * -----------
 * Animates text word-by-word (or char-by-char) with a spring-like
 * reveal effect. Each token fades in and slides up from a slight offset.
 *
 * Props:
 *   text     - string to animate
 *   by       - "word" (default) | "char"
 *   delay    - base delay in ms before animation starts (default 0)
 *   stagger  - delay between tokens in ms (default 60)
 *   as       - HTML element or component to render (default "span")
 *   className - CSS classes on the wrapper
 *   tokenClass - CSS classes on each token span
 */
import { useEffect, useState } from "react";

export default function KineticText({
  text = "",
  by = "word",
  delay = 0,
  stagger = 60,
  as: Component = "span",
  className = "",
  tokenClass = "",
}) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const tokens = by === "char"
    ? text.split("")
    : text.split(" ");

  return (
    <Component className={className} aria-label={text}>
      {tokens.map((token, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={tokenClass}
          style={{
            display: "inline-block",
            opacity: started ? 1 : 0,
            transform: started ? "translateY(0) rotateX(0deg)" : "translateY(16px) rotateX(20deg)",
            transition: `opacity 0.5s ease ${i * stagger}ms, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${i * stagger}ms`,
            willChange: "opacity, transform",
          }}
        >
          {token}
          {by === "word" && i < tokens.length - 1 ? "\u00A0" : ""}
        </span>
      ))}
    </Component>
  );
}
