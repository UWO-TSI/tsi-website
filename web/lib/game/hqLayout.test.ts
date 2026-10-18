import { describe, expect, it } from "vitest";
import { HQ_FLOOR_HEIGHT as F, HQ_OPTIONS, HQ_SPAWN, createHqWalker, onUpper, walkable, type HqOption, type HqWalker } from "./hqLayout";

/** Walk the walker from where it is towards `to`, a step at a time, the way the game's walker does; where it got to. */
function walkTo(w: HqWalker, from: [number, number], to: [number, number]): [number, number] {
  let [x, z] = from;
  for (let i = 0; i < 400; i++) {
    const d = Math.hypot(to[0] - x, to[1] - z);
    if (d < 1e-6) break;
    const k = Math.min(1, 0.12 / d);
    const [nx, nz] = w.constrain(x, z, x + (to[0] - x) * k, z + (to[1] - z) * k);
    if (Math.hypot(nx - x, nz - z) < 1e-9) break;
    x = nx; z = nz;
  }
  return [x, z];
}
const near = (a: [number, number], b: [number, number], tol = 0.05) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
/** Walk a route of points from the door; the walker at its end. */
function route(o: HqOption, points: [number, number][]): { w: HqWalker; at: [number, number]; ok: boolean } {
  const w = createHqWalker(o);
  let at: [number, number] = [...HQ_SPAWN];
  for (const p of points) {
    at = walkTo(w, at, p);
    if (!near(at, p)) return { w, at, ok: false };
  }
  return { w, at, ok: true };
}
const ground = (o: HqOption) => o.paths.find(p => p.id === "to-stair" || p.id === "to-board-stair")!.points;
const flight = (o: HqOption) => o.paths.find(p => p.id === "flight")!.points;
const upstairsRoute = (o: HqOption): [number, number][] => [...ground(o), ...flight(o), o.paths.find(p => p.id === "upper")!.points[0]];

describe.each(["a", "b"] as const)("HQ layout option %s", id => {
  const o = HQ_OPTIONS[id];

  it("walks every taped path on the ground floor from the door", () => {
    for (const p of o.paths.filter(p => p.level === 0)) {
      const r = route(o, [[0, -3.0], ...p.points]);
      expect(r.ok, `${p.id} stopped at ${r.at.map(v => v.toFixed(2))}`).toBe(true);
      expect(r.w.zone).toBe("ground");
    }
  });

  it("climbs the stair from the door to the upper floor, walks it, and comes back down", () => {
    const up = route(o, upstairsRoute(o));
    expect(up.ok, `stopped at ${up.at.map(v => v.toFixed(2))}`).toBe(true);
    expect(up.w.zone).toBe("upper");
    expect(up.w.height).toBeCloseTo(F);
    // the upper floor's path, end to end
    let at = up.at;
    for (const p of o.paths.find(p => p.id === "upper")!.points.slice(1)) {
      at = walkTo(up.w, at, p);
      expect(near(at, p), `upstairs stopped at ${at.map(v => v.toFixed(2))} short of ${p}`).toBe(true);
    }
    expect(up.w.zone).toBe("upper");
    // and back the way it came, then down to the foot
    const back = [...o.paths.find(p => p.id === "upper")!.points].reverse().concat([...flight(o)].reverse(), [...ground(o)].reverse());
    for (const p of back) at = walkTo(up.w, at, p);
    expect(up.w.zone).toBe("ground");
    expect(up.w.height).toBe(0);
  });

  it("puts every station where you can stand on its own floor", () => {
    for (const s of o.stations) expect(walkable(o, s.level, s.pos[0], s.pos[1]), s.id).toBe(true);
  });

  it("keeps every station HQ already has (the onboarding's desk, board, Founder's desk, and the rest)", () => {
    const ids = o.stations.map(s => s.id);
    for (const id of ["exit", "desk", "board", "founder", "display", "shelf", "clock", "bench"]) expect(ids).toContain(id);
  });

  it("never lets you off the upper floor's edge, and never under or beside the flight", () => {
    const up = route(o, upstairsRoute(o));
    // straight at the middle of the room (the open hall), from the landing
    const at = walkTo(up.w, up.at, [0, 0]);
    expect(onUpper(o, at[0], at[1]) || up.w.zone !== "upper").toBe(true);
    expect(up.w.zone).toBe("upper");
    // downstairs, alongside the flight past its foot
    const s = o.stair, mid = (s.foot + s.head) / 2;
    expect(walkable(o, 0, (s.x0 + s.x1) / 2, mid)).toBe(false);
  });

  it("makes the aquarium two storeys tall, the ground lounge in front of it", () => {
    expect(o.aquarium.y1).toBeGreaterThan(2 * F - 0.5);
    const lounge = o.fixtures.find(f => f.id === "ground-lounge")!;
    const a = o.aquarium, rug = lounge.blocks[0];
    const gap = a.facing === "-x" ? a.x0 - (rug.at[0] + rug.size[0] / 2) : a.z0 - (rug.at[2] + rug.size[2] / 2);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(1.5);
  });

  it("shows the upper floor from the door where it isn't overhead, and cuts each part away while you're under it, without flicker", () => {
    const w = createHqWalker(o);
    w.constrain(HQ_SPAWN[0], HQ_SPAWN[1], HQ_SPAWN[0], HQ_SPAWN[1]);
    const overDoor = o.upper.map(r => HQ_SPAWN[0] > r.x0 && HQ_SPAWN[0] < r.x1 && HQ_SPAWN[1] > r.z0 && HQ_SPAWN[1] < r.z1);
    expect(w.shown).toEqual(overDoor.map(v => !v));
    // walk to the middle of the open hall: every part shows from there
    let at = walkTo(w, HQ_SPAWN, [0, 0.5]);
    expect(w.shown.every(Boolean)).toBe(true);
    // and under the first part's middle it's cut away, the others still shown
    const r = o.upper[0], mid: [number, number] = [(r.x0 + r.x1) / 2 + (id === "a" ? -4 : 0), (r.z0 + r.z1) / 2];
    at = walkTo(w, at, mid);
    expect(w.shown[0]).toBe(false);
    // stepping back across the edge by a little doesn't bring it back (hysteresis)...
    const edge = id === "a" ? r.z0 + 0.3 : r.z1 - 0.3;
    at = walkTo(w, at, [at[0], edge]);
    expect(w.shown[0]).toBe(false);
    // ...stepping out does
    walkTo(w, at, [at[0], id === "a" ? r.z0 - 1.0 : r.z1 + 1.0]);
    expect(w.shown[0]).toBe(true);
  });

  it("hangs a blank banner per year along the upper floor's edge, and has locked admin doors upstairs", () => {
    const banners = o.fixtures.filter(f => f.id.startsWith("banner-"));
    expect(banners.length).toBeGreaterThanOrEqual(6);
    expect(banners.every(f => f.level === 1 && f.blocks.some(b => b.finish === "banner"))).toBe(true);
    expect(o.stations.filter(s => s.action === "locked" && s.level === 1).length).toBeGreaterThanOrEqual(2);
  });
});
