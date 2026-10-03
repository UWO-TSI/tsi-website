import { describe, expect, it } from "vitest";
import { DT, ME, never, dummy, setup, frame, holdFire, tap, dealt } from "./rig";
import { MARKSMAN } from "@/lib/combat/rangerKits";
import { ULT } from "@/lib/combat/ult";
import { attack, hurtPlayer } from "../actions";
import { fireRate } from "../classFire";
import { classKey, pressUlt, stepClass } from "../classRuntime";
import { stepCombat } from "../encounter";

describe("Marksman: Focus, arrow drop, the three arrows, Back Hop, Thousand Arrows", () => {
  it("Focus: holding fire ramps 1.5 shots a second to 8 over about 4 s", () => {
    const { rt } = setup(MARKSMAN);
    dummy(rt, 0, 6);
    expect(fireRate(rt)).toBeCloseTo(1.5);
    const first = holdFire(rt, 1);
    holdFire(rt, 3.2);
    const last = holdFire(rt, 1);
    expect(first).toBeLessThanOrEqual(3);
    expect(last).toBeGreaterThanOrEqual(7);
    expect(fireRate(rt)).toBeCloseTo(8, 0);
  });
  it("Focus halves after a 0.5 s pause, and when you're hit", () => {
    const { rt } = setup(MARKSMAN);
    dummy(rt, 0, 6);
    holdFire(rt, 5);
    const full = rt.v2!.live.focus;
    frame(rt, 20); // past 0.5 s ready and not firing
    expect(rt.v2!.live.focus).toBeCloseTo(full / 2);
    hurtPlayer(rt, 5, { x: 0, z: 3 }, ME);
    expect(rt.v2!.live.focus).toBeCloseTo(full / 4);
  });
  it("arrows drop with distance: spent short of a far target; Swift Arrows fly flat, and pierce one", () => {
    const { rt } = setup(MARKSMAN);
    const far = dummy(rt, 0, 13);
    rt.player.aim = { x: 0, z: 13 };
    holdFire(rt, 1.5);
    expect(dealt(far)).toBe(0);
    let reach = 0;
    attack(rt, ME, never);
    const arrow = rt.projectiles.at(-1)!;
    while (rt.projectiles.includes(arrow)) { reach = arrow.z; frame(rt); }
    expect(reach).toBeGreaterThan(10); expect(reach).toBeLessThan(12.5); // spent where it met the ground
    const near = dummy(rt, 0, 9);
    tap(rt, 2); // Swift
    holdFire(rt, 1.5);
    expect(dealt(near)).toBeGreaterThan(0);
    expect(dealt(far)).toBeGreaterThan(0); // through the first, into the second
  });
  it("Homing Arrows curve onto an enemy off the line", () => {
    const hits = (homing: boolean) => {
      const { rt } = setup(MARKSMAN);
      const e = dummy(rt, 1.6, 7);
      rt.player.aim = { x: 0, z: 7 };
      if (homing) tap(rt, 0);
      holdFire(rt, 1.2);
      return dealt(e);
    };
    expect(hits(false)).toBe(0);
    expect(hits(true)).toBeGreaterThan(0);
  });
  it("Flame Arrows burn what they hit and leave burning ground that keeps hurting", () => {
    const { rt } = setup(MARKSMAN);
    const e = dummy(rt, 0, 5);
    tap(rt, 1);
    holdFire(rt, 0.4);
    expect(rt.v2!.live.dots.length).toBe(1);
    expect(rt.v2!.live.zones.length).toBeGreaterThan(0);
    const after = dealt(e);
    frame(rt, 30); // a second without shooting: the burn and the ground keep going
    expect(dealt(e)).toBeGreaterThan(after);
  });
  it("Back Hop (mastery 3) hops you back without breaking Focus", () => {
    const { rt, p } = setup(MARKSMAN, 3);
    dummy(rt, 0, 6);
    holdFire(rt, 3);
    const focus = rt.v2!.live.focus;
    classKey(rt, 3, true); classKey(rt, 3, false); stepClass(rt, ME, DT, DT, never);
    expect(p.kick).toMatchObject({ dz: -1, speed: 4, up: 0.7 });
    expect(rt.v2!.live.focus).toBeCloseTo(focus, 1);
  });
  it("Thousand Arrows: all three arrows and 20 shots a second on their own for 6 s, then the falling volley", () => {
    const { rt } = setup(MARKSMAN);
    const e = dummy(rt, 0, 6);
    rt.v2!.meter = ULT.max;
    pressUlt(rt);
    const seen = new Set<number>();
    for (let t = 0; t < 7; t += DT) { stepClass(rt, ME, DT, DT, never); for (const s of rt.projectiles) seen.add(s.id); stepCombat(rt, ME, DT, () => true, never); }
    const shots = seen.size;
    expect(shots).toBeGreaterThan(100);
    expect(rt.tally.ult).toBeGreaterThan(0);
    expect(rt.v2!.cast?.last).toBe(true); // the finisher landed
    expect(dealt(e)).toBeGreaterThan(0);
  });
  it("mastery raises attack speed (its stat direction): ×1.15 at 20, it fires that much faster", () => {
    const a = setup(MARKSMAN, 1), b = setup(MARKSMAN, 20);
    expect([a.rt.v2!.mods.attackSpeed, b.rt.v2!.mods.attackSpeed]).toEqual([1, 1.15]);
    expect(fireRate(b.rt) / fireRate(a.rt)).toBeCloseTo(1.15);
  });
});
