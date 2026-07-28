/**
 * gullPath — the seagull's flight, as one pure function.
 *
 * David, 2026-07-28: "seagull should fly in an organic path that is similar to a
 * circle but more organic, the bank is on the wrong axis currently it banks
 * upwards."
 *
 * ── ORGANIC ─────────────────────────────────────────────────────────────
 * A circle is `(cos a, sin a) * r` with r constant, and it reads as machinery
 * because it retraces itself exactly. Three things break that here, and all of
 * them use frequencies that are mutually irrational multiples, so the path never
 * closes and never repeats:
 *
 *   · the radius BREATHES  — two sine terms at 1.7x and 2.63x the orbit rate,
 *     so the loop is an ellipse that keeps changing which way it is squashed
 *   · the centre DRIFTS    — slow wander at 0.13 and 0.11 Hz, so successive
 *     laps are laid down in slightly different places
 *   · the altitude uses two terms rather than one, for the same reason
 *
 * ── BANKING ─────────────────────────────────────────────────────────────
 * The old code set a constant `rotation.z` and called it bank. Two things were
 * wrong. First the axis: the model's WINGSPAN measures 9.31 along X and its BODY
 * 5.55 along Z, so its forward is Z — but a `-90°` yaw was baked onto the body,
 * which turned forward into -X in the parent's frame, and rotating about Z then
 * pitches the nose up instead of rolling. That is the "banks upwards" report.
 * The yaw hack is gone and the parent uses Euler order YXZ, so `rotation.z` is
 * applied innermost, about the body's own forward axis, which is roll.
 *
 * Second, a constant lean is not banking. A bird rolls INTO a turn, by an amount
 * that follows how hard it is turning. So heading and roll are both DERIVED from
 * the path by sampling it slightly ahead — which also means the bird stays
 * pointed along its actual velocity however much the path is deformed above,
 * instead of along the parametric angle it would have had on a clean circle.
 */

export interface GullParams {
  /** Orbit centre. */
  anchorX: number;
  anchorZ: number;
  /** Base radians/sec around the anchor. */
  speed: number;
  /** Base orbit radius, world units. */
  radius: number;
  /** Base height. */
  altitude: number;
  /** Amplitude of the slow altitude rise and fall. */
  bob: number;
  /** Radius variation, as a fraction of `radius`. 0 is a true circle. */
  wobble: number;
  /** How far the orbit centre wanders, world units. */
  drift: number;
  /** Per-bird phase offset so a flock does not fly in formation. */
  phase: number;
}

export interface GullPose {
  x: number;
  y: number;
  z: number;
  /** Rotation about Y that points the model's +Z forward along its velocity. */
  yaw: number;
  /** Roll about the forward axis, radians. Positive leans into a left turn. */
  roll: number;
}

/** Position only. Exported so callers can sample ahead without a full pose. */
export function gullPosition(t: number, p: GullParams, out: { x: number; y: number; z: number }): void {
  const a = t * p.speed + p.phase;
  // Irrational-ish multiples of the orbit rate: the sum has no common period,
  // so the loop never lands on its own tail.
  const r = p.radius * (1 + p.wobble * (Math.sin(a * 1.7 + p.phase) * 0.62 + Math.sin(a * 2.63) * 0.38));
  const cx = p.anchorX + p.drift * Math.sin(t * 0.13 + p.phase);
  const cz = p.anchorZ + p.drift * Math.cos(t * 0.11 + p.phase * 1.7);
  out.x = cx + Math.cos(a) * r;
  out.z = cz + Math.sin(a) * r;
  out.y = p.altitude + p.bob * (Math.sin(t * 0.35 + p.phase) * 0.7 + Math.sin(t * 0.83) * 0.3);
}

const _here = { x: 0, y: 0, z: 0 };
const _ahead = { x: 0, y: 0, z: 0 };
const _far = { x: 0, y: 0, z: 0 };

/** How far ahead to sample when deriving heading. Seconds. */
const LOOKAHEAD = 0.08;

/**
 * Full pose at time `t`.
 *
 * `bankGain` converts turn rate (rad/sec of heading change) into roll, and
 * `maxBank` clamps it — a gull leans, it does not barrel-roll.
 */
export function gullPose(t: number, p: GullParams, bankGain: number, maxBank: number): GullPose {
  gullPosition(t, p, _here);
  gullPosition(t + LOOKAHEAD, p, _ahead);
  gullPosition(t + LOOKAHEAD * 2, p, _far);

  // The model's forward is +Z, so this is the yaw that maps +Z onto velocity.
  const yaw = Math.atan2(_ahead.x - _here.x, _ahead.z - _here.z);
  const yawAhead = Math.atan2(_far.x - _ahead.x, _far.z - _ahead.z);

  // Shortest signed angular difference — without the wrap the bird snaps to a
  // hard opposite roll once per lap as the heading crosses ±π.
  let d = yawAhead - yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;

  const turnRate = d / LOOKAHEAD;
  const roll = Math.max(-maxBank, Math.min(maxBank, turnRate * bankGain));

  return { x: _here.x, y: _here.y, z: _here.z, yaw, roll };
}
