/**
 * Movement simulation (rows 243, 244; specs/movement.md). One pure fixed-step
 * function, `stepMove(state, input, dt, world, tuning) → state`, owns walking,
 * sprint momentum, jumps (variable height, coyote time, buffering, apex hang),
 * the held bunny-hop, the long jump, the Q dash, skids, ledge grabs and mantles,
 * falls, landing rolls and the water rule. The renderer interpolates between
 * steps and plays each step's `events` (dust, thumps, clips) on the avatar that
 * moved (look spec §7.1); the same function can later drive multiplayer
 * prediction, since nothing here reads a clock, the camera or the DOM.
 *
 * The world is two queries. `top(x, z)` is the highest thing at a point: the
 * ground (ramps and blended half steps included), a prop's top, or Infinity for
 * a building or trunk. `wet(x, z)` is water with no land: a wall on foot, a
 * splash from the air that puts you back where you last stood (swimming is a
 * later unlock, row 245). With `glider` on (the leaf glider, specs/glider.md)
 * a fresh Space press while falling opens a slow, steerable glide that always
 * sets you down softly. The body is a 0.2-radius column sampled at nine
 * points, the walker's clearance probes, and no step ends with more of it
 * inside something than it started with, so nothing can leave it stuck.
 *
 * Crouch and the slide (row 274, specs/movement-slide.md): the crouch key
 * (`sneak`) held at a walk or slower crouch-walks at sneak speed; held faster
 * than a walk it slides, low friction, pushed along by the ground's slope. Speed
 * is momentum (David, 2026-10-01): kept through the air and every tech link (a
 * dash, a slide, a jump, a land into a slide or a hop), lost only on plain
 * ground once a short grace runs out, and never past a ceiling for long.
 */

export interface MoveWorld {
  top(x: number, z: number): number;
  wet(x: number, z: number): boolean;
}

/** Every feel value, in world units (1 tile) and seconds; /lab/move tunes them live. */
export const MOVE_TUNING = {
  walkSpeed: 7.4, // today's walk (refinement 2026-07-22)
  sneakSpeed: 2.2, // today's C: 0.3 × walk
  sprintSpeed: 12,
  sprintBuild: 0.9, // seconds from walk to sprint speed
  groundResponse: 12, // up to walk speed, as today (~80 ms)
  stopResponse: 7.5, // glide-out on release, as today (~130 ms)
  overspeedDecay: 18, // u/s² momentum bleeds back to a run or walk on plain ground, once the grace is over (David: quick and readable)
  turnAtSpeed: 7, // heading ease above walk speed (1/s): wider turns when fast
  skidSpeed: 6,
  skidAngle: 120, // degrees between travel and input that start a skid
  skidDecel: 40,
  jumpHeight: 0.95,
  jumpApexTime: 0.22,
  fallGravity: 1.5, // gravity multiplier after the apex
  jumpCutGravity: 2.4, // multiplier while rising with the button released
  apexHangSpeed: 1.4, // |vy| under which gravity eases while the button is held
  apexHangGravity: 0.5,
  maxFallSpeed: 18,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  airControl: 0.35, // fraction of the ground response in the air
  hopBoost: 0.7, // speed each held hop adds (row 249: hold Space while sprinting to bunny-hop)
  hopChainMax: 3, // hops that add speed; 0 turns the bunny-hop off
  longJumpAt: 0.92, // fraction of sprint speed where a jump becomes a long jump
  longJumpHeight: 0.5,
  longJumpApexTime: 0.18,
  longJumpBoost: 1.06,
  dashSpeed: 18, // at the press: the burst
  dashTime: 0.2,
  dashExit: 0.9, // fraction of the burst it eases out to: momentum that persists while you chain (16.2 u/s)
  dashEase: 2, // how it eases out: 0 holds the burst then drops to the exit (the first cut), 2 settles smoothly
  dashCooldown: 0.5, // from the press
  airDashes: 1,
  airDashLift: 2, // u/s up at an air dash's start, easing to an apex at its end
  dashJumpWindow: 0.12,
  grabReach: 1.15, // how far above the feet a ledge can be caught
  grabRise: 3, // caught only once rising slower than this (u/s)
  mantleTime: 0.32, // a full 1.5u cliff; lower ledges are quicker
  rollDrop: 1.2,
  rollSpeed: 5,
  rollTime: 0.36,
  recoverDrop: 2.6,
  recoverTime: 0.28,
  stepUp: 0.3,
  // The leaf glider (specs/glider.md): 1 = owned and allowed here; 0 is the kit without it, exactly.
  glider: 0,
  glideSpeed: 8, // the speed a held stick eases toward
  glideEase: 4, // how fast the speed you opened with eases to it (1/s)
  glideSink: 2.1, // u/s down, never up: a jump off a 1.5u cliff glides about 12 tiles
  glideOpen: 8, // how fast the fall brakes to the sink as the leaf opens (1/s)
  glideTurn: 2.5, // heading ease toward the stick (1/s)
  // Momentum (David, 2026-10-01): kept in the air and through every tech link; plain ground bleeds it after a grace.
  keepGrace: 0.12, // seconds plain ground holds momentum after a landing, a dash or a slide, so a late slide or jump still catches it
  momentumCeiling: 18, // u/s the tech reaches on flat ground; more only downhill
  downhillCeiling: 10, // the ceiling rises by this × the slope (its sine) going downhill
  ceilingBleed: 30, // u/s² a slide over the ceiling bleeds
  techBoost: 0.4, // a land into a slide or a slide-jump adds this, up to the ceiling: chains never stack fast
  // The slide (row 274): the crouch key at speed.
  slideEnterAt: 1.12, // × walk: crouch at this speed or faster drops into a slide (8.3 u/s)
  slideEndAt: 1, // × walk: a slide slowing to this stands up (into the crouch while held)
  slideFriction: 3.5, // u/s² on flat ground: a slide from a sprint lasts about 1.3 s
  slideSlope: 20, // u/s² along the slope × its sine: faster downhill, slower uphill
  slideTurn: 2.2, // heading ease toward the stick (1/s): gentle
  slideJumpHeight: 0.55, // a slide-jump: lower and longer than a jump
  slideJumpApexTime: 0.22,
};
export type MoveTuning = typeof MOVE_TUNING;
/** The bunny-hop's cap: a long jump plus a full chain of held hops. Past it only tech carries speed, up to `momentumCeiling`. */
export const topSpeed = (t: MoveTuning) => t.sprintSpeed * t.longJumpBoost + t.hopChainMax * t.hopBoost;

export type MoveMode = "ground" | "air" | "skid" | "roll" | "recover" | "mantle" | "splash" | "glide" | "slide";
/**
 * `glide` opens the leaf; `furl` closes it, whatever ended the glide (let go, landed, a ledge, water). A slide starts
 * as `slide` (from the ground), `dashslide` (out of a dash) or `landslide` (out of a landing); `slidejump` leaves it;
 * `stand` ends it on the ground (let go, or slowed to a walk); a slide into something is a `bonk`.
 */
export type MoveEventKind = "jump" | "hop" | "long" | "dashjump" | "land" | "roll" | "recover" | "dash" | "skid" | "mantle" | "splash" | "respawn" | "bonk" | "glide" | "furl"
  | "slide" | "dashslide" | "landslide" | "slidejump" | "stand";
export interface MoveEvent { kind: MoveEventKind; x: number; y: number; z: number; speed: number; drop: number }

/**
 * World-space intent. `x`/`z` has length ≤ 1 (a stick can walk slower); `*Pressed` are edges since the last step.
 * `sneak` is the crouch/slide key held. `push` is velocity from outside the kit (a knockback, an ability's dash),
 * moved through the same collision.
 */
export interface MoveInput { x: number; z: number; sprint: boolean; sneak: boolean; jump: boolean; jumpPressed: boolean; dashPressed: boolean; push?: { x: number; z: number } }
export const NO_INPUT: MoveInput = { x: 0, z: 0, sprint: false, sneak: false, jump: false, jumpPressed: false, dashPressed: false };

export interface MoveState {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  mode: MoveMode; modeT: number; facing: number;
  coyote: number; buffer: number;
  /** Rising with the button released (a short hop); a long jump and a slide-jump have one fixed arc each. */
  cut: boolean; long: boolean; slideJump: boolean;
  /** Air speed the stick can steer up to (at least walking pace): the takeoff speed. */
  airMax: number;
  /** Highest point since leaving the ground: the drop a landing measures. */
  topY: number;
  hops: number;
  /** The dash: time left, cooldown, the after-window a jump still carries it, its direction, burst and exit speeds. */
  dashT: number; dashCd: number; dashCarry: number; dashX: number; dashZ: number; dashSpeed: number; dashEnd: number; airDashes: number;
  /** Mantle path. */
  from: [number, number, number]; to: [number, number, number];
  /** Last spot stood on, clear of water: where a splash puts you back. */
  safe: [number, number, number];
  /** Momentum: grace left on plain ground before it bleeds; whether it bled this step; the last ground move was a slide (a jump in the grace is a slide-jump). */
  keep: number; bleed: boolean; slid: boolean;
  /** Crouched on the ground (the crouch key held, not sliding): crouch idle and crouch walk. */
  crouch: boolean;
  events: MoveEvent[];
}

export const STEP = 1 / 120;
/** Body radius; below `AIR_STEP` a rise is stepped onto in the air, above it up to `grabReach` it is a ledge to mantle. */
const R = 0.2, D = R * Math.SQRT1_2, SUBSTEP = 0.1, AIR_STEP = 0.2, SNAP_DOWN = 0.25;
const PROBES: readonly (readonly [number, number])[] = [[0, 0], [R, 0], [-R, 0], [0, R], [0, -R], [D, D], [D, -D], [-D, D], [-D, -D]];

export function createMoveState(x: number, z: number, world: MoveWorld, facing = 0): MoveState {
  const y = world.top(x, z);
  return {
    x, y, z, vx: 0, vy: 0, vz: 0, mode: "ground", modeT: 0, facing, coyote: 0, buffer: 0, cut: false, long: false, slideJump: false,
    airMax: 0, topY: y, hops: 0, dashT: 0, dashCd: 0, dashCarry: 0, dashX: Math.sin(facing), dashZ: Math.cos(facing), dashSpeed: 0, dashEnd: 0, airDashes: 0,
    from: [x, y, z], to: [x, y, z], safe: [x, y, z], keep: 0, bleed: false, slid: false, crouch: false, events: [],
  };
}

const onFoot = (s: MoveState) => s.mode === "ground" || s.mode === "skid" || s.mode === "roll" || s.mode === "recover" || s.mode === "slide";
const hypot = Math.hypot;
const angleTo = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
/** Steer a speed's heading toward the stick at `rate`, keeping (or setting) its magnitude. */
function steer(s: MoveState, ix: number, iz: number, rate: number, dt: number, speed = hypot(s.vx, s.vz)) {
  const h = Math.atan2(s.vx, s.vz), next = h + angleTo(h, Math.atan2(ix, iz)) * (1 - Math.exp(-rate * dt));
  s.vx = Math.sin(next) * speed; s.vz = Math.cos(next) * speed;
}

/** Is a probe point in something at feet height `y`? On foot water is a wall too. */
function inside(w: MoveWorld, x: number, z: number, y: number, foot: boolean, t: MoveTuning) {
  return w.top(x, z) > y + (foot ? t.stepUp : AIR_STEP) || (foot && w.wet(x, z));
}
/** How many probes are in something, or `limit + 1` as soon as that many are. */
function overlap(w: MoveWorld, x: number, z: number, y: number, foot: boolean, t: MoveTuning, limit = 9) {
  let n = 0;
  for (const [dx, dz] of PROBES) if (inside(w, x + dx, z + dz, y, foot, t) && ++n > limit) break;
  return n;
}

function emit(s: MoveState, kind: MoveEventKind, drop = 0) {
  s.events.push({ kind, x: s.x, y: s.y, z: s.z, speed: hypot(s.vx, s.vz), drop });
}
function setMode(s: MoveState, mode: MoveMode) {
  if (s.mode === "glide" && mode !== "glide") emit(s, "furl");
  s.mode = mode; s.modeT = 0;
}

/**
 * Move the body by (dx, dz) in ≤ 0.1u pieces, sliding along what it meets. On
 * foot it follows the ground and leaves it where the ground drops away; in the
 * air a slight rise under the centre lifts it. Returns the blocked axes.
 */
function slide(s: MoveState, w: MoveWorld, t: MoveTuning, dx: number, dz: number) {
  const n = Math.max(1, Math.ceil(hypot(dx, dz) / SUBSTEP));
  const sx = dx / n, sz = dz / n;
  let hitX = false, hitZ = false;
  for (let i = 0; i < n; i++) {
    const foot = onFoot(s), here = overlap(w, s.x, s.z, s.y, foot, t);
    const fits = (x: number, z: number) => !inside(w, x, z, s.y, foot, t) && overlap(w, x, z, s.y, foot, t, here) <= here;
    if (fits(s.x + sx, s.z + sz)) { s.x += sx; s.z += sz; }
    else if (sx && fits(s.x + sx, s.z)) { s.x += sx; hitZ = true; }
    else if (sz && fits(s.x, s.z + sz)) { s.z += sz; hitX = true; }
    else {
      // Brushing a corner or the edge of an opening: ease sideways round it rather than stop dead.
      const l = hypot(sx, sz), px = -sz / l, pz = sx / l;
      const side = [0.05, 0.1, 0.15].flatMap(o => [o, -o]).find(o => fits(s.x + px * o + sx, s.z + pz * o + sz));
      const nudge = side === undefined ? 0 : Math.sign(side) * Math.min(Math.abs(side), 0.4 * l);
      if (nudge && fits(s.x + px * nudge, s.z + pz * nudge)) { s.x += px * nudge; s.z += pz * nudge; continue; }
      hitX ||= !!sx; hitZ ||= !!sz;
      break;
    }
    const g = w.top(s.x, s.z);
    if (!foot) { if (g > s.y && !w.wet(s.x, s.z)) s.y = g; continue; }
    if (g >= s.y - SNAP_DOWN) s.y = g;
    else leaveGround(s, t);
  }
  return { hitX, hitZ };
}

/** Walked (or rolled, dashed, slid) off an edge: fall at the speed you had, with a moment to still jump. */
function leaveGround(s: MoveState, t: MoveTuning) {
  s.slid = s.mode === "slide" || (s.slid && s.keep > 0);
  setMode(s, "air");
  s.coyote = t.coyoteTime;
  s.vy = 0; s.topY = s.y; s.cut = true; s.long = false; s.slideJump = false;
  s.airMax = hypot(s.vx, s.vz);
}

/**
 * The ground's slope under (x, z) as its rise per unit along x and along z: ACNH ramps, terrain slopes and blended half
 * steps. A step steeper than `MAX_GRADE` (a cliff, a wall, a prop's side) is an edge, not a slope, and counts as flat.
 */
const MAX_GRADE = 1.6, SLOPE_PROBE = 0.2;
export function slopeAt(w: MoveWorld, x: number, z: number): [number, number] {
  const axis = (a: number, b: number) => { const g = (b - a) / (2 * SLOPE_PROBE); return Number.isFinite(g) && Math.abs(g) <= MAX_GRADE ? g : 0; };
  return [axis(w.top(x - SLOPE_PROBE, z), w.top(x + SLOPE_PROBE, z)), axis(w.top(x, z - SLOPE_PROBE), w.top(x, z + SLOPE_PROBE))];
}
/** The momentum ceiling here, going (vx, vz): `momentumCeiling` on flat ground, higher going downhill. */
function ceilingAt(w: MoveWorld, t: MoveTuning, x: number, z: number, vx: number, vz: number) {
  const [gx, gz] = slopeAt(w, x, z), sp = hypot(vx, vz);
  const down = sp > 1e-6 ? -(gx * vx + gz * vz) / (sp * Math.sqrt(1 + gx * gx + gz * gz)) : 0;
  return t.momentumCeiling + t.downhillCeiling * Math.max(0, down);
}

/** Into the slide at its speed (capped at `cap`), from the ground, a dash or a landing. */
function startSlide(s: MoveState, kind: "slide" | "dashslide" | "landslide", speed: number) {
  const len = hypot(s.vx, s.vz);
  if (len > 1e-6) { s.vx *= speed / len; s.vz *= speed / len; }
  s.dashT = 0; s.dashCarry = 0; s.hops = 0; s.keep = 0; s.slid = true;
  setMode(s, "slide");
  emit(s, kind);
}
/** Out of the slide on the ground: let go (stand up into a run, momentum held for the grace) or slowed to a walk (into the crouch). */
function endSlide(s: MoveState, t: MoveTuning, kind: "stand" | "bonk") {
  setMode(s, "ground");
  s.keep = kind === "stand" ? t.keepGrace : 0;
  emit(s, kind);
}

/** A body pressed into something (a fall beside a wall, a landing half on a bank) eases out, away from what it touches. */
function depenetrate(s: MoveState, w: MoveWorld, t: MoveTuning, dt: number) {
  const foot = onFoot(s);
  let px = 0, pz = 0;
  for (const [dx, dz] of PROBES) if ((dx || dz) && inside(w, s.x + dx, s.z + dz, s.y, foot, t)) { px -= dx; pz -= dz; }
  const len = hypot(px, pz);
  if (len < 1e-6) return;
  const k = Math.min(2.4 * dt, 0.05) / len, x = s.x + px * k, z = s.z + pz * k;
  if (!inside(w, x, z, s.y, foot, t) && overlap(w, x, z, s.y, foot, t) <= overlap(w, s.x, s.z, s.y, foot, t)) { s.x = x; s.z = z; }
}

/** The arc's height and time to the apex: a slide-jump's, a long jump's or a jump's. */
const arc = (s: MoveState, t: MoveTuning) => (s.slideJump ? [t.slideJumpHeight, t.slideJumpApexTime] : s.long ? [t.longJumpHeight, t.longJumpApexTime] : [t.jumpHeight, t.jumpApexTime]);
/** Gravity at this moment of the arc: heavier falling, heavier still once the button is let go, light at a held apex. A long jump and a slide-jump keep one arc. */
function gravity(s: MoveState, t: MoveTuning, held: boolean) {
  const [h, apex] = arc(s, t), fixed = s.long || s.slideJump;
  const g = (2 * h) / (apex * apex), hang = held && !s.cut && !fixed && Math.abs(s.vy) < t.apexHangSpeed ? t.apexHangGravity : 1;
  if (s.vy <= 0) return g * t.fallGravity * hang;
  return s.cut && !fixed ? g * t.jumpCutGravity : g * hang;
}

function jump(s: MoveState, t: MoveTuning, input: MoveInput, chained: boolean, ceiling = t.momentumCeiling) {
  const dashing = s.dashT > 0 || s.dashCarry > 0;
  // Out of a slide (or just after it ended): the slide-jump, lower and longer, adding a little up to the ceiling.
  const sliding = s.mode === "slide" || (s.slid && (s.keep > 0 || s.coyote > 0));
  let speed = hypot(s.vx, s.vz);
  if (s.mode === "skid") {
    // Out of a skid: up and away in the new direction.
    const len = hypot(input.x, input.z) || 1;
    speed = Math.min(speed, t.walkSpeed * 0.6);
    s.vx = (input.x / len) * speed; s.vz = (input.z / len) * speed;
  }
  // A held hop adds hopBoost, up to hopChainMax of them over the long jump (and keeps any speed past that); a long jump
  // lunges to at least sprint × longJumpBoost; a dash-jump carries the dash. Every take-off stays under the ceiling.
  const hop = chained && !dashing && !sliding;
  s.hops = hop ? Math.min(s.hops + 1, t.hopChainMax) : 0;
  if (hop) speed = Math.max(speed, Math.min(speed + t.hopBoost, topSpeed(t)));
  if (sliding && !dashing) speed += t.techBoost;
  speed = Math.min(speed, Math.max(ceiling, t.momentumCeiling));
  s.slideJump = sliding && !dashing;
  s.long = !s.slideJump && speed >= t.longJumpAt * t.sprintSpeed;
  if (s.long && !dashing) speed = Math.max(speed, t.sprintSpeed * t.longJumpBoost);
  const len = hypot(s.vx, s.vz);
  if (len > 1e-6) { s.vx *= speed / len; s.vz *= speed / len; }
  const [h, apex] = arc(s, t);
  s.vy = (2 * h) / apex;
  s.cut = !input.jump;
  s.airMax = speed;
  s.topY = s.y; s.coyote = 0; s.buffer = 0; s.dashT = 0; s.dashCarry = 0; s.keep = 0; s.slid = false;
  setMode(s, "air");
  emit(s, dashing ? "dashjump" : s.slideJump ? "slidejump" : hop ? "hop" : s.long ? "long" : "jump");
}

function land(s: MoveState, t: MoveTuning, input: MoveInput, y: number) {
  s.slid = false;
  if (s.mode === "glide") {
    // The leaf sets you down: never a roll, a recovery or a hop, from any height.
    s.y = y; s.vy = 0; s.airDashes = 0; s.dashT = 0; s.cut = false; s.long = false; s.slideJump = false; s.hops = 0; s.buffer = 0;
    setMode(s, "ground");
    emit(s, "land");
    return;
  }
  const drop = s.topY - y, speed = hypot(s.vx, s.vz);
  s.y = y; s.vy = 0; s.airDashes = 0; s.dashT = 0; s.cut = false; s.long = false; s.slideJump = false;
  emit(s, "land", drop);
  // Space held while sprinting (or carrying momentum): the next hop goes off on the landing step (the bunny-hop). A press just before touching down is a plain jump.
  const hop = input.jump && t.hopChainMax > 0 && ((input.sprint && speed >= t.walkSpeed * 0.9) || speed > t.walkSpeed * t.slideEnterAt);
  if ((hop || s.buffer > 0) && drop < t.recoverDrop) { setMode(s, "ground"); jump(s, t, input, hop); return; }
  s.hops = 0;
  // The crouch key held at speed: straight into a slide that keeps the landing's speed (no roll, no recovery).
  if (input.sneak && speed > t.walkSpeed * t.slideEnterAt) { startSlide(s, "landslide", Math.min(speed + t.techBoost, Math.max(speed, t.momentumCeiling))); return; }
  if (drop >= t.rollDrop && speed >= t.rollSpeed) { setMode(s, "roll"); emit(s, "roll", drop); return; }
  if (drop >= t.recoverDrop) { setMode(s, "recover"); emit(s, "recover", drop); return; }
  setMode(s, "ground");
  s.keep = t.keepGrace;
}

/** A ledge in reach along (dx, dz): its top above the step and within `grabReach` of the feet, with room to stand. Returns where the body ends up. */
function ledge(s: MoveState, w: MoveWorld, t: MoveTuning, dx: number, dz: number): [number, number, number] | null {
  const ax = s.x + dx * (R + 0.12), az = s.z + dz * (R + 0.12);
  if (w.wet(ax, az)) return null;
  const top = w.top(ax, az), rise = top - s.y;
  if (!(rise > AIR_STEP && rise <= t.grabReach)) return null;
  let edge = -1;
  for (let d = 0; d <= R + 0.14; d += 0.02) if (w.top(s.x + dx * d, s.z + dz * d) >= top - 0.05) { edge = d; break; }
  if (edge < 0) return null;
  const tx = s.x + dx * (edge + R + 0.06), tz = s.z + dz * (edge + R + 0.06);
  if (w.wet(tx, tz) || Math.abs(w.top(tx, tz) - top) > 0.05 || overlap(w, tx, tz, top, true, t, 0) > 0) return null;
  return [tx, top, tz];
}

/** Seconds until this fall meets the ground under the body: a press closer than the jump buffer is a buffered jump, not the glider. */
function timeToGround(s: MoveState, w: MoveWorld, t: MoveTuning, held: boolean) {
  const h = s.y - w.top(s.x, s.z), g = gravity(s, t, held), v = -s.vy;
  return h > 0 ? (Math.sqrt(v * v + 2 * g * h) - v) / g : 0;
}

/** Fall to `y`: land on what is under the centre, catch a bank or ledge just missed, or splash. */
function descend(s: MoveState, w: MoveWorld, t: MoveTuning, input: MoveInput, y: number) {
  const wet = w.wet(s.x, s.z), floor = w.top(s.x, s.z), speed = hypot(s.vx, s.vz);
  if (!wet && y <= floor) { land(s, t, input, floor); return; }
  if (y < s.y && speed > 0.5 && (wet || floor < y - 0.3)) {
    // Coming down past a surface just ahead: land on it (the "almost made it" catch).
    for (const r of [0.12, 0.22, 0.32]) for (let a = 0; a < 8; a++) {
      const ox = Math.sin((a * Math.PI) / 4) * r, oz = Math.cos((a * Math.PI) / 4) * r;
      if ((ox * s.vx + oz * s.vz) / speed < 0.2 * r) continue;
      const x = s.x + ox, z = s.z + oz;
      if (w.wet(x, z)) continue;
      const top = w.top(x, z);
      if (top <= s.y + AIR_STEP && top >= y - 0.02 && overlap(w, x, z, top, true, t, 0) === 0) { s.x = x; s.z = z; land(s, t, input, top); return; }
    }
  }
  if (wet && y <= floor) {
    s.y = y; s.vx = s.vy = s.vz = 0; s.dashT = 0;
    setMode(s, "splash");
    emit(s, "splash");
    return;
  }
  s.y = y;
}

/** One fixed step. Pure: returns a new state whose `events` say what happened in it. */
export function stepMove(prev: MoveState, input: MoveInput, dt: number, w: MoveWorld, t: MoveTuning = MOVE_TUNING): MoveState {
  const s: MoveState = { ...prev, events: [], bleed: false };
  s.modeT += dt;
  s.dashCd = Math.max(0, s.dashCd - dt);
  s.dashCarry = Math.max(0, s.dashCarry - dt);
  s.keep = Math.max(0, s.keep - dt);
  s.buffer = input.jumpPressed ? t.jumpBuffer : Math.max(0, s.buffer - dt);
  const len = hypot(input.x, input.z), mag = Math.min(1, len);
  const ix = len > 1e-3 ? input.x / len : 0, iz = len > 1e-3 ? input.z / len : 0, steering = len > 1e-3;

  // ── Timed moves: mantle, splash ──────────────────────────────────
  if (s.mode === "mantle") {
    const [fx, fy, fz] = s.from, [tx, ty, tz] = s.to;
    const u = Math.min(1, s.modeT / (t.mantleTime * Math.min(1, Math.max(0.35, (ty - fy) / 1.5))));
    // Up first (hands on the lip), then over the edge.
    const up = 1 - (1 - Math.min(1, u / 0.6)) ** 2, v = Math.max(0, (u - 0.45) / 0.55), over = v * v * (3 - 2 * v);
    s.y = fy + (ty - fy) * up;
    s.x = fx + (tx - fx) * (0.15 * up + 0.85 * over);
    s.z = fz + (tz - fz) * (0.15 * up + 0.85 * over);
    if (u >= 1) {
      s.x = tx; s.y = ty; s.z = tz;
      const dl = hypot(tx - fx, tz - fz) || 1, out = Math.min(t.walkSpeed * 0.6, s.airMax);
      s.vx = ((tx - fx) / dl) * out; s.vz = ((tz - fz) / dl) * out;
      setMode(s, "ground");
      s.safe = [tx, ty, tz];
      if (s.buffer > 0) jump(s, t, input, false);
    }
    return s;
  }
  if (s.mode === "splash") {
    s.y -= 0.6 * dt;
    if (s.modeT >= 0.55) {
      [s.x, s.y, s.z] = s.safe;
      s.vx = s.vy = s.vz = 0; s.hops = 0; s.buffer = 0; s.airDashes = 0;
      setMode(s, "ground");
      emit(s, "respawn");
    }
    return s;
  }

  // ── Glider: letting go of Space drops you (a gust ends with it) ──
  if (s.mode === "glide" && !input.jump) {
    setMode(s, "air");
    s.cut = true; s.topY = s.y; s.dashT = 0; s.airMax = hypot(s.vx, s.vz);
  }

  // ── Dash (Q): on the ground, or once in the air (gliding: a forward gust, no lift) ──
  const aloft = s.mode === "air" || s.mode === "glide";
  if (input.dashPressed && s.mode !== "recover" && s.dashCd <= 0 && (!aloft || s.airDashes < t.airDashes)) {
    // The stick's way (camera-relative), or the way you face; the burst eases out to dashExit of itself, or to the speed you came in with.
    const [dx, dz] = steering ? [ix, iz] : [Math.sin(s.facing), Math.cos(s.facing)], entry = Math.max(0, s.vx * dx + s.vz * dz);
    if (s.mode === "air") { s.airDashes++; s.vy = t.airDashLift; s.topY = s.y; }
    else if (s.mode === "glide") s.airDashes++;
    else setMode(s, "ground");
    s.dashX = dx; s.dashZ = dz; s.facing = Math.atan2(dx, dz);
    s.dashSpeed = Math.max(t.dashSpeed, entry);
    s.dashEnd = Math.min(s.dashSpeed, Math.max(s.dashSpeed * t.dashExit, entry));
    s.dashT = t.dashTime; s.dashCd = t.dashCooldown; s.hops = 0; s.slid = false; s.keep = 0;
    s.vx = dx * s.dashSpeed; s.vz = dz * s.dashSpeed;
    emit(s, "dash");
  }

  // ── Jump: from the ground, a skid, a roll, a slide, or within coyote time ─
  if (s.buffer > 0 && ((onFoot(s) && s.mode !== "recover") || (s.mode === "air" && s.coyote > 0))) jump(s, t, input, false, onFoot(s) ? ceilingAt(w, t, s.x, s.z, s.vx, s.vz) : t.momentumCeiling);

  // ── Glider: a fresh press while falling opens the leaf, unless you would land within the jump buffer anyway ──
  if (t.glider > 0 && input.jumpPressed && s.mode === "air" && s.vy <= 0 && s.dashT <= 0 && timeToGround(s, w, t, input.jump) > t.jumpBuffer) {
    setMode(s, "glide");
    s.buffer = 0; s.coyote = 0; s.cut = false; s.long = false; s.slideJump = false; s.hops = 0; s.topY = s.y;
    emit(s, "glide");
  }

  // ── Slide: the crouch key held at speed on the ground (a dash plays out its burst first, then slides at its speed) ──
  if (s.mode === "ground" && input.sneak && s.dashT <= 0 && hypot(s.vx, s.vz) > t.walkSpeed * t.slideEnterAt) startSlide(s, s.dashCarry > 0 ? "dashslide" : "slide", hypot(s.vx, s.vz));

  // ── Horizontal speed ─────────────────────────────────────────────
  const speed = hypot(s.vx, s.vz);
  if (s.mode === "slide") {
    if (!input.sneak) endSlide(s, t, "stand");
    else {
      // The slope pushes it along the fall line (faster down, slower up); friction wears it down slowly; over the ceiling bleeds fast.
      const [gx, gz] = slopeAt(w, s.x, s.z), n = Math.sqrt(1 + gx * gx + gz * gz);
      s.vx -= ((t.slideSlope * gx) / n) * dt; s.vz -= ((t.slideSlope * gz) / n) * dt;
      let sp = Math.max(0, hypot(s.vx, s.vz) - t.slideFriction * dt);
      const ceiling = ceilingAt(w, t, s.x, s.z, s.vx, s.vz);
      if (sp > ceiling) sp = Math.max(ceiling, sp - t.ceilingBleed * dt);
      if (steering) steer(s, ix, iz, t.slideTurn, dt, sp);
      else { const l = hypot(s.vx, s.vz); if (l > 1e-6) { s.vx *= sp / l; s.vz *= sp / l; } }
      if (sp <= t.walkSpeed * t.slideEndAt) endSlide(s, t, "stand");
    }
  } else if (s.dashT > 0) {
    // The burst eases out to its exit speed; an air dash floats up and eases to its apex, a dash run off an edge holds level.
    s.dashT -= dt;
    const left = Math.max(0, s.dashT) / t.dashTime, v = s.dashT > 0 ? s.dashEnd + (s.dashSpeed - s.dashEnd) * left ** t.dashEase : s.dashEnd;
    s.vx = s.dashX * v; s.vz = s.dashZ * v;
    if (s.mode === "air") s.vy = s.airDashes > 0 ? t.airDashLift * left : 0;
    if (s.dashT <= 0) {
      s.dashCarry = t.dashJumpWindow;
      s.airMax = Math.max(s.airMax, v);
      if (s.mode === "ground") s.keep = t.keepGrace;
    }
  } else if (s.mode === "ground") {
    const target = mag * (input.sneak ? t.sneakSpeed : input.sprint ? t.sprintSpeed : t.walkSpeed);
    const turn = speed > 1e-3 && steering ? Math.abs(angleTo(Math.atan2(s.vx, s.vz), Math.atan2(ix, iz))) : 0;
    if (speed > t.skidSpeed && turn > (t.skidAngle * Math.PI) / 180) {
      setMode(s, "skid");
      emit(s, "skid");
    } else if (s.keep > 0 && speed > t.walkSpeed) {
      // The grace after a landing, a dash or a slide: momentum held (turning as at speed), so a late slide or jump still catches it.
      if (steering) steer(s, ix, iz, t.turnAtSpeed, dt, speed);
    } else if (steering && speed > t.walkSpeed * 0.98 && (target > t.walkSpeed || speed > target)) {
      // At speed: sprint builds over sprintBuild, momentum (a chain, a dash, a slide) bleeds back quickly, the heading swings round.
      const sp = speed < target ? Math.min(target, speed + ((t.sprintSpeed - t.walkSpeed) / Math.max(0.05, t.sprintBuild)) * dt) : Math.max(target, speed - t.overspeedDecay * dt);
      s.bleed = sp < speed;
      steer(s, ix, iz, t.turnAtSpeed, dt, sp);
    } else if (steering) {
      const cap = Math.min(target, t.walkSpeed), k = 1 - Math.exp(-t.groundResponse * dt);
      s.vx += (ix * cap - s.vx) * k; s.vz += (iz * cap - s.vz) * k;
    } else {
      const k = Math.exp(-t.stopResponse * dt);
      s.vx *= k; s.vz *= k;
      if (hypot(s.vx, s.vz) < 0.02) s.vx = s.vz = 0;
    }
  } else if (s.mode === "skid") {
    const sp = Math.max(0, speed - t.skidDecel * dt);
    if (sp <= 1 || s.modeT > 0.4) {
      s.vx = ix * 2; s.vz = iz * 2; // the turnaround push
      setMode(s, "ground");
    } else if (speed > 1e-6) { s.vx *= sp / speed; s.vz *= sp / speed; }
  } else if (s.mode === "roll") {
    if (steering && speed > 1e-3) steer(s, ix, iz, 3, dt);
    if (s.modeT >= t.rollTime) { setMode(s, "ground"); s.keep = t.keepGrace; }
  } else if (s.mode === "recover") {
    const k = Math.exp(-14 * dt);
    s.vx *= k; s.vz *= k;
    if (s.modeT >= t.recoverTime) setMode(s, "ground");
  } else if (s.mode === "air" && steering) {
    // Steer toward the stick at the takeoff speed, or your walking (sneaking) pace if that was slower.
    const k = 1 - Math.exp(-t.groundResponse * t.airControl * dt), cap = Math.max(s.airMax, input.sneak ? t.sneakSpeed : t.walkSpeed) * mag;
    s.vx += (ix * cap - s.vx) * k; s.vz += (iz * cap - s.vz) * k;
  } else if (s.mode === "glide") {
    // The speed you opened with eases to glideSpeed (scaled by the stick; none drifts to a stop) and the heading swings round to the stick.
    const sp = t.glideSpeed * mag + (speed - t.glideSpeed * mag) * Math.exp(-t.glideEase * dt);
    if (steering && speed < 0.5) { s.vx = ix * sp; s.vz = iz * sp; }
    else if (steering) steer(s, ix, iz, t.glideTurn, dt, sp);
    else if (speed > 1e-6) { s.vx *= sp / speed; s.vz *= sp / speed; }
  }

  // ── Ledge: pushing into a wall within reach, not rising fast ─────
  if ((s.mode === "air" || s.mode === "glide") && s.vy <= t.grabRise) {
    const [dx, dz] = s.dashT > 0 ? [s.dashX, s.dashZ] : mag > 0.3 ? [ix, iz] : [0, 0];
    const to = dx || dz ? ledge(s, w, t, dx, dz) : null;
    if (to) {
      s.from = [s.x, s.y, s.z]; s.to = to;
      s.airMax = Math.max(hypot(s.vx, s.vz), t.walkSpeed * 0.4);
      s.vx = s.vy = s.vz = 0; s.dashT = 0; s.hops = 0;
      s.facing = Math.atan2(dx, dz);
      setMode(s, "mantle");
      emit(s, "mantle", to[1] - s.from[1]);
      return s;
    }
  }

  // ── Move ─────────────────────────────────────────────────────────
  const before = hypot(s.vx, s.vz), px = input.push?.x ?? 0, pz = input.push?.z ?? 0;
  const { hitX, hitZ } = slide(s, w, t, (s.vx + px) * dt, (s.vz + pz) * dt);
  if (hitX) s.vx = 0;
  if (hitZ) s.vz = 0;
  if ((hitX || hitZ) && s.dashT > 0 && hypot(s.vx, s.vz) < before * 0.5) { s.dashT = 0; emit(s, "bonk"); }
  if ((hitX || hitZ) && s.mode === "slide" && hypot(s.vx, s.vz) < Math.max(before * 0.5, t.walkSpeed * t.slideEndAt)) endSlide(s, t, "bonk");

  if (s.mode === "air") {
    s.coyote = Math.max(0, s.coyote - dt);
    if (!input.jump && s.vy > 0) s.cut = true;
    const g = s.dashT > 0 ? 0 : gravity(s, t, input.jump), y = s.y + s.vy * dt - 0.5 * g * dt * dt;
    s.vy = Math.max(-t.maxFallSpeed, s.vy - g * dt);
    s.topY = Math.max(s.topY, y);
    descend(s, w, t, input, y);
  } else if (s.mode === "glide") {
    // The leaf brakes the fall to a slow sink and never lifts you; it comes down like a fall (land, a just-missed bank, or a splash).
    s.vy = -t.glideSink + (s.vy + t.glideSink) * Math.exp(-t.glideOpen * dt);
    const y = s.y + s.vy * dt;
    s.topY = y;
    descend(s, w, t, input, y);
  }
  if ((s.mode as MoveMode) !== "splash") depenetrate(s, w, t, dt); // descend() may have splashed
  if (s.mode === "ground" && !w.wet(s.x, s.z) && overlap(w, s.x, s.z, s.y, true, t, 0) === 0) s.safe = [s.x, s.y, s.z];
  if (s.y < -8) { setMode(s, "splash"); s.modeT = 0.55; }
  if (s.mode === "ground" && s.keep <= 0) s.slid = false;
  s.crouch = s.mode === "ground" && input.sneak && s.dashT <= 0;

  // Facing: the way you travel, or the stick when turning on the spot.
  const fx = hypot(s.vx, s.vz) > 0.3 && s.mode !== "skid" ? Math.atan2(s.vx, s.vz) : steering ? Math.atan2(ix, iz) : s.facing;
  s.facing += angleTo(s.facing, fx) * (1 - Math.exp(-14 * dt));
  return s;
}

/**
 * Fixed-step driver: runs whole 1/120 s steps for a frame and keeps the one
 * before for interpolation, so the path is the same at any frame rate. Presses
 * wait for the next step (a fast display may run none this frame); a tap
 * shorter than a step still counts as held for it.
 */
export interface MoveSim { state: MoveState; prev: MoveState; acc: number; jumpPressed: boolean; dashPressed: boolean }
export function createMoveSim(state: MoveState): MoveSim { return { state, prev: state, acc: 0, jumpPressed: false, dashPressed: false }; }
export function advanceMove(sim: MoveSim, input: MoveInput, frameDt: number, w: MoveWorld, t: MoveTuning = MOVE_TUNING): MoveEvent[] {
  sim.acc += Math.min(Math.max(0, frameDt), 0.25);
  sim.jumpPressed ||= input.jumpPressed;
  sim.dashPressed ||= input.dashPressed;
  const events: MoveEvent[] = [];
  while (sim.acc >= STEP - 1e-9) {
    sim.acc = Math.max(0, sim.acc - STEP);
    sim.prev = sim.state;
    sim.state = stepMove(sim.state, { ...input, jump: input.jump || sim.jumpPressed, jumpPressed: sim.jumpPressed, dashPressed: sim.dashPressed }, STEP, w, t);
    sim.jumpPressed = sim.dashPressed = false;
    events.push(...sim.state.events);
  }
  return events;
}

/** Render position between the last two steps. */
export function interpolated(sim: MoveSim): [number, number, number] {
  const a = Math.min(1, sim.acc / STEP), p = sim.prev, s = sim.state;
  if (s.events.some(e => e.kind === "respawn")) return [s.x, s.y, s.z];
  return [p.x + (s.x - p.x) * a, p.y + (s.y - p.y) * a, p.z + (s.z - p.z) * a];
}

/** Tap-to-walk intent: toward a goal at walking pace, easing into it; null once there. */
export function towards(s: MoveState, gx: number, gz: number, t: MoveTuning = MOVE_TUNING): { x: number; z: number } | null {
  const dx = gx - s.x, dz = gz - s.z, d = hypot(dx, dz);
  if (d < 0.12) return null;
  const k = Math.min(1, (d * 4) / t.walkSpeed) / d;
  return { x: dx * k, z: dz * k };
}
/** Tap-to-walk gives up once held this long under 0.3 u/s (pressed against something it can't pass). */
export const STUCK_TIME = 0.25;

/** A tap-to-walk run out: from (x, z) toward (gx, gz) until there or stuck. */
export function walkTo(w: MoveWorld, x: number, z: number, gx: number, gz: number, t: MoveTuning = MOVE_TUNING): MoveState {
  let s = createMoveState(x, z, w), stuck = 0;
  for (let i = 0; i < 20 / STEP && stuck < STUCK_TIME; i++) {
    const go = towards(s, gx, gz, t);
    if (!go) break;
    s = stepMove(s, { ...NO_INPUT, ...go }, STEP, w, t);
    stuck = hypot(s.vx, s.vz) < 0.3 ? stuck + STEP : 0;
  }
  return s;
}

/** Where the body stands clear nearest (x, z) on the floor at `y`, the `facing` side first: where getting up from a seat puts you. */
export function clearSpot(w: MoveWorld, x: number, z: number, y: number, facing: number, t: MoveTuning = MOVE_TUNING): [number, number] {
  for (let r = 0; r <= 2; r += 0.1) for (let a = 0; a < 16; a++) {
    const ang = facing + (a % 2 ? -1 : 1) * Math.ceil(a / 2) * (Math.PI / 8), px = x + Math.sin(ang) * r, pz = z + Math.cos(ang) * r;
    if (overlap(w, px, pz, y, true, t, 0) === 0) return [px, pz];
  }
  return [x, z];
}

/** A walker's rule as a sim world (the home island, the ruins, the café, the applicant island): where you can't stand is a wall of any height, water with no land is wet. */
export function standWorld(ground: (x: number, z: number) => number, standable: (x: number, z: number) => boolean, wet: (x: number, z: number) => boolean): MoveWorld {
  return { wet, top: (x, z) => (standable(x, z) || wet(x, z) ? ground(x, z) : Infinity) };
}
