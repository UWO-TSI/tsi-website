import { describe, expect, it } from "vitest";
import { DT, ME, never, dummy, setup, frame, holdFire, tap, dealt } from "./rig";
import { SNIPER } from "@/lib/combat/rangerKits";
import { ULT } from "@/lib/combat/ult";
import { strike } from "../abilities";
import { hurtPlayer } from "../actions";
import { FIRE } from "../classFire";
import { classKey, pressUlt } from "../classRuntime";

describe("Sniper: weak points, Killstreak, Scope, the rounds, Smoke Roll, Tripwire, Final Shot", () => {
  it("mastery raises crit damage (its stat direction): ×1.75 to ×2.3", () => {
    expect([setup(SNIPER, 1).rt.v2!.mods.critMult, setup(SNIPER, 20).rt.v2!.mods.critMult]).toEqual([1.75, 2.3]);
  });
  it("a slow heavy shot, once a second; through the core it always crits, at the edge it doesn't", () => {
    const shotAt = (x: number) => {
      const { rt } = setup(SNIPER);
      const e = dummy(rt, x, 8);
      rt.player.aim = { x: 0, z: 8 };
      const shots = holdFire(rt, 1.1);
      return { shots, crit: rt.floaters.some(f => f.kind === "crit"), hit: dealt(e) };
    };
    expect(shotAt(0).shots).toBe(2); // at t = 0 and t = 1
    expect(shotAt(0).crit).toBe(true);
    const edge = shotAt(0.45);
    expect(edge.hit).toBeGreaterThan(0);
    expect(edge.crit).toBe(false);
  });
  it("Killstreak: +15% a kill up to five; lost on a hit or after 8 s without a kill", () => {
    const { rt } = setup(SNIPER);
    const target = dummy(rt, 0, 30, "t");
    const one = () => strike(rt, target, { power: 1, from: ME }, never);
    const base = one();
    for (let i = 0; i < 7; i++) { const f = dummy(rt, 0, 40 + i, `k${i}`, 1); strike(rt, f, { power: 1, from: ME }, never); }
    expect(rt.v2!.live.streak).toBe(5);
    expect(one() / base).toBeCloseTo(1.75, 1);
    hurtPlayer(rt, 1, { x: 0, z: 1 }, ME);
    expect(rt.v2!.live.streak).toBe(0);
    strike(rt, dummy(rt, 0, 50, "k9", 1), { power: 1, from: ME }, never);
    frame(rt, Math.ceil(FIRE.streakWindow / DT) + 2);
    expect(rt.v2!.live.streak).toBe(0);
  });
  it("Scope, held: +40% crit chance and a wider weak point while held; gone on release", () => {
    const { rt } = setup(SNIPER);
    classKey(rt, 0, true); frame(rt, 3);
    expect(rt.buffs.filter(b => b.source === "sniper.scope").map(b => b.stat).sort()).toEqual(["crit", "scope"]);
    const e = dummy(rt, 0.24, 8);
    rt.player.aim = { x: 0, z: 8 };
    holdFire(rt, 0.3);
    expect(rt.floaters.some(f => f.kind === "crit")).toBe(true); // 0.24 is outside the plain core (0.2) but inside the scoped one (0.3)
    expect(dealt(e)).toBeGreaterThan(0);
    classKey(rt, 0, false); frame(rt);
    expect(rt.buffs.some(b => b.source === "sniper.scope")).toBe(false);
  });
  it("Piercing Round goes through the whole line; Cluster Round splashes and throws four bomblets", () => {
    const { rt } = setup(SNIPER);
    const line = [dummy(rt, 0, 4), dummy(rt, 0, 8), dummy(rt, 0, 12)];
    rt.player.aim = { x: 0, z: 8 };
    tap(rt, 1); frame(rt, 15);
    expect(line.every(e => dealt(e) > 0)).toBe(true);
    const b = setup(SNIPER);
    const centre = dummy(b.rt, 0, 8), ring = [dummy(b.rt, 2.2, 8), dummy(b.rt, -2.2, 8), dummy(b.rt, 0, 10.2)];
    b.rt.player.aim = { x: 0, z: 8 };
    tap(b.rt, 2); frame(b.rt, 30);
    expect(dealt(centre)).toBeGreaterThan(0);
    expect(ring.filter(e => dealt(e) > 0).length).toBeGreaterThanOrEqual(2); // the bomblets land round it
  });
  it("Smoke Roll (mastery 3): an untouchable roll back, smoke that makes what's near lose you", () => {
    const { rt, p } = setup(SNIPER, 3);
    const e = dummy(rt, 0, 2);
    tap(rt, 3);
    expect(p.dash).toMatchObject({ iframes: true, z: -1 });
    expect(e.status.distract).toBeGreaterThan(0);
    expect(rt.v2!.live.zones.length).toBe(1);
  });
  it("Tripwire: a mine that blasts everything near when one comes close", () => {
    const { rt } = setup(SNIPER);
    rt.player.aim = { x: 0, z: 6 };
    tap(rt, 4);
    expect(rt.units.map(u => u.def.key)).toEqual(["sniper-mine"]);
    const a = dummy(rt, 0, 6.8), b = dummy(rt, 1.6, 6.8);
    frame(rt);
    expect(dealt(a)).toBeGreaterThan(0);
    expect(dealt(b)).toBeGreaterThan(0);
    expect(rt.units.length).toBe(0);
  });
  it("Final Shot: one rail round through the whole field, every hit a crit", () => {
    const { rt } = setup(SNIPER);
    const line = [dummy(rt, 0, 5), dummy(rt, 0.3, 14), dummy(rt, -0.3, 24)];
    rt.player.aim = { x: 0, z: 10 };
    rt.v2!.meter = ULT.max; pressUlt(rt);
    frame(rt, 40);
    expect(line.every(e => dealt(e) > 0)).toBe(true);
    expect(rt.floaters.filter(f => f.kind === "ult").length).toBe(3);
    expect(rt.tally.ult).toBe(rt.tally.dealt);
  });
});
