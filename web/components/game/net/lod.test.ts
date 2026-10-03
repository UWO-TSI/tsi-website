import { describe, expect, it } from "vitest";
import { FULL, HIDDEN, LOD, LOD_CAPS, REDUCED, assignLod, createLodEntry, createLodScratch, type LodEntry } from "./lod";

const at = (dist: number, o: Partial<LodEntry> = {}): LodEntry => ({ ...createLodEntry(), dist, inView: true, ...o });
const tiers = (es: LodEntry[]) => es.map(e => "FRH"[e.tier]).join("");
const run = (es: LodEntry[], caps = LOD_CAPS.high) => { assignLod(es, es.length, caps, createLodScratch(64)); return es; };

describe("render tiers (spec §5.5)", () => {
  it("draws the nearest 12 in full and the next 12 reduced on High, 8 and 8 on Light, and hides the rest", () => {
    const crowd = () => Array.from({ length: 30 }, (_, i) => at(0.5 + i * 0.6));
    expect(tiers(run(crowd()))).toBe("F".repeat(12) + "R".repeat(12) + "H".repeat(6));
    expect(tiers(run(crowd(), LOD_CAPS.light))).toBe("F".repeat(8) + "R".repeat(8) + "H".repeat(14));
  });

  it("keeps Full within 20 u and in view, Reduced within 40 u", () => {
    const es = run([at(19), at(21), at(5, { inView: false }), at(39), at(41)]);
    expect(es.map(e => e.tier)).toEqual([FULL, REDUCED, REDUCED, REDUCED, HIDDEN]);
  });

  it("never draws a phone rester in full", () => {
    expect(run([at(2, { phone: true })])[0].tier).toBe(REDUCED);
  });

  it("holds a tier 2 u past its line, and lets it go beyond", () => {
    const e = at(19);
    run([e]);
    expect(e.tier).toBe(FULL);
    e.dist = 21.5;
    run([e]);
    expect(e.tier).toBe(FULL);
    e.dist = 22.5;
    run([e]);
    expect(e.tier).toBe(REDUCED);
    e.dist = 21.5; // coming back: Full again only inside 20
    run([e]);
    expect(e.tier).toBe(REDUCED);
    e.dist = 41.5;
    run([e]);
    expect(e.tier).toBe(REDUCED);
    e.dist = 42.5;
    run([e]);
    expect(e.tier).toBe(HIDDEN);
    e.dist = 41;
    run([e]);
    expect(e.tier).toBe(HIDDEN);
  });

  it("doesn't trade a slot between two players at the same distance every re-tier", () => {
    const es = Array.from({ length: 13 }, (_, i) => at(5 + i * 0.1));
    run(es);
    expect(es[12].tier).toBe(REDUCED);
    // The 13th walks up level with the 12th, then a little nearer: the 12th keeps its slot until it is 2 u farther.
    es[12].dist = es[11].dist;
    run(es);
    expect(es[11].tier).toBe(FULL);
    es[12].dist = es[11].dist - 1;
    run(es);
    expect([es[11].tier, es[12].tier]).toEqual([FULL, REDUCED]);
    es[12].dist = es[11].dist - 2.5;
    run(es);
    expect([es[11].tier, es[12].tier]).toEqual([REDUCED, FULL]);
  });

  it("gives at most 8 auras, to the nearest Full players who show one", () => {
    const es = Array.from({ length: 12 }, (_, i) => at(1 + i, { hasAura: i !== 2 }));
    run(es);
    expect(es.filter(e => e.aura).length).toBe(LOD.auras);
    expect(es[2].aura).toBe(false);
    expect(es[8].aura).toBe(true);
    expect(es[9].aura).toBe(false);
    const reduced = run([at(30, { hasAura: true })]);
    expect(reduced[0].aura).toBe(false);
  });

  it("shows a real player's plate within 22 u whatever the tier, the nearest 12", () => {
    const es = run([at(3), at(21, { inView: false }), at(23), at(15, { phone: true })]);
    expect(es.map(e => e.plate)).toEqual([true, true, false, true]);
    const many = run(Array.from({ length: 16 }, (_, i) => at(1 + i)));
    expect(many.filter(e => e.plate).length).toBe(LOD.plates);
    expect(many[15].plate).toBe(false);
  });
});
