import { describe, expect, it } from "vitest";
import { BUOYS, FINGER, MOORED, ROWBOAT, ROWBOATS, SEA_Y, deckPieces, dockToWorld, fitPlane, floatBoat, floatBuoy, floatRowboat, mooredPose, newBoatPose, newFloat, newRide, worldToDock, type Dock } from "./wharf";
import { TRAINS, waterWaveAt, waveState } from "./waves";
import { mirrorWaterField } from "./waterField";
import { TUNING_DEFAULTS } from "./tuning";

const SEA = TUNING_DEFAULTS.water;
/** The most the sea rises or falls: the swell and the wind waves together. */
const RANGE = SEA.swellHeight + SEA.waveHeight * TRAINS.slice(1).reduce((s, t) => s + t.amp, 0);
const CALM = { ...SEA, waveHeight: 0, swellHeight: 0 };
const VILLAGE: Dock = { x: 8, z: -19.5, yaw: 0 }, TURNED: Dock = { x: -3, z: 4, yaw: 0.8 };

describe("the wharf's boat and buoys ride the waves", () => {
  it("maps between a dock's frame and the world both ways", () => {
    const w = { x: 0, z: 0 }, l = { x: 0, z: 0 };
    for (const d of [VILLAGE, TURNED]) {
      dockToWorld(d, 1.3, -2.2, w);
      worldToDock(d, w.x, w.z, l);
      expect(l.x).toBeCloseTo(1.3, 9);
      expect(l.z).toBeCloseTo(-2.2, 9);
    }
    // A turned dock carries its +z (inland along the pier) round with it.
    dockToWorld(TURNED, 0, 1, w);
    expect([w.x - TURNED.x, w.z - TURNED.z].map(v => +v.toFixed(6))).toEqual([+Math.sin(0.8).toFixed(6), +Math.cos(0.8).toFixed(6)]);
  });

  it("fits the plane through the water under its hull: exact on a plane, least squares otherwise", () => {
    const p = { a: 0, b: 0, c: 0 }, u = [0, 0, 0.9, -0.9], v = [1.5, -0.7, 0.4, 0.4];
    fitPlane(u, v, u.map((x, i) => 0.3 + 0.1 * x - 0.05 * v[i]), 4, p);
    expect([p.a, p.b, p.c].map(x => +x.toFixed(9))).toEqual([0.3, 0.1, -0.05]);
    // A bump under the bow alone: the plane leans to it, and the residuals sum to nothing.
    const h = [0.2, 0, 0, 0];
    fitPlane(u, v, h, 4, p);
    expect(p.c).toBeGreaterThan(0);
    expect(h.reduce((s, x, i) => s + x - (p.a + p.b * u[i] + p.c * v[i]), 0)).toBeCloseTo(0, 9);
  });

  it("sits on the plane the water makes under it and leans with it, rising and falling with the waves", () => {
    const pose = mooredPose(newBoatPose()), f = newFloat(), at = { x: 0, z: 0 };
    let lowest = Infinity, highest = -Infinity, steepest = 0;
    for (let t = 0; t < 30; t += 0.25) {
      const w = waveState(SEA, t);
      floatBoat(VILLAGE, pose, w, f);
      // Within a few hundredths of the water at its middle: a hull 2.2 long spans the waves' curve, so not exactly.
      dockToWorld(VILLAGE, MOORED.x, MOORED.z + 0.4, at);
      expect(Math.abs(f.y - (SEA_Y + waterWaveAt(at.x, at.z, w)))).toBeLessThan(RANGE * 0.5);
      lowest = Math.min(lowest, f.y); highest = Math.max(highest, f.y);
      steepest = Math.max(steepest, Math.abs(f.pitch), Math.abs(f.roll));
    }
    expect(highest - lowest).toBeGreaterThan(SEA.swellHeight);
    expect(steepest).toBeGreaterThan(0.01);
    expect(steepest).toBeLessThan(0.15);
  });

  it("rocks on a spring: in contact with the water, smoother than it, settling after a long pause", () => {
    const pose = mooredPose(newBoatPose()), ride = newRide(), raw = newFloat(), f = newFloat(), dt = 1 / 60;
    let gap = 0, jerkRaw = 0, jerkRide = 0, prev = [0, 0, 0], prevRaw = [0, 0, 0];
    for (let i = 0; i < 1800; i++) {
      const w = waveState(SEA, i * dt);
      floatBoat(VILLAGE, pose, w, raw);
      floatBoat(VILLAGE, pose, w, f, ride, dt);
      if (i > 120) {
        gap = Math.max(gap, Math.abs(f.y - raw.y));
        // How sharply each turns (the change of its pitch's rate): the spring's is gentler.
        jerkRaw = Math.max(jerkRaw, Math.abs(raw.pitch - 2 * prevRaw[1] + prevRaw[0]));
        jerkRide = Math.max(jerkRide, Math.abs(f.pitch - 2 * prev[1] + prev[0]));
      }
      prev = [prev[1], f.pitch, 0]; prevRaw = [prevRaw[1], raw.pitch, 0];
    }
    expect(gap).toBeLessThan(0.03);
    expect(jerkRide).toBeLessThan(jerkRaw);
    // Back from a pause (a long frame): straight onto the water, at rest.
    floatBoat(VILLAGE, pose, waveState(SEA, 999), f, ride, 5);
    floatBoat(VILLAGE, pose, waveState(SEA, 999), raw);
    expect(f.y).toBeCloseTo(raw.y, 9);
  });

  it("rocks less in the calmed berth than out on the open sea", () => {
    const rock = (pose: ReturnType<typeof newBoatPose>) => {
      const f = newFloat();
      let lo = Infinity, hi = -Infinity, tilt = 0;
      for (let t = 0; t < 30; t += 0.25) { floatBoat(VILLAGE, pose, waveState(SEA, t), f); lo = Math.min(lo, f.y); hi = Math.max(hi, f.y); tilt = Math.max(tilt, Math.abs(f.pitch) + Math.abs(f.roll)); }
      return [hi - lo, tilt];
    };
    // Calm 0.3 in a square round the mooring, the open sea (deep, 1) elsewhere.
    const n = 200, calm = new Float32Array(n * n).fill(1), depth = new Float32Array(n * n).fill(4);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (Math.abs(i - 100 - (VILLAGE.x + MOORED.x)) < 6 && Math.abs(j - 100 - (VILLAGE.z + MOORED.z)) < 6) calm[j * n + i] = 0.3;
    mirrorWaterField({ data: depth, width: n, height: n, minX: -100, minZ: -100, sizeX: n, sizeZ: n }, { data: calm, width: n, height: n, minX: -100, minZ: -100, sizeX: n, sizeZ: n });
    const berth = rock(mooredPose(newBoatPose())), sea = rock({ ...mooredPose(newBoatPose()), z: MOORED.z - 30 });
    mirrorWaterField(null, null);
    expect(berth[0]).toBeLessThan(sea[0] * 0.45);
    expect(berth[1]).toBeLessThan(sea[1] * 0.45);
  });

  it("dips toward the pier as someone steps aboard and rocks back, and rolls off the fenders when it comes alongside", () => {
    const calm = waveState(CALM, 0), f = newFloat(), pose = mooredPose(newBoatPose());
    floatBoat(VILLAGE, pose, calm, f);
    const still = f.y;
    expect(Math.abs(f.pitch) + Math.abs(f.roll) + Math.abs(f.sway)).toBe(0);
    floatBoat(VILLAGE, { ...pose, dip: 0.08 }, calm, f);
    expect(f.y).toBeLessThan(still - 0.02);
    expect(f.roll).toBeLessThan(0); // starboard, the pier's side, goes down
    floatBoat(VILLAGE, { ...pose, dip: 4 }, calm, f);
    expect(Math.abs(f.y - still)).toBeLessThan(0.002);
    floatBoat(VILLAGE, { ...pose, bump: 0.2 }, calm, f);
    expect(f.sway).toBeGreaterThan(0); // pushed off the pier, toward +x
  });

  it("noses up and skips over the chop when it is going", () => {
    const f = newFloat(), going = { ...mooredPose(newBoatPose()), speed: 7, throttle: 1 };
    let nose = 0;
    for (let t = 0; t < 3; t += 0.05) { floatBoat(VILLAGE, going, waveState(CALM, t), f); nose += f.pitch; }
    expect(nose / 60).toBeLessThan(-0.02); // bow up is negative rotation.x
  });

  it("keeps its buoys on the water, out of the boat's way", () => {
    const f = newFloat();
    for (const [x, z] of BUOYS) {
      expect(Math.hypot(x - MOORED.x, z - MOORED.z)).toBeGreaterThan(3);
      floatBuoy(VILLAGE, x, z, waveState(SEA, 12), f);
      expect(Math.abs(f.y - SEA_Y)).toBeLessThanOrEqual(RANGE + 1e-9);
      expect(Math.abs(f.pitch) + Math.abs(f.roll)).toBeLessThan(0.3);
    }
  });
});

// v1 water item 7: the wharf in the reference's style (art/wharf/build_wharf.py): a finger pier off the tip you can
// walk out on, lantern poles, rowboats moored along it. Its landmark door and arrival point stay where they were.
describe("the wharf's finger pier and rowboats", () => {
  it("keeps the wharf landmark's door and arrival point where they were", async () => {
    const { LANDMARK_INFO } = await import("./defaultIsland");
    expect(LANDMARK_INFO.wharf.door).toEqual([0, -2.5]);
    expect(LANDMARK_INFO.wharf.exit).toEqual([0, 1.1]);
  });
  it("moors the rowboats clear of the finger, the boat's berth and its lane", () => {
    for (const rb of ROWBOATS) {
      const halfLen = ROWBOAT.length / 2, halfBeam = ROWBOAT.beam / 2;
      // Lying along the finger (bow along ±x), beside it, not on it.
      expect(Math.abs(Math.sin(rb.yaw))).toBeGreaterThan(0.95);
      expect(rb.z + halfBeam < FINGER.z0 || rb.z - halfBeam > FINGER.z1).toBe(true);
      expect(rb.x + halfLen).toBeLessThan(FINGER.x1);
      expect(Math.hypot(rb.x - MOORED.x, rb.z - MOORED.z)).toBeGreaterThan(4);
      for (const [bx, bz] of BUOYS) expect(Math.hypot(rb.x - bx, rb.z - bz)).toBeGreaterThan(4);
      // Its line to a post on the finger that stands on its side.
      expect(FINGER.postX).toContain(rb.post[0]);
    }
  });
  it("floats the rowboats on the same waves as everything else, gently", () => {
    const f = newFloat();
    for (const rb of ROWBOATS) for (let t = 0; t < 30; t += 0.5) {
      floatRowboat(VILLAGE, rb, waveState(SEA, t), f);
      expect(Math.abs(f.y - SEA_Y)).toBeLessThanOrEqual(RANGE + 1e-9);
      expect(Math.abs(f.pitch) + Math.abs(f.roll)).toBeLessThan(0.15);
    }
  });
});

describe("the wharf kit on the deck squares", () => {
  // A row of squares along z at the water's edge (yaw -pi/2 turns local -z toward +x, the sea past x 4) and one inland row.
  const ground = (x: number) => (x > 4 ? -1.4 : 1);
  const row = (x: number) => Array.from({ length: 10 }, (_, i) => ({ x, z: i * 4, yaw: -Math.PI / 2 }));

  it("lays a tile on every square at its ground, and rope-lashed piles only along the water's edge", () => {
    const pieces = deckPieces([...row(2), ...row(-2)], ground);
    expect(pieces.filter(p => p.model === "deck-tile").length).toBe(20);
    const piles = pieces.filter(p => p.model === "dock-pile-rope");
    expect(piles.length).toBe(20);
    for (const p of piles) { expect(Math.abs(p.x - 4.2)).toBeLessThan(0.05); expect(p.y).toBe(1); }
  });

  it("puts ladders with life rings, rope nets and rope fencing on some edge squares, none near the jetty's landing", () => {
    const all = deckPieces(row(2), ground), kept = deckPieces(row(2), ground, { x: 0, z: 18 }, 7);
    expect(all.some(p => p.model === "wharf-ladder")).toBe(true);
    for (const m of ["rope-span", "rope-net", "life-ring"]) expect(all.some(p => p.model === m), m).toBe(true);
    for (const p of kept) if (p.model !== "deck-tile" && p.model !== "dock-pile-rope") expect(Math.abs(p.z - 18)).toBeGreaterThan(5);
  });
});
