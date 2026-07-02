import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

const SYMBOLS = "!@#$%^&*+-=/?_[]{}<>0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function CodeTypeAnimation({
  text,
  scrambleDurationMin = 150,
  scrambleDurationMax = 250,
  cursorBlinkSpeed = 500,
  loop = false,
  className,
  as: Tag = "span",
  ...props
}) {
  const [resolvedLength, setResolvedLength] = useState(0);
  const [scrambleChar, setScrambleChar] = useState("");
  const [cursorVisible, setCursorVisible] = useState(true);

  // Cursor blink
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible(v => !v);
    }, cursorBlinkSpeed);
    return () => clearInterval(interval);
  }, [cursorBlinkSpeed]);

  // Typing logic
  useEffect(() => {
    let scrambleInterval;
    let typeTimeout;

    // Small initial pause before typing starts
    if (resolvedLength === 0) {
      typeTimeout = setTimeout(() => {
        setResolvedLength(1); // triggers the first character
      }, 300);
      return () => clearTimeout(typeTimeout);
    }

    const currentIndex = resolvedLength - 1;

    if (currentIndex < text.length) {
      // Skip scrambling for spaces
      if (text[currentIndex] === ' ') {
        setResolvedLength(prev => prev + 1);
        return;
      }

      // Random scramble duration per character between 150-250ms
      const scrambleDuration = Math.floor(
        Math.random() * (scrambleDurationMax - scrambleDurationMin + 1)
      ) + scrambleDurationMin;

      // Start cycling symbols rapidly (every 30ms)
      scrambleInterval = setInterval(() => {
        setScrambleChar(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
      }, 30);

      // Resolve the character
      typeTimeout = setTimeout(() => {
        setResolvedLength(prev => prev + 1);
        setScrambleChar("");
      }, scrambleDuration);
    } else {
      // Finished
      if (loop) {
        typeTimeout = setTimeout(() => {
          setResolvedLength(0);
        }, 3000);
      }
    }

    return () => {
      clearInterval(scrambleInterval);
      clearTimeout(typeTimeout);
    };
  }, [resolvedLength, text, scrambleDurationMin, scrambleDurationMax, loop]);

  const resolvedText = resolvedLength > 0 ? text.substring(0, resolvedLength - 1) : "";
  const isScrambling = resolvedLength > 0 && resolvedLength <= text.length;

  const handleMouseEnter = (e) => {
    // Only re-trigger if the animation is fully finished
    if (resolvedLength > text.length) {
      setResolvedLength(0);
    }
    if (props.onMouseEnter) {
      props.onMouseEnter(e);
    }
  };

  return (
    <Tag 
      className={cn("font-jetbrains tracking-[0.04em]", className)} 
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {resolvedText}
      {isScrambling && text[resolvedLength - 1] !== ' ' && (
        <span>{scrambleChar}</span>
      )}
      {resolvedLength <= text.length && (
        <span 
          style={{ opacity: cursorVisible ? 1 : 0, transition: 'opacity 0.1s' }}
          className="ml-[0.02em] font-normal"
        >
          |
        </span>
      )}
    </Tag>
  );
}
