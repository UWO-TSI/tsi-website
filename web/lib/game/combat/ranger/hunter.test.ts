import { describe, expect, it } from "vitest";
import { dummy, setup, frame, holdFire, tap, dealt } from "./rig";
import { HUNTER } from "@/lib/combat/rangerKits";
import { ULT } from "@/lib/combat/ult";
import { enemyTarget } from "../abilities";
import { classKey, pressUlt } from "../classRuntime";
import { UNITS } from "@/lib/combat/kits";

describe("Hunter: traps (cap, duration, lunge, Prey), Camouflage, Harpoon, the Great Hunt", () => {
  it("mastery raises duration (its stat direction): ×1 to ×1.7", () => {
    expect([setup(HUNTER, 1).rt.v2!.mods.duration, setup(HUNTER, 20).rt.v2!.mods.duration]).toEqual([1, 1.7]);
  });
  it("three traps at mastery 1, more and longer-lived as duration grows", () => {
    const place = (m: number) => {
      const { rt } = setup(HUNTER, m);
      for (let i = 0; i < 6; i++) { rt.player.aim = { x: i * 2 - 5, z: 6 }; rt.v2!.cd = {}; rt.player.energy = 100; tap(rt, 1); }
      return { n: rt.units.length, life: rt.units[0].life! };
    };
    const one = place(1), top = place(20);
    expect(one.n).toBe(3);
    expect(top.n).toBe(5);
    expect(top.life / one.life).toBeCloseTo(1.7, 1);
  });
  it("Snare roots for 2 s; Spike bursts round it and leaves a bleed", () => {
    const { rt } = setup(HUNTER);
    rt.player.aim = { x: -3, z: 6 }; tap(rt, 1);
    rt.player.aim = { x: 3, z: 6 }; tap(rt, 2);
    const snared = dummy(rt, -3, 6.5), a = dummy(rt, 3, 6.6), b = dummy(rt, 4.2, 6.6);
    frame(rt);
    expect(snared.status.hold).toBeCloseTo(2, 1);
    const burst = dealt(a);
    expect(burst).toBeGreaterThan(0); expect(dealt(b)).toBeGreaterThan(0);
    frame(rt, 60);
    expect(dealt(a)).toBeGreaterThan(burst); // the bleed
  });
  it("Mark Prey: a trap lunges 3 u further for a marked enemy, and Prey adds 30% to it", () => {
    const spring = (marked: boolean) => {
      const { rt } = setup(HUNTER);
      rt.player.aim = { x: 0, z: 6 }; tap(rt, 2);
      const e = dummy(rt, 0, 9);
      if (marked) { e.status.mark = 0.2; e.status.markFor = 8; }
      frame(rt);
      return { sprung: rt.units.length === 0, hit: dealt(e) };
    };
    expect(spring(false).sprung).toBe(false);
    const m = spring(true);
    expect(m.sprung).toBe(true);
    const { rt } = setup(HUNTER);
    rt.player.aim = { x: 0, z: 6 }; tap(rt, 2);
    const plain = dummy(rt, 0, 6.5);
    frame(rt);
    expect(m.hit / dealt(plain)).toBeCloseTo((1 + 0.2 + 0.3) / 1, 1); // mark +20% and Prey +30%, the same burst
  });
  it("Camouflage: enemies lose you beyond 1.5 u; a quick step breaks it; the first shot out deals +60%", () => {
    const { rt, p } = setup(HUNTER);
    const e = dummy(rt, 0, 6), near = dummy(rt, 1.2, 0);
    tap(rt, 0);
    const you = { x: 0, z: 0, safe: false, alive: true };
    expect(enemyTarget(rt, e, you)).not.toBe(you);
    expect(enemyTarget(rt, near, you)).toBe(you);
    const plain = setup(HUNTER), pe = dummy(plain.rt, 0, 6);
    holdFire(plain.rt, 0.5); holdFire(rt, 0.5);
    expect(dealt(e) / dealt(pe)).toBeGreaterThan(1.5); expect(dealt(e) / dealt(pe)).toBeLessThan(1.75); // +60%, whole numbers
    expect(rt.buffs.some(b => b.stat === "stealth")).toBe(false);
    tap(rt, 0); rt.v2!.cd = {}; p.energy = 100; tap(rt, 0);
    p.move.speed = 7.4; frame(rt);
    expect(rt.buffs.some(b => b.stat === "stealth")).toBe(false);
  });
  it("Harpoon (mastery 3): drags an enemy toward you; into terrain it zips you there", () => {
    const { rt } = setup(HUNTER, 3);
    const e = dummy(rt, 0, 8);
    rt.player.aim = { x: 0, z: 8 };
    tap(rt, 4); frame(rt, 30);
    expect(e.z).toBeLessThan(6);
    const b = setup(HUNTER, 3);
    b.rt.player.aim = { x: 6, z: 0 };
    classKey(b.rt, 4, true); classKey(b.rt, 4, false);
    for (let i = 0; i < 20 && !b.p.dash; i++) frame(b.rt, 1, (x) => x < 6); // a wall at x = 6
    expect(b.p.dash).toMatchObject({ x: 1 });
  });
  it("The Great Hunt: every trap springs at once and the chains between them cut; a hound for each mark", () => {
    const { rt } = setup(HUNTER);
    for (const x of [-4, 0, 4]) { rt.player.aim = { x, z: 8 }; rt.v2!.cd = {}; tap(rt, x === 0 ? 2 : 1); }
    const onChain = dummy(rt, -2, 8.1), marked = dummy(rt, 0, 14);
    marked.status.mark = 0.2; marked.status.markFor = 8;
    rt.v2!.meter = ULT.max; pressUlt(rt); frame(rt, 20);
    expect(rt.units.filter(u => u.def.kind === "trap").length).toBe(0);
    expect(dealt(onChain)).toBeGreaterThan(0);
    expect(rt.units.filter(u => u.def.key === "spectral-hound").length).toBe(2); // one mark: still two
    expect(UNITS["spectral-hound"].prey).toBe(true);
  });
});
