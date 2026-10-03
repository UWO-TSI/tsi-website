/**
 * The move target (specs/polish/arrival-wharf.md deliverable 4): where a tap sends you, marked with our painted
 * marker from the particle pack, lying on the ground's slope. It lands soft (a little overshoot), breathes while you
 * walk to it, presses down and fades as you arrive, and shrinks away quicker if you walk off another way. Pure, so the
 * timing is tested; components/game/MoveTargetIndicator.tsx draws it, lit like the ground round it.
 */

export type MarkPhase = "idle" | "appear" | "hold" | "arrive" | "cancel";
export interface MoveMark {
  phase: MarkPhase;
  /** Seconds in the phase. */
  t: number;
  /** Where it lies (world) and the ground's normal there. */
  x: number; y: number; z: number; nx: number; ny: number; nz: number;
}
/** Times (s), the opacity it holds at, and the breath (scale ± over a period). */
export const MARK = { appear: 0.24, arrive: 0.34, cancel: 0.2, opacity: 0.92, breath: 0.035, breathPeriod: 1.6 } as const;

export const newMoveMark = (): MoveMark => ({ phase: "idle", t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0 });

/** Put it down at (x, z) on `ground`, along the slope there (a finite difference over a step either way). */
export function placeMark(m: MoveMark, x: number, z: number, ground: (x: number, z: number) => number) {
  const e = 0.25, dx = (ground(x + e, z) - ground(x - e, z)) / (2 * e), dz = (ground(x, z + e) - ground(x, z - e)) / (2 * e);
  const k = 1 / Math.hypot(dx, 1, dz);
  m.phase = "appear"; m.t = 0;
  m.x = x; m.y = ground(x, z); m.z = z;
  m.nx = dx === 0 ? 0 : -dx * k; m.ny = k; m.nz = dz === 0 ? 0 : -dz * k;
  return m;
}

/** The walk to it is over: you got there (it presses down) or went another way (it shrinks away). */
export function settleMark(m: MoveMark, arrived: boolean) {
  if (m.phase !== "appear" && m.phase !== "hold") return;
  m.phase = arrived ? "arrive" : "cancel";
  m.t = 0;
}

export function stepMark(m: MoveMark, dt: number) {
  if (m.phase === "idle") return;
  m.t += dt;
  if (m.phase === "appear" && m.t >= MARK.appear) { m.phase = "hold"; m.t -= MARK.appear; }
  else if ((m.phase === "arrive" && m.t >= MARK.arrive) || (m.phase === "cancel" && m.t >= MARK.cancel)) { m.phase = "idle"; m.t = 0; }
}

const easeOutBack = (k: number) => { const c = 1.9; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; };
/** How it looks now: its scale (1 at rest) and opacity. */
export function markLook(m: MoveMark, out: { scale: number; opacity: number }) {
  switch (m.phase) {
    case "appear": {
      const k = Math.min(1, m.t / MARK.appear);
      out.scale = 0.55 + 0.45 * easeOutBack(k);
      out.opacity = MARK.opacity * Math.min(1, k * 1.6);
      return out;
    }
    case "hold":
      out.scale = 1 + MARK.breath * Math.sin((m.t / MARK.breathPeriod) * Math.PI * 2);
      out.opacity = MARK.opacity;
      return out;
    case "arrive": {
      const k = Math.min(1, m.t / MARK.arrive), e = 1 - (1 - k) ** 2;
      out.scale = 1 + 0.24 * e;
      out.opacity = MARK.opacity * (1 - e);
      return out;
    }
    case "cancel": {
      const k = Math.min(1, m.t / MARK.cancel);
      out.scale = 1 - 0.25 * k;
      out.opacity = MARK.opacity * (1 - k);
      return out;
    }
    default:
      out.scale = 1; out.opacity = 0;
      return out;
  }
}
