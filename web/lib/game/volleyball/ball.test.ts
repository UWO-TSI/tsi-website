import { describe, expect, it } from "vitest";
import { arcTo, driveTo, predictLanding, stepBall, timeToHeight, type Ball } from "./ball";
import { BALL_R, COURT, COURT_GROW, inCourt, toLocal, toWorld } from "./court";

const fly = (b: Ball) => { for (let i = 0; i < 2400; i++) { const e = stepBall(b, 1 / 120); if (e) return e; } return null; };

describe("the court", () => {
  it("is 16 x 8 m and a 2.43 m net, scaled to a 1.36 u character, then grown (David: bigger)", () => {
    expect(COURT.halfLength * 2 / (COURT.halfWidth * 2)).toBeCloseTo(2);
    expect(COURT.netTop).toBeCloseTo(1.886 * COURT_GROW.net, 2);
    expect(COURT.halfLength * 2).toBeCloseTo(12.42 * COURT_GROW.plan, 1);
  });
  it("counts a ball on the line as in", () => {
    expect(inCourt(COURT.halfWidth + BALL_R * 0.9, 0)).toBe(true);
    expect(inCourt(COURT.halfWidth + BALL_R * 1.1, 0)).toBe(false);
  });
  it("maps the court's frame to the world and back", () => {
    const p = { x: -4, z: 103.5, yaw: Math.PI / 2 };
    const [wx, wz] = toWorld(p, 1, 2);
    expect(toLocal(p, wx, wz).map(v => +v.toFixed(6))).toEqual([1, 2]);
    expect(wx).toBeCloseTo(-2); expect(wz).toBeCloseTo(102.5); // local +z runs along world +x at a quarter turn
  });
});

describe("the ball", () => {
  it("lands near where a lob is aimed, after peaking at the apex", () => {
    const from = { x: 0, y: 1, z: -5 }, to = { x: 1, y: 0.1, z: 3 };
    const b = { ...from, ...arcTo(from, to, 5) };
    let top = 0;
    for (let i = 0; i < 2400; i++) { const e = stepBall(b, 1 / 120); top = Math.max(top, b.y); if (e?.kind === "land") break; }
    expect(top).toBeGreaterThan(4.8);
    expect(Math.hypot(b.x - to.x, b.z - to.z)).toBeLessThan(0.4);
  });
  it("drives through a point at a horizontal speed", () => {
    const from = { x: 0, y: 3, z: -1 }, to = { x: 0, y: 0.1, z: 4 };
    const b = { ...from, ...driveTo(from, to, 18) };
    expect(fly(b)).toMatchObject({ kind: "land", in: true });
    expect(b.z).toBeCloseTo(4, 0);
  });
  it("bounces back off the net's mesh and lands on the side it came from", () => {
    const from = { x: 0, y: 1.9, z: -3 }, b = { ...from, ...driveTo(from, { x: 0, y: 1.9, z: 3 }, 12) };
    // aimed flat at the mesh
    b.vy = 0;
    let net = false;
    for (let i = 0; i < 2400; i++) { const e = stepBall(b, 1 / 120); if (e?.kind === "net") net = true; if (e?.kind === "land") break; }
    expect(net).toBe(true);
    expect(b.z).toBeLessThan(0);
  });
  it("flags a crossing outside the antennae", () => {
    const b = { x: COURT.halfWidth + 1, y: 3, z: -1, vx: 0, vy: 0, vz: 10 };
    expect(fly(b)).toEqual({ kind: "antenna" });
  });
  it("predicts its landing and the moment it comes down through a height", () => {
    const b = { x: 0, y: 2, z: -2, vx: 0, vy: 6, vz: 1 };
    const p = predictLanding(b)!, t = timeToHeight(b, 1)!;
    expect(p.z).toBeGreaterThan(-2);
    expect(t).toBeGreaterThan(0.9);
    const c = { ...b };
    for (let s = 0; s < Math.round(t * 120); s++) stepBall(c, 1 / 120);
    expect(c.y).toBeCloseTo(1, 0);
  });
});
