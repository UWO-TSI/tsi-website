/**
 * Movement simulation (rows 243, 244; specs/movement.md). One pure fixed-step
 * function, `stepMove(state, input, dt, world, tuning) → state`, owns walking,
 * sprint momentum, jumps (variable height, coyote time, buffering, apex hang),
 * timed hop chains, the long jump, the Q dash, skids, ledge grabs and mantles,
 * falls, landing rolls and the water rule. The renderer interpolates between
 * steps and plays each step's `events` (dust, thumps, clips) on the avatar that
 * moved (look spec §7.1); the same function can later drive multiplayer
 * prediction, since nothing here reads a clock, the camera or the DOM.
 *
 * The world is two queries. `top(x, z)` is the highest thing at a point: the
 * ground (ramps and blended half steps included), a prop's top, or Infinity for
 * a building or trunk. `wet(x, z)` is water with no land: a wall on foot, a
 * splash from the air that puts you back where you last stood (swimming is a
 * later unlock, row 245). The body is a 0.2-radius column sampled at nine
 * points, the walker's clearance probes, and no step ends with more of it
 * inside something than it started with, so nothing can leave it stuck.
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
  overspeedDecay: 5, // u/s² that speed above the target bleeds on the ground
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
  hopWindow: 0.12, // after landing, a jump in this window chains
  hopBoost: 0.6,
  hopChainMax: 3,
  longJumpAt: 0.92, // fraction of sprint speed where a jump becomes a long jump
  longJumpHeight: 0.5,
  longJumpApexTime: 0.18,
  longJumpBoost: 1.06,
  dashSpeed: 14,
  dashTime: 0.18,
  dashCooldown: 0.45,
  dashExit: 0.7, // fraction of the dash speed kept when it ends
  airDashes: 1,
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
};
export type MoveTuning = typeof MOVE_TUNING;

export type MoveMode = "ground" | "air" | "skid" | "roll" | "recover" | "mantle" | "splash";
export type MoveEventKind = "jump" | "hop" | "long" | "dashjump" | "land" | "roll" | "recover" | "dash" | "skid" | "mantle" | "splash" | "respawn" | "bonk";
export interface MoveEvent { kind: MoveEventKind; x: number; y: number; z: number; speed: number; drop: number }

/** World-space intent. `x`/`z` has length ≤ 1 (a stick can walk slower); `*Pressed` are edges since the last step. */
export interface MoveInput { x: number; z: number; sprint: boolean; sneak: boolean; jump: boolean; jumpPressed: boolean; dashPressed: boolean }
export const NO_INPUT: MoveInput = { x: 0, z: 0, sprint: false, sneak: false, jump: false, jumpPressed: false, dashPressed: false };

export interface MoveState {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  mode: MoveMode; modeT: number; facing: number;
  coyote: number; buffer: number;
  /** Rising with the button released (a short hop); a long jump has one fixed arc. */
  cut: boolean; long: boolean;
  /** Air speed the stick can steer up to (at least walking pace): the takeoff speed. */
  airMax: number;
  /** Highest point since leaving the ground: the drop a landing measures. */
  topY: number;
  hops: number; hopT: number;
  dashT: number; dashCd: number; dashCarry: number; dashX: number; dashZ: number; dashSpeed: number; airDashes: number;
  /** Mantle path. */
  from: [number, number, number]; to: [number, number, number];
  /** Last spot stood on, clear of water: where a splash puts you back. */
  safe: [number, number, number];
  events: MoveEvent[];
}

export const STEP = 1 / 120;
/** Body radius; below `AIR_STEP` a rise is stepped onto in the air, above it up to `grabReach` it is a ledge to mantle. */
const R = 0.2, D = R * Math.SQRT1_2, SUBSTEP = 0.1, AIR_STEP = 0.2, SNAP_DOWN = 0.25;
const PROBES: readonly (readonly [number, number])[] = [[0, 0], [R, 0], [-R, 0], [0, R], [0, -R], [D, D], [D, -D], [-D, D], [-D, -D]];

export function createMoveState(x: number, z: number, world: MoveWorld, facing = 0): MoveState {
  const y = world.top(x, z);
  return {
    x, y, z, vx: 0, vy: 0, vz: 0, mode: "ground", modeT: 0, facing, coyote: 0, buffer: 0, cut: false, long: false,
    airMax: 0, topY: y, hops: 0, hopT: 0, dashT: 0, dashCd: 0, dashCarry: 0, dashX: Math.sin(facing), dashZ: Math.cos(facing), dashSpeed: 0, airDashes: 0,
    from: [x, y, z], to: [x, y, z], safe: [x, y, z], events: [],
  };
}

const onFoot = (s: MoveState) => s.mode === "ground" || s.mode === "skid" || s.mode === "roll" || s.mode === "recover";
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
function setMode(s: MoveState, mode: MoveMode) { s.mode = mode; s.modeT = 0; }

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

/** Walked (or rolled, dashed) off an edge: fall, with a moment to still jump. */
function leaveGround(s: MoveState, t: MoveTuning) {
  setMode(s, "air");
  s.coyote = t.coyoteTime;
  s.vy = 0; s.topY = s.y; s.cut = true; s.long = false;
  s.airMax = hypot(s.vx, s.vz);
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

/** Gravity at this moment of the arc: heavier falling, heavier still once the button is let go, light at a held apex. */
function gravity(s: MoveState, t: MoveTuning, held: boolean) {
  const [h, apex] = s.long ? [t.longJumpHeight, t.longJumpApexTime] : [t.jumpHeight, t.jumpApexTime];
  const g = (2 * h) / (apex * apex), hang = held && !s.cut && !s.long && Math.abs(s.vy) < t.apexHangSpeed ? t.apexHangGravity : 1;
  if (s.vy <= 0) return g * t.fallGravity * hang;
  return s.cut && !s.long ? g * t.jumpCutGravity : g * hang;
}

function jump(s: MoveState, t: MoveTuning, input: MoveInput, chained: boolean) {
  const dashing = s.dashT > 0 || s.dashCarry > 0;
  let speed = hypot(s.vx, s.vz);
  if (s.mode === "skid") {
    // Out of a skid: up and away in the new direction.
    const len = hypot(input.x, input.z) || 1;
    speed = Math.min(speed, t.walkSpeed * 0.6);
    s.vx = (input.x / len) * speed; s.vz = (input.z / len) * speed;
  }
  // Chained hops add hopBoost up to hopChainMax of them over the pace you run at; a long jump lunges to at least sprint × longJumpBoost.
  const cap = (input.sprint ? t.sprintSpeed * t.longJumpBoost : t.walkSpeed) + t.hopChainMax * t.hopBoost;
  const hop = chained && !dashing && speed >= t.walkSpeed * 0.9;
  s.hops = hop ? Math.min(s.hops + 1, t.hopChainMax) : 0;
  if (hop) speed = Math.max(speed, Math.min(speed + t.hopBoost, cap));
  s.long = speed >= t.longJumpAt * t.sprintSpeed;
  if (s.long && !dashing) speed = Math.max(speed, t.sprintSpeed * t.longJumpBoost);
  const len = hypot(s.vx, s.vz);
  if (len > 1e-6) { s.vx *= speed / len; s.vz *= speed / len; }
  const [h, apex] = s.long ? [t.longJumpHeight, t.longJumpApexTime] : [t.jumpHeight, t.jumpApexTime];
  s.vy = (2 * h) / apex;
  s.cut = !input.jump;
  s.airMax = speed;
  s.topY = s.y; s.coyote = 0; s.buffer = 0; s.hopT = 0; s.dashT = 0; s.dashCarry = 0;
  setMode(s, "air");
  emit(s, dashing ? "dashjump" : s.long ? "long" : hop ? "hop" : "jump");
}

function land(s: MoveState, t: MoveTuning, input: MoveInput, y: number) {
  const drop = s.topY - y, speed = hypot(s.vx, s.vz);
  s.y = y; s.vy = 0; s.airDashes = 0; s.dashT = 0; s.cut = false; s.long = false;
  emit(s, "land", drop);
  // A jump pressed just before touching down is the timed hop.
  if (s.buffer > 0 && drop < t.recoverDrop) { setMode(s, "ground"); jump(s, t, input, true); return; }
  if (drop >= t.rollDrop && speed >= t.rollSpeed) { setMode(s, "roll"); emit(s, "roll", drop); return; }
  if (drop >= t.recoverDrop) { setMode(s, "recover"); emit(s, "recover", drop); return; }
  setMode(s, "ground");
  s.hopT = t.hopWindow;
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
  const s: MoveState = { ...prev, events: [] };
  s.modeT += dt;
  s.dashCd = Math.max(0, s.dashCd - dt);
  s.dashCarry = Math.max(0, s.dashCarry - dt);
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

  // ── Dash (Q): on the ground, or once in the air ──────────────────
  if (input.dashPressed && s.mode !== "recover" && s.dashCd <= 0 && (s.mode !== "air" || s.airDashes < t.airDashes)) {
    const [dx, dz] = steering ? [ix, iz] : [Math.sin(s.facing), Math.cos(s.facing)];
    if (s.mode === "air") { s.airDashes++; s.vy = 0; s.topY = s.y; }
    else setMode(s, "ground");
    s.dashX = dx; s.dashZ = dz;
    s.dashSpeed = Math.max(t.dashSpeed, s.vx * dx + s.vz * dz);
    s.dashT = t.dashTime; s.dashCd = t.dashCooldown; s.hops = 0;
    s.vx = dx * s.dashSpeed; s.vz = dz * s.dashSpeed;
    emit(s, "dash");
  }

  // ── Jump: from the ground, a skid, a roll, or within coyote time ─
  if (s.buffer > 0 && ((onFoot(s) && s.mode !== "recover") || (s.mode === "air" && s.coyote > 0))) jump(s, t, input, s.hopT > 0);

  // ── Horizontal speed ─────────────────────────────────────────────
  const speed = hypot(s.vx, s.vz);
  if (s.dashT > 0) {
    s.dashT -= dt;
    s.vx = s.dashX * s.dashSpeed; s.vz = s.dashZ * s.dashSpeed;
    if (s.mode === "air") s.vy = 0; // an air dash hovers
    if (s.dashT <= 0) {
      s.vx *= t.dashExit; s.vz *= t.dashExit;
      s.dashCarry = t.dashJumpWindow;
      s.airMax = Math.max(s.airMax, hypot(s.vx, s.vz));
    }
  } else if (s.mode === "ground") {
    const target = mag * (input.sneak ? t.sneakSpeed : input.sprint ? t.sprintSpeed : t.walkSpeed);
    const turn = speed > 1e-3 && steering ? Math.abs(angleTo(Math.atan2(s.vx, s.vz), Math.atan2(ix, iz))) : 0;
    if (speed > t.skidSpeed && turn > (t.skidAngle * Math.PI) / 180) {
      setMode(s, "skid");
      emit(s, "skid");
    } else if (steering && speed > t.walkSpeed * 0.98 && (target > t.walkSpeed || speed > target)) {
      // At speed: sprint builds over sprintBuild, extra speed (a chain, a dash) bleeds, the heading swings round.
      const sp = speed < target ? Math.min(target, speed + ((t.sprintSpeed - t.walkSpeed) / Math.max(0.05, t.sprintBuild)) * dt) : Math.max(target, speed - t.overspeedDecay * dt);
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
    if (s.modeT >= t.rollTime) { setMode(s, "ground"); s.hopT = t.hopWindow; }
  } else if (s.mode === "recover") {
    const k = Math.exp(-14 * dt);
    s.vx *= k; s.vz *= k;
    if (s.modeT >= t.recoverTime) { setMode(s, "ground"); s.hopT = t.hopWindow; }
  } else if (s.mode === "air" && steering) {
    // Steer toward the stick at the takeoff speed, or your walking (sneaking) pace if that was slower.
    const k = 1 - Math.exp(-t.groundResponse * t.airControl * dt), cap = Math.max(s.airMax, input.sneak ? t.sneakSpeed : t.walkSpeed) * mag;
    s.vx += (ix * cap - s.vx) * k; s.vz += (iz * cap - s.vz) * k;
  }
  if (s.mode === "ground" && s.hopT > 0 && (s.hopT -= dt) <= 0) s.hops = 0;

  // ── Ledge: pushing into a wall within reach, not rising fast ─────
  if (s.mode === "air" && s.vy <= t.grabRise) {
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
  const before = hypot(s.vx, s.vz);
  const { hitX, hitZ } = slide(s, w, t, s.vx * dt, s.vz * dt);
  if (hitX) s.vx = 0;
  if (hitZ) s.vz = 0;
  if ((hitX || hitZ) && s.dashT > 0 && hypot(s.vx, s.vz) < before * 0.5) { s.dashT = 0; emit(s, "bonk"); }

  if (s.mode === "air") {
    s.coyote = Math.max(0, s.coyote - dt);
    if (!input.jump && s.vy > 0) s.cut = true;
    if (s.dashT <= 0) {
      const g = gravity(s, t, input.jump), y = s.y + s.vy * dt - 0.5 * g * dt * dt;
      s.vy = Math.max(-t.maxFallSpeed, s.vy - g * dt);
      s.topY = Math.max(s.topY, y);
      descend(s, w, t, input, y);
    }
  }
  if ((s.mode as MoveMode) !== "splash") depenetrate(s, w, t, dt); // descend() may have splashed
  if (s.mode === "ground" && !w.wet(s.x, s.z) && overlap(w, s.x, s.z, s.y, true, t, 0) === 0) s.safe = [s.x, s.y, s.z];
  if (s.y < -8) { setMode(s, "splash"); s.modeT = 0.55; }

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
