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
  style = {},
}) {
  const tokens = by === "char"
    ? text.split("")
    : text.split(" ");

  return (
    <Component className={className} style={style} aria-label={text}>
      {tokens.map((token, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={tokenClass}
          style={{
            display: "inline-block",
            opacity: 0,
            animation: `kineticReveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
            animationDelay: `${delay + i * stagger}ms`,
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
