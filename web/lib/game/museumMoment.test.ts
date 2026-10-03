import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { DONATE_FADE_MS, SETTLE_WAIT_MS, donatedAt, fadeInto, markDonated, newSettle, settleStep } from "./museumMoment";

describe("a donation settling into its case", () => {
  it("fades the specimen in from nothing, growing into place with a little settle, never popping", () => {
    expect(fadeInto(0)).toMatchObject({ opacity: 0 });
    let prev = 0;
    for (let t = 0; t <= DONATE_FADE_MS; t += 25) { const f = fadeInto(t); expect(f.opacity).toBeGreaterThanOrEqual(prev - 1e-9); prev = f.opacity; }
    expect(fadeInto(DONATE_FADE_MS)).toEqual({ opacity: 1, scale: 1, rise: 0 });
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => fadeInto(i * 30).scale))).toBeGreaterThan(1);
  });

  it("is finished, solid and still, for a specimen that was always there", () => {
    expect(fadeInto(Infinity)).toEqual({ opacity: 1, scale: 1, rise: 0 });
  });

  it("remembers what was just donated, by species, for its case to find", () => {
    expect(donatedAt("fish_dace")).toBeNull();
    markDonated("fish_dace", 1234);
    expect(donatedAt("fish_dace")).toBe(1234);
  });
});

describe("the specimen's settle in the room (settleStep)", () => {
  const mesh = () => new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial());
  it("waits, hidden, for its model to load, then fades it in on its own materials with its moment once", () => {
    const g = new THREE.Group(), s = newSettle();
    let moments = 0;
    settleStep(g, 1000, s, 1100, () => moments++);
    expect(moments).toBe(0);
    expect(g.scale.x).toBeLessThan(0.01);
    const m = mesh(), shared = m.material;
    g.add(m);
    settleStep(g, 1000, s, 1600, () => moments++);
    expect(moments).toBe(1);
    expect(m.material).not.toBe(shared);
    expect((m.material as THREE.Material).opacity).toBe(0);
    settleStep(g, 1000, s, 1600 + DONATE_FADE_MS / 2, () => moments++);
    expect((m.material as THREE.Material).opacity).toBeGreaterThan(0);
    settleStep(g, 1000, s, 1600 + DONATE_FADE_MS, () => moments++);
    expect((m.material as THREE.Material).opacity).toBe(1);
    expect(g.scale.x).toBe(1);
    settleStep(g, 1000, s, 1600 + DONATE_FADE_MS * 3, () => moments++);
    expect(moments).toBe(1);
  });

  it("shows one donated earlier as it is, with no moment, when you come back to the room", () => {
    const g = new THREE.Group(), s = newSettle();
    g.add(mesh());
    let moments = 0;
    settleStep(g, 1000, s, 1000 + SETTLE_WAIT_MS + 60_000, () => moments++);
    expect(moments).toBe(0);
    expect(g.scale.x).toBe(1);
  });

  it("leaves a specimen that was always there alone", () => {
    const g = new THREE.Group(), s = newSettle();
    g.add(mesh());
    let moments = 0;
    settleStep(g, null, s, 5000, () => moments++);
    expect(moments).toBe(0);
    expect(g.scale.x).toBe(1);
  });
});
