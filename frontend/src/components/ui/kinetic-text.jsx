import React from "react"

import { cn } from "../../lib/utils"

export function KineticText({
  text,
  as: Tag = "h1",
  className = "",
  style,
  ...rest
}) {
  const mergedStyle = {
    "--hover-padding": "calc(1em / 12)",
    "--text-stroke-width": "calc(1em * 125 / 6000)",
    ...(style)
  }

  return (
    <Tag
      {...rest}
      className={cn("flex flex-wrap [font-variation-settings:'wght'_300]", className)}
      style={mergedStyle}>
      {text.split("").map((letter, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="[will-change:font-variation-settings,-webkit-text-stroke-width,padding] [-webkit-text-stroke-color:transparent] [-webkit-text-stroke-width:var(--text-stroke-width)] transition-all duration-500 ease-[cubic-bezier(0.2,1,0.2,1)] hover:[padding-inline:var(--hover-padding)] hover:[font-variation-settings:'wght'_900] hover:[-webkit-text-stroke-color:currentcolor] hover:[-webkit-text-stroke-width:calc(var(--text-stroke-width)*2)] has-[+span+span:hover]:[font-variation-settings:'wght'_400] has-[+span:hover]:[padding-inline:var(--hover-padding)] has-[+span:hover]:[font-variation-settings:'wght'_600] [:hover+&]:[padding-inline:var(--hover-padding)] [:hover+&]:[font-variation-settings:'wght'_600] [:hover+span+&]:[font-variation-settings:'wght'_400]">
          {letter === " " ? "\u00A0" : letter}
        </span>
      ))}
      <span className="sr-only">{text}</span>
    </Tag>
  );
}
