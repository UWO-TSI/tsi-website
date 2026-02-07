/**
 * Tethos — Shared Motion System
 *
 * Cinematic, smooth, no bounce, no cartoon easing.
 * Import these presets everywhere for consistency.
 */

// ============================================
// GSAP EASING PRESETS
// ============================================

/** Smooth cinematic ease — primary for most transitions */
export const EASE_CINEMATIC = "power3.inOut";

/** Softer ease for subtle reveals */
export const EASE_SMOOTH = "power2.out";

/** Sharp entrance — elements appearing */
export const EASE_ENTER = "power3.out";

/** Gentle exit — elements disappearing */
export const EASE_EXIT = "power2.inOut";

/** Linear — for scrub-linked scroll animations */
export const EASE_LINEAR = "none";

// ============================================
// DURATION PRESETS (seconds)
// ============================================

/** Fast micro-interactions (hover, tap feedback) */
export const DURATION_MICRO = 0.2;

/** Standard element transitions */
export const DURATION_NORMAL = 0.6;

/** Section-level transitions (scroll reveals) */
export const DURATION_SECTION = 0.9;

/** Page-level transitions (loading, route changes) */
export const DURATION_PAGE = 1.2;

/** Slow cinematic reveals */
export const DURATION_CINEMATIC = 1.8;

// ============================================
// FRAMER MOTION SPRING PRESETS
// ============================================

/** Smooth spring — no bounce, cinematic settle */
export const SPRING_SMOOTH = {
  type: "spring" as const,
  stiffness: 120,
  damping: 20,
  mass: 0.8,
};

/** Responsive spring — quick with subtle settle */
export const SPRING_RESPONSIVE = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.5,
};

/** Heavy spring — large elements, slow settle */
export const SPRING_HEAVY = {
  type: "spring" as const,
  stiffness: 80,
  damping: 25,
  mass: 1.2,
};

// ============================================
// FRAMER MOTION TRANSITION PRESETS
// ============================================

/** Standard fade transition */
export const TRANSITION_FADE = {
  duration: DURATION_NORMAL,
  ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number], // cubic-bezier smooth
};

/** Section reveal transition */
export const TRANSITION_REVEAL = {
  duration: DURATION_SECTION,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number], // expo out
};

/** Cinematic page transition */
export const TRANSITION_CINEMATIC = {
  duration: DURATION_CINEMATIC,
  ease: [0.76, 0, 0.24, 1] as [number, number, number, number], // smooth in-out
};

// ============================================
// SCROLL TRIGGER DEFAULTS
// ============================================

/** Default scrub value for scroll-linked animations */
export const SCRUB_DEFAULT = 1;

/** Tight scrub for immediate response */
export const SCRUB_TIGHT = 0.3;

// ============================================
// STAGGER PRESETS (seconds between each element)
// ============================================

export const STAGGER_FAST = 0.06;
export const STAGGER_NORMAL = 0.12;
export const STAGGER_SLOW = 0.2;

// ============================================
// ANIMATION VARIANT FACTORIES (Framer Motion)
// ============================================

/** Fade up reveal — common scroll-triggered entrance */
export const fadeUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * STAGGER_NORMAL,
      ...TRANSITION_REVEAL,
    },
  }),
};

/** Fade in — simple opacity entrance */
export const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: TRANSITION_FADE,
  },
};

/** Scale up — card entrance */
export const scaleUpVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * STAGGER_NORMAL,
      ...TRANSITION_REVEAL,
    },
  }),
};
