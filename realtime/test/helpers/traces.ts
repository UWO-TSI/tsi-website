// Honest movement traces from the real movement sim (web/lib/game/movement/sim.ts),
// sampled the way the client's sender sends them (specs/multiplayer.md §4.3, §5.2):
// 10 Hz on the ground while moving, 15 Hz while a move state is on (air, glide,
// slide, skid, a dash), a packet as soon as an event happens (at least 30 ms after
// the last), one packet on stopping, nothing while still. The teleport flag goes on
// a respawn and on any jump over 2.5 u in one frame. Sanity checks must never
// strike any of these (realtime/test/sanity.test.ts).
import {
  createMoveState,
  MOVE_TUNING,
  NO_INPUT,
  STEP,
  stepMove,
  type MoveInput,
  type MoveState,
  type MoveTuning,
  type MoveWorld,
} from "../../../web/lib/game/movement/sim";

export type TraceSample = { t: number; x: number; y: number; z: number; teleport: boolean; events: string[] };

export type Script = (time: number, s: MoveState) => Partial<MoveInput>;

const FRAME = 1 / 60;
const STEPS_PER_FRAME = Math.round(FRAME / STEP);

export type RecordOptions = {
  tuning?: MoveTuning;
  /** The sender clock at the start (ms). */
  t0?: number;
  /** Shifts the periodic sends by this many seconds: sweeps where samples fall relative to the movement. */
  phase?: number;
  /** Always send at 15 Hz while moving (the worst case for rates measured between samples). */
  fast?: boolean;
};

/** Runs `seconds` of the sim under `script` and returns what the sender would have sent. */
export function record(
  world: MoveWorld,
  start: { x: number; z: number; facing?: number },
  seconds: number,
  script: Script,
  opts: RecordOptions = {},
): TraceSample[] {
  const tuning = opts.tuning ?? MOVE_TUNING;
  const t0 = opts.t0 ?? 10_000;
  let s = createMoveState(start.x, start.z, world, start.facing ?? 0);
  const out: TraceSample[] = [];
  let lastSend = 0;
  let lastActual = 0;
  let lastSentMoving = false;
  let prev: [number, number, number] = [s.x, s.y, s.z];
  let step = 0;
  // Events and the teleport flag wait for the next packet when one went out under 30 ms ago (coalesced, §4.3).
  let pending: string[] = [];
  let pendingTeleport = false;
  const send = (time: number) => {
    out.push({ t: t0 + time * 1000, x: s.x, y: s.y, z: s.z, teleport: pendingTeleport, events: pending });
    pending = [];
    pendingTeleport = false;
    lastSend = time;
    lastActual = time;
  };
  send(0);
  lastSend = -(opts.phase ?? 0);

  const frames = Math.round(seconds / FRAME);
  for (let f = 1; f <= frames; f++) {
    for (let i = 0; i < STEPS_PER_FRAME; i++) {
      s = stepMove(s, { ...NO_INPUT, ...script(step * STEP, s) }, STEP, world, tuning);
      step++;
      for (const e of s.events) pending.push(e.kind);
    }
    const time = f * FRAME;
    const moved = Math.hypot(s.x - prev[0], s.y - prev[1], s.z - prev[2]);
    if (moved > 2.5 || s.events.some((e) => e.kind === "respawn") || pending.includes("respawn")) pendingTeleport = true;
    const moving = moved / FRAME > 0.05;
    prev = [s.x, s.y, s.z];
    const moveState = s.mode === "air" || s.mode === "glide" || s.mode === "slide" || s.mode === "skid" || s.dashT > 0;
    const interval = opts.fast || moveState ? 1 / 15 : 1 / 10;
    const since = time - lastSend;
    // Never two packets under 30 ms apart.
    if (time - lastActual < 0.03 - 1e-9) continue;
    if ((pending.length > 0 || pendingTeleport) && since >= 0.03 - 1e-9) send(time);
    else if (moving && since >= interval - 1e-9) send(time);
    else if (!moving && lastSentMoving && since >= 0.03 - 1e-9) send(time);
    else continue;
    lastSentMoving = moving;
  }
  return out;
}

export const flat: MoveWorld = { top: () => 0, wet: () => false };

/** A cliff face of height `h` across x at z = `at`: high ground beyond it. */
export const cliff = (h: number, at = 2): MoveWorld => ({ top: (_x, z) => (z >= at ? h : 0), wet: () => false });

/** A straight ramp from z = `from` rising `rise` over `run` (the grid's: 1.5 u over 2 cells), high ground after. */
export const ramp = (rise = 1.5, run = 2, from = 2): MoveWorld => ({
  top: (_x, z) => Math.min(rise, Math.max(0, ((z - from) / run) * rise)),
  wet: () => false,
});

/** A long hill going down toward +z at `grade` (rise per unit) from height `top`, flat before and after. */
export const hill = (grade: number, from: number, length: number, top: number): MoveWorld => ({
  top: (_x, z) => top - grade * Math.min(length, Math.max(0, z - from)),
  wet: () => false,
});

/** A tower `h` high around the origin (|x|,|z| < half), ground at 0 around it. */
export const tower = (h: number, half = 1.5): MoveWorld => ({
  top: (x, z) => (Math.abs(x) < half && Math.abs(z) < half ? h : 0),
  wet: () => false,
});

/** Land for z < `shore`, water beyond it. */
export const shore = (at = 2): MoveWorld => ({ top: (_x, z) => (z < at ? 0 : -0.5), wet: (_x, z) => z >= at });

const at = (time: number, when: number) => Math.abs(time - when) < STEP / 2;

/** The named honest scenarios (specs/multiplayer.md §7 sanity fixtures plus the edge cases they imply). */
export function honestTraces(): Record<string, TraceSample[]> {
  const glider = { ...MOVE_TUNING, glider: 1 };
  const traces: Record<string, TraceSample[]> = {
    // Sprint, then a dash every cooldown, dash-jumping every other one.
    "dash chain": record(flat, { x: -36, z: 0, facing: Math.PI / 2 }, 4, (time) => {
      const k = Math.floor(time / 0.5);
      const phase = time - k * 0.5;
      return { x: 1, sprint: true, dashPressed: at(phase, 0.02), jumpPressed: k % 2 === 1 && at(phase, 0.25), jump: k % 2 === 1 && phase > 0.25 && phase < 0.4 };
    }),
    // A dash into a crouch slide down a long 0.75 grade (steeper and longer than any painted slope): the downhill ceiling.
    "downhill slide at the ceiling": record(hill(0.75, -30, 30, 23), { x: 0, z: -36 }, 4, (time) => ({ z: 1, sprint: true, dashPressed: at(time, 0.4), sneak: time > 0.65 })),
    // Off the slide into a slide-jump at full downhill speed.
    "slide jump off the hill": record(hill(0.75, -30, 16, 13), { x: 0, z: -36 }, 3.5, (time) => ({
      z: 1,
      sprint: true,
      dashPressed: at(time, 0.4),
      sneak: time > 0.65 && time < 1.9,
      jumpPressed: at(time, 1.9),
      jump: time > 1.9 && time < 2.2,
    })),
    // Run off a 3 u tower, open the leaf with a fresh press while falling and glide it out.
    "glide off a cliff": (() => {
      let opened = false;
      return record(tower(3, 1.5), { x: 0, z: 0 }, 2.5, (_time, s) => {
        // After coyote time, or the press is a late jump rather than the leaf.
        const press = !opened && s.mode === "air" && s.vy < -0.5 && s.coyote <= 0;
        if (press) opened = true;
        return { z: 1, sprint: true, jumpPressed: press, jump: opened };
      }, { tuning: glider });
    })(),
    // §7's case: off a 1.5 u cliff, the leaf opened as soon as coyote time is over.
    "glide off a 1.5 u cliff": (() => {
      let opened = false;
      return record({ top: (_x, z) => (z < 2 ? 1.5 : 0), wet: () => false }, { x: 0, z: -2 }, 2, (_time, s) => {
        const press = !opened && s.mode === "air" && s.vy < -0.5 && s.coyote <= 0;
        if (press) opened = true;
        return { z: 1, sprint: true, jumpPressed: press, jump: opened };
      }, { tuning: glider });
    })(),
    // Walk off a 20 u pillar: the fall reaches the 18 u/s cap.
    "the fall cap": record(tower(20, 1.5), { x: 0, z: 0 }, 3, () => ({ z: 1 })),
    // Bunny-hop: one press, then Space held at a sprint chains the hops to their cap.
    "bunny hop chain": record(flat, { x: 0, z: -36 }, 4, (time) => ({ z: 1, sprint: true, jumpPressed: at(time, 1), jump: time >= 1 })),
    // A jump into the sea: splash, then the respawn back on the shore (flagged).
    "splash and respawn": record(shore(2), { x: 0, z: -3 }, 2.5, (time) => ({ z: 1, sprint: true, jumpPressed: at(time, 0.3), jump: time > 0.3 && time < 0.6 })),
    // Sprint, turn round into a skid, stop, then creep off.
    "skid and stop": record(flat, { x: 0, z: 0 }, 4, (time) => (time < 1.5 ? { z: 1, sprint: true } : time < 2.2 ? { z: -1, sprint: true } : time < 3 ? {} : { x: 0.4 })),
  };
  // Rates between samples depend on where the samples fall: sweep the sender's phase over the two
  // steepest climbs, at the fastest send rate.
  for (let k = 0; k < 8; k++) {
    const phase = k / 120;
    traces[`mantle at full reach, phase ${k}`] = record(cliff(2.4, 3), { x: 0, z: 1.6 }, 1.2, (time) => ({ z: 1, jumpPressed: at(time, 0.05), jump: time < 0.5 }), { phase, fast: true });
    traces[`dash up a ramp, phase ${k}`] = record(ramp(1.5, 2, 2), { x: 0, z: -2 }, 1.2, (time) => ({ z: 1, sprint: true, dashPressed: at(time, 0.1) }), { phase, fast: true });
    // Down a long hill at the downhill ceiling, into a ramp straight back up with a dash at its foot: the most a climb can carry.
    traces[`momentum into a ramp, phase ${k}`] = record(
      { top: (_x, z) => (z < 0 ? Math.min(12, -0.75 * z) : Math.min(1.5, Math.max(0, ((z - 4) / 2) * 1.5))), wet: () => false },
      { x: 0, z: -18 },
      2.5,
      (time, s) => ({ z: 1, sprint: true, dashPressed: at(time, 0.3) || (s.z > 2.6 && s.z < 3.2 && s.dashCd <= 0), sneak: time > 0.45 && s.z < 2.5 }),
      { phase, fast: true },
    );
    traces[`slide down a ramp, phase ${k}`] = record(hill(0.75, 2, 2, 1.5), { x: 0, z: -6 }, 1.5, (time) => ({ z: 1, sprint: true, dashPressed: at(time, 0.4), sneak: time > 0.5 }), { phase, fast: true });
  }
  return traces;
}

export type TraceStats = { maxHSpeed: number; maxHAvg1s: number; maxRise: number; maxFall: number; maxStep300: number; minDt: number; maxDt: number };

/** The sender's worst numbers over consecutive samples (teleport-flagged pairs excluded). */
export function traceStats(samples: TraceSample[]): TraceStats {
  const st: TraceStats = { maxHSpeed: 0, maxHAvg1s: 0, maxRise: 0, maxFall: 0, maxStep300: 0, minDt: Infinity, maxDt: 0 };
  const cum: { t: number; d: number }[] = [{ t: samples[0].t, d: 0 }];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    const dt = (b.t - a.t) / 1000;
    st.minDt = Math.min(st.minDt, b.t - a.t);
    st.maxDt = Math.max(st.maxDt, b.t - a.t);
    if (b.teleport) {
      cum.length = 0;
      cum.push({ t: b.t, d: 0 });
      continue;
    }
    const h = Math.hypot(b.x - a.x, b.z - a.z);
    st.maxHSpeed = Math.max(st.maxHSpeed, h / dt);
    st.maxRise = Math.max(st.maxRise, (b.y - a.y) / dt);
    st.maxFall = Math.max(st.maxFall, (a.y - b.y) / dt);
    if (b.t - a.t <= 300) st.maxStep300 = Math.max(st.maxStep300, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
    const d = cum[cum.length - 1].d + h;
    cum.push({ t: b.t, d });
    const from = [...cum].reverse().find((c) => b.t - c.t >= 1000);
    if (from) st.maxHAvg1s = Math.max(st.maxHAvg1s, ((d - from.d) / (b.t - from.t)) * 1000);
  }
  return st;
}
