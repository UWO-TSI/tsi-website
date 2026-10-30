/**
 * The match's feel in one place (David's phase 1 review, 2026-10-30): "the ball should move slow mo and pick up pace
 * slowly as the game goes on", "jumping is higher and slowmo", "the game should feel smoother", "every hit the ball
 * squish a lil like proper ball physics". Every number a playtest would tune is here; the engine (match.ts, ball.ts)
 * and the view (VolleyMatch.tsx) read them. Pure data.
 */
export const VB_FEEL = {
  /**
   * The ball's clock against the players' (1 = the real-pace physics). It starts slow and quickens with every touch in
   * a rally and a little with every point played, up to `max`; a serve starts each rally back at the match's floor.
   */
  pace: { start: 0.52, perTouch: 0.035, perPoint: 0.006, max: 0.9 },
  /** The court jump: higher and floatier than the island's (the net grew too), never cut short by letting go. */
  jump: { height: 2.05, apexTime: 0.48, fallGravity: 1.12 },
  /** Near the top of your own jump, with the ball close, the whole match slows to this (spike and block timing). */
  apexSlow: { scale: 0.45, underVy: 2.2, ballNear: 3.2, ease: 10 },
  /** Moving on sand: a gentle build-up and glide-out, a little slower than the island's walk. */
  move: { walk: 6.2, sprint: 8.6, response: 8, stop: 6 },
  /** Under this speed in a rally you shuffle in the ready stance instead of walking. */
  shuffleUnder: 2.6,
  /**
   * A press waits up to `buffer` s for the ball to reach your hands (early presses still connect, graded by how early);
   * the grade's clock: `window` s off is the worst a touch can be. A press with nothing coming is a whiff.
   */
  timing: { buffer: 0.26, window: 0.3, perfect: 0.06, good: 0.14 },
  /** Arms over the net: how long, how near the net a jump must be for it to count, and the box's width. */
  block: { time: 0.6, nearNet: 1.6, halfWidth: 0.7 },
  /** Squash and stretch on every touch (view only): how much, how long; and the stretch along a fast flight. */
  squash: { amount: 0.3, time: 0.2, stretchPerSpeed: 0.012, stretchMax: 0.18 },
  /** The serve: max power (the meter's top) is rewarded; the ring's click sets the direction; the contact point curves. */
  serve: {
    /** The meter at or over this on release is a max-power toss: a "Max" burst and a harder serve. */
    maxPower: 0.94, maxBonus: 1.18,
    /** A click at the ring's edge moves the target this far across and along (in units). */
    ringAcross: 3.2, ringDeep: 2.4,
    /** The contact point (−1..1 on the ball): the curve's sideways pull and the top/back spin's extra drop (u/s², ball time). */
    curve: 9, topspin: 7,
  },
} as const;

/** The ball's pace for a touch: the rally's touches and the points played so far. */
export function paceFor(rallyTouches: number, pointsPlayed: number): number {
  const p = VB_FEEL.pace;
  return Math.min(p.max, p.start + p.perTouch * rallyTouches + p.perPoint * pointsPlayed);
}
