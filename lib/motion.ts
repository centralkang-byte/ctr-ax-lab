// Shared motion vocabulary for the Hairline/Swiss redesign.
//
// One place for the entrance/stagger variants so every surface animates the
// same way. `motion` (the framer-motion successor) already honors the OS
// reduced-motion setting when you read it via `useReducedMotion`; the helpers
// below collapse to instant, no-transform variants in that case so layout is
// never affected.

import type { Variants } from "motion/react";

export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

// A single item rising into place (opacity + small upward translate).
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: EASE_OUT },
  },
};

// Parent that reveals its children one after another. Use with `fadeRise`
// children and `initial="hidden" animate="show"`.
export const staggerContainer = (stagger = 0.06, delay = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

// Reduced-motion-safe variants: when `reduce` is true, children just appear.
export function fadeRiseFor(reduce: boolean): Variants {
  if (reduce) {
    return { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } };
  }
  return fadeRise;
}
