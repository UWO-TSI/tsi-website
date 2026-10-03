import { describe, expect, it } from "vitest";
import { DT, ME, never, dummy, setup, frame, holdFire, tap, dealt } from "./rig";
import { GUNSLINGER } from "@/lib/combat/rangerKits";
import { ULT } from "@/lib/combat/ult";
import { attack } from "../actions";
import { classKey, classReload, pressUlt, stepClass } from "../classRuntime";

describe("Gunslinger: the cylinder, active reload, Last Round, the keys, Russian Roulette", () => {
  it("mastery raises reload speed (its stat direction): ×1 to ×1.4", () => {
    expect([setup(GUNSLINGER, 1).rt.v2!.mods.reload, setup(GUNSLINGER, 20).rt.v2!.mods.reload]).toEqual([1, 1.4]);
  });
  it("six rounds, then a 1.2 s reload with no shots; the reload stat at 20 makes it 0.86 s", () => {
    const { rt } = setup(GUNSLINGER);
    dummy(rt, 0, 6);
    let shots = 0, t = 0;
    for (; shots < 6; t += DT) { if (attack(rt, ME, never)) shots++; frame(rt); }
    expect(rt.v2!.live.ammo).toBe(0);
    expect(rt.v2!.live.reload).not.toBeNull();
    expect(holdFire(rt, 1.1)).toBe(0);
    expect(holdFire(rt, 0.3)).toBeGreaterThan(0);
    const top = setup(GUNSLINGER, 20);
    top.rt.v2!.live.ammo = 0; attack(top.rt, ME, never);
    frame(top.rt, Math.ceil(0.87 / DT));
    expect(top.rt.v2!.live.reload).toBeNull();
  });
  it("active reload: R in the gold zone reloads at once and the next six deal +25%; outside it jams 0.6 s longer", () => {
    const { rt } = setup(GUNSLINGER);
    rt.v2!.live.ammo = 0; classReload(rt, ME);
    frame(rt, Math.round(0.55 * 1.2 / DT));
    classReload(rt, ME);
    expect(rt.v2!.live.ammo).toBe(6);
    expect(rt.v2!.live.bonus).toBe(6);
    const b = setup(GUNSLINGER);
    b.rt.v2!.live.ammo = 0; classReload(b.rt, ME);
    frame(b.rt, 3); classReload(b.rt, ME);
    expect(b.rt.v2!.live.reloadLen).toBeCloseTo(1.8);
    classReload(b.rt, ME); // one try a reload
    expect(b.rt.v2!.live.reloadLen).toBeCloseTo(1.8);
  });
  it("Last Round: the sixth chamber always crits", () => {
    const { rt } = setup(GUNSLINGER);
    dummy(rt, 0, 4);
    const crits: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      while (!attack(rt, ME, never)) frame(rt);
      const before = rt.floaters.filter(f => f.kind === "crit").length;
      frame(rt, 3);
      crits.push(rt.floaters.filter(f => f.kind === "crit").length > before);
    }
    expect(crits).toEqual([false, false, false, false, false, true]);
  });
  it("Fan the Hammer fires what's left, one shot a round, and empties the cylinder (the last chamber's a crit)", () => {
    const { rt } = setup(GUNSLINGER);
    dummy(rt, 0, 4);
    attack(rt, ME, never); frame(rt, 13); attack(rt, ME, never); frame(rt); // two rounds out (2.6 a second)
    const seq = rt.seq;
    classKey(rt, 0, true); classKey(rt, 0, false); stepClass(rt, ME, DT, DT, never);
    expect(rt.projectiles.filter(s => s.id >= seq).length).toBe(4);
    expect(rt.v2!.live.ammo).toBe(0);
    expect(rt.v2!.live.reload).not.toBeNull();
    expect(rt.projectiles.filter(s => s.hit?.crit).length).toBe(1);
    expect(setup(GUNSLINGER).rt.v2 && (() => { const s = setup(GUNSLINGER); s.rt.v2!.live.ammo = 0; s.rt.v2!.live.reload = 0; tap(s.rt, 0); return s.rt.floaters.some(f => f.text === "Reload first"); })()).toBe(true);
  });
  it("Trick Shot ricochets through up to four enemies", () => {
    const { rt } = setup(GUNSLINGER);
    const es = [dummy(rt, 0, 5), dummy(rt, 3, 6), dummy(rt, 6, 7), dummy(rt, 9, 8), dummy(rt, 12, 9)];
    rt.player.aim = { x: 0, z: 5 };
    tap(rt, 1); frame(rt, 40);
    expect(es.map(e => dealt(e) > 0)).toEqual([true, true, true, true, false]);
  });
  it("Special Rounds: the next three shots explode", () => {
    const { rt } = setup(GUNSLINGER);
    const e = dummy(rt, 0, 5), side = dummy(rt, 1.2, 5.4);
    tap(rt, 2);
    expect(rt.v2!.live.loaded).toEqual(["explosive", "explosive", "explosive"]);
    holdFire(rt, 0.4);
    expect(dealt(e)).toBeGreaterThan(0);
    expect(dealt(side)).toBeGreaterThan(0);
  });
  it("Roll Reload (mastery 3): an untouchable roll that thumbs in two rounds", () => {
    const { rt, p } = setup(GUNSLINGER, 3);
    rt.v2!.live.ammo = 1;
    tap(rt, 3);
    expect(rt.v2!.live.ammo).toBe(3);
    expect(p.dash?.iframes).toBe(true);
  });
  it("Quickdraw: only right after a reload; ×2 and a stagger", () => {
    const { rt } = setup(GUNSLINGER);
    const e = dummy(rt, 0, 5);
    tap(rt, 4);
    expect(rt.floaters.some(f => f.text === "Right after a reload")).toBe(true);
    rt.v2!.live.ammo = 0; classReload(rt, ME); frame(rt, Math.ceil(1.21 / DT));
    tap(rt, 4); frame(rt, 4);
    expect(e.status.hold).toBeGreaterThan(0);
    expect(dealt(e)).toBeGreaterThan(0);
  });
  it("Russian Roulette: one warhead and five golden rounds, spun (each chamber equally likely), a cocked hammer between shots, 10 s", () => {
    const where = [0, 0, 0, 0, 0, 0];
    for (let seed = 1; seed <= 600; seed++) {
      const { rt } = setup(GUNSLINGER);
      let s = seed * 0x9e3779b9;
      const random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      rt.v2!.meter = ULT.max; pressUlt(rt);
      stepClass(rt, ME, 0.6, 0.6, random);
      const loaded = rt.v2!.live.loaded;
      expect([...loaded].sort()).toEqual(["gold", "gold", "gold", "gold", "gold", "warhead"]);
      where[loaded.indexOf("warhead")]++;
    }
    for (const n of where) { expect(n).toBeGreaterThan(70); expect(n).toBeLessThan(130); } // 100 each, give or take
    const { rt } = setup(GUNSLINGER);
    dummy(rt, 0, 8);
    rt.v2!.meter = ULT.max; pressUlt(rt); frame(rt, 18);
    expect(attack(rt, ME, never)).toBe(true);
    rt.player.attackCd = 0;
    expect(attack(rt, ME, never)).toBe(false); // the hammer isn't cocked yet
    let fired = 1;
    for (let t = 0; t < 6 && rt.v2!.live.cockEvery > 0; t += DT) { if (attack(rt, ME, never)) fired++; frame(rt); }
    expect(fired).toBe(6);
    expect(rt.v2!.cast?.shift).toBeDefined(); // the warhead replayed the sequence
    expect(rt.v2!.cast?.big).toBe(true);
    expect(rt.v2!.live.loaded).toEqual([]);
    expect(rt.v2!.live.ammo).toBe(6); // a fresh cylinder of plain rounds after
    const late = setup(GUNSLINGER);
    late.rt.v2!.meter = ULT.max; pressUlt(late.rt); frame(late.rt, Math.ceil(10.6 / DT));
    expect(late.rt.v2!.live.loaded).toEqual([]); // the window closed
  });
});
