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
  /**
   * The court jump (round 3, David: "jump needs to feel like a jump, and jump proper hight"): a quick push off, a short
   * hang at the top and a firm fall, high enough that a spike's hand clears the tape (the net is 2.17 u, the arms 0.83).
   * Never cut short by letting go, no apex hang, so its arc is the same every time and a press can be planned on it.
   */
  jump: { height: 1.75, apexTime: 0.44, fallGravity: 1.3 },
  /** Near the top of your own jump, with the ball close, the match slows a little (spike and block timing). */
  apexSlow: { scale: 0.62, underVy: 2.0, ballNear: 2.6, ease: 12 },
  /** Moving on sand: a gentle build-up and glide-out, a little slower than the island's walk. */
  move: { walk: 6.2, sprint: 8.6, response: 8, stop: 6 },
  /** Under this speed in a rally you shuffle in the ready stance instead of walking. */
  shuffleUnder: 1.8,
  /**
   * A press waits up to `buffer` s for the ball to reach your hands (early presses still connect, graded by how early);
   * the grade's clock: `window` s off is the worst a touch can be. A press with nothing coming is a whiff.
   */
  timing: { buffer: 0.26, window: 0.3, perfect: 0.06, good: 0.14 },
  /**
   * A press in the air (spike, jump set): it meets the ball where your jump's arc and the ball's flight come closest
   * within `buffer` s, and touches then; `lead` s before that meeting is the perfect press (the swing's wind-up). The
   * hands may be this much further than a standing touch's reach (`reach`, `band`): the arms stretch for it.
   */
  air: { buffer: 0.42, lead: 0.08, reach: 0.4, band: 0.25 },
  /** Arms over the net: how long, how near the net a jump must be for it to count, the box's half width and height over the hands. */
  block: { time: 0.6, nearNet: 2.0, halfWidth: 0.85, over: 0.5 },
  /**
   * The dive (Q only, round 3, David: "dont do crtl and just do a dive qith q ... it should feel nice and clutch"): a lunge
   * slower than the old dash that steers itself onto a ball within `assist` u and `cone` rad of where you pushed, digs it
   * anywhere along the lunge within `reach`/`band`, and always pops it up playable (`floor` quality).
   */
  dive: { speed: 7.6, time: 0.55, down: 0.8, reach: 1.25, band: 0.6, assist: 3.8, cone: 1.3, floor: 0.5 },
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
