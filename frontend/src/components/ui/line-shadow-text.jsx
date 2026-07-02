import { motion } from "motion/react";

import { cn } from "../../lib/utils"

const motionElements = {
  article: motion.article,
  div: motion.div,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  h4: motion.h4,
  h5: motion.h5,
  h6: motion.h6,
  li: motion.li,
  p: motion.p,
  section: motion.section,
  span: motion.span
}

export function LineShadowText({
  children,
  shadowColor = "black",
  className,
  as: Component = "span",
  ...props
}) {
  const MotionComponent = motionElements[Component]

  return (
    <MotionComponent
      className={cn(
        "line-shadow-anim",
        className
      )}
      data-text={children}
      {...props}
      style={{
        "--shadow-color": shadowColor,
        ...(props.style || {})
      }}>
      {children}
    </MotionComponent>
  );
}
