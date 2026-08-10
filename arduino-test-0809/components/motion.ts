import type { Transition, Variants } from 'framer-motion';

/**
 * Shared motion vocabulary. Keeping every spring in one place is what stops an
 * app feeling like six different apps — a card, a sheet and a page all settle
 * with the same physics.
 *
 * Framer Motion respects prefers-reduced-motion through useReducedMotion();
 * globals.css also flattens CSS transitions for the same users.
 */

export const spring: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 };
export const softSpring: Transition = { type: 'spring', stiffness: 260, damping: 30 };
export const ease: Transition = { duration: 0.22, ease: [0.22, 0.61, 0.36, 1] };

/** Page-level fade + lift, used by the route transition wrapper. */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { ...ease, staggerChildren: 0.045, delayChildren: 0.02 } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.14 } },
};

/** Children of a staggered page section. */
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: ease },
  exit: { opacity: 0, y: -6, transition: { duration: 0.12 } },
};

/** List rows that can be added and removed (threads, steps, protocols). */
export const rowVariants: Variants = {
  hidden: { opacity: 0, height: 0 },
  show: { opacity: 1, height: 'auto', transition: softSpring },
  exit: { opacity: 0, height: 0, transition: { duration: 0.16 } },
};

export const scrimVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.16 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

export const sheetVariants: Variants = {
  hidden: { y: '100%', opacity: 0.6 },
  show: { y: 0, opacity: 1, transition: spring },
  exit: { y: '100%', opacity: 0.6, transition: { duration: 0.18 } },
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring },
  exit: { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.14 } },
};

export const tapScale = { scale: 0.97 };
