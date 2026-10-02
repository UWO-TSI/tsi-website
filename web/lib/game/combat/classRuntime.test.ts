import { describe, expect, it } from "vitest";
import { DEMO_KIT } from "@/lib/combat/demoKit";
import type { ClassKit } from "@/lib/combat/classes";
import { ULT } from "@/lib/combat/ult";
import { resolveCast, strike } from "./abilities";
import { hurtPlayer } from "./actions";
import { classKey, classMove, equipClassKit, inCombat, pressUlt, stepClass, ULT_BEATS } from "./classRuntime";
import { ENEMIES } from "./data";
import { stepCombat } from "./encounter";
import { createRuntime, energyMax } from "./runtime";
import { spawnEnemy, type Enemy } from "./sim";

const ME = { x: 0, z: 0 };
const never = () => 0.99; // no crits, no rolls
function setup(kit: ClassKit = DEMO_KIT, mastery = 1) {
  const rt = createRuntime(), p = rt.player;
  p.safe = false; p.weapon = "staff-oak"; p.level = 10; p.energy = 100;
  equipClassKit(rt, kit, mastery);
  p.energy = energyMax(rt); p.hp = p.maxHp;
  const foe: Enemy = { ...spawnEnemy("foe", ENEMIES["stone-golem"], 0, 4), state: "chase" };
  rt.enemies.push(foe);
  p.aim = { x: 0, z: 4 };
  return { rt, p, foe };
}
/** A frame: the class layer, then the encounter tick (real = dt here). */
function frame(rt: ReturnType<typeof createRuntime>, dt = 1 / 30) {
  stepClass(rt, ME, dt, dt, never);
  stepCombat(rt, ME, dt, () => true, never);
}
const tap = (rt: ReturnType<typeof createRuntime>, slot: number) => { classKey(rt, slot, true); classKey(rt, slot, false); };

describe("classes v2 runtime: the kit at its mastery, the gate, the inputs", () => {
  it("equips the kit at its mastery: key 5 locked at 1, the stat direction raises the pool at 20", () => {
    const { rt } = setup();
    expect(rt.v2!.keys.map(a => a?.key ?? null)).toEqual(["demo.bolt", "demo.guard", "demo.slam", "demo.familiar", null]);
    expect(energyMax(rt)).toBe(100);
    expect(rt.kit).toBeNull();
    const at20 = setup(DEMO_KIT, 20).rt;
    expect(energyMax(at20)).toBe(160);
    expect(at20.v2!.keys[4]?.key).toBe("demo.sigil");
  });
  it("keys need the signature weapon in hand", () => {
    const { rt, p } = setup();
    p.weapon = "sword-driftwood";
    classKey(rt, 2, true); frame(rt);
    expect(rt.v2!.holding[2]).toBeNull();
    expect(rt.floaters.some(f => f.text === "Hold your staff")).toBe(true);
  });
  it("a combo key waits 0.4 s for its partner, then fires alone; a double tap is the combo", () => {
    const { rt, p } = setup();
    tap(rt, 0);
    frame(rt);
    expect(p.energy).toBe(100); // waiting for a partner
    for (let i = 0; i < 14; i++) frame(rt);
    expect(p.energy).toBe(88); // alone: Arc Bolt
    expect(rt.v2!.cd["demo.bolt"]).toBeGreaterThan(0);
    for (let i = 0; i < 60; i++) frame(rt);
    p.energy = 100;
    tap(rt, 0); frame(rt); tap(rt, 0); frame(rt);
    expect(p.energy).toBe(70); // Surge Nova, not two bolts
    expect(p.kick).toMatchObject({ speed: 4, up: 0.6 });
  });
  it("a hold wards while held; the release ends its buffs and starts the cooldown", () => {
    const { rt } = setup();
    classKey(rt, 1, true); frame(rt);
    expect(rt.buffs.filter(b => b.source === "demo.guard").length).toBe(2);
    expect(rt.v2!.cd["demo.guard"] ?? 0).toBe(0);
    for (let i = 0; i < 10; i++) frame(rt);
    classKey(rt, 1, false); frame(rt);
    expect(rt.buffs.some(b => b.source === "demo.guard")).toBe(false);
    expect(rt.v2!.cd["demo.guard"]).toBeGreaterThan(2.9);
  });
  it("a charge fires on the release, harder the longer it was held", () => {
    const damage = (frames: number) => {
      const { rt, foe } = setup();
      classKey(rt, 2, true);
      for (let i = 0; i < frames; i++) frame(rt);
      classKey(rt, 2, false); frame(rt);
      return foe.type.hp - foe.hp;
    };
    expect(damage(2)).toBeGreaterThan(0);
    expect(damage(40)).toBeGreaterThan(damage(2) * 2);
  });
  it("a toggle calls on the press and sends away on the next", () => {
    const { rt } = setup();
    tap(rt, 3); frame(rt);
    expect(rt.units.filter(u => u.source === "demo.familiar").length).toBe(1);
    expect(rt.v2!.toggled[3]).toBe(true);
    for (let i = 0; i < 70; i++) frame(rt); // past its cooldown: the second press still only dismisses
    tap(rt, 3); frame(rt);
    expect(rt.units.some(u => u.source === "demo.familiar")).toBe(false);
    expect(rt.v2!.toggled[3]).toBe(false);
  });
  it("a drawn shape opens the overlay without rooting, and a clean one heals at 1.5×", () => {
    const { rt, p } = setup(DEMO_KIT, 3);
    p.hp = p.maxHp / 2;
    tap(rt, 4); frame(rt);
    expect(rt.casting).toMatchObject({ rune: "circle", free: true });
    resolveCast(rt, ME, { accuracy: 96, coverage: 1, deviation: 0, order: 1, scribble: false, outcome: "enhanced", power: 1.5 }, never);
    expect(p.hp).toBeCloseTo(p.maxHp / 2 + p.maxHp * 0.2 * 1.2, 0); // support effects cap at 1.2
    expect(rt.v2!.cd["demo.sigil"]).toBe(8);
  });
  it("movement riders: a speed-scaled key hits harder fast; the movement passive needs energy", () => {
    const hit = (speed: number) => { const { rt, p, foe } = setup(); p.move.speed = speed; tap(rt, 0); for (let i = 0; i < 40; i++) frame(rt); return foe.type.hp - foe.hp; };
    expect(hit(16)).toBeGreaterThan(hit(7.4));
    const { rt, p } = setup();
    p.move = { mode: "air", speed: 8, sinceDash: 9, vx: 0, vz: 8 };
    expect(classMove(rt, ME, "airJump")).toBe(true);
    expect(p.kick).toMatchObject({ up: 0.8, speed: 2 });
    expect(classMove(rt, ME, "airJump")).toBe(false); // its 0.4 s cooldown
    p.energy = 5; rt.v2!.moveCd = 0;
    expect(classMove(rt, ME, "airJump")).toBe(false);
    expect(classMove(rt, ME, "slide")).toBe(false); // not this kit's trigger
  });
  it("a `when` rider refuses the cast outside its movement state", () => {
    const kit: ClassKit = { ...DEMO_KIT, keys: [{ ...DEMO_KIT.keys[0], key: "demo.slide-bolt", when: "sliding" }], combos: [] };
    const { rt, p } = setup(kit);
    tap(rt, 0); frame(rt);
    expect(rt.projectiles.length).toBe(0);
    expect(rt.floaters.some(f => f.text === "Slide first")).toBe(true);
    p.move.mode = "slide";
    tap(rt, 0); frame(rt);
    expect(rt.projectiles.length).toBe(1);
  });
});

describe("classes v2 runtime: the ult meter and the ult", () => {
  it("fills from your hits and hits aimed at you; defeat empties it", () => {
    const { rt, p, foe } = setup();
    strike(rt, foe, { power: 1, from: ME }, never);
    expect(rt.v2!.meter).toBeCloseTo(0.7, 1);
    hurtPlayer(rt, p.maxHp / 2, foe, ME, 0, never);
    expect(rt.v2!.meter).toBeCloseTo(0.7 + 20, 0);
    hurtPlayer(rt, p.maxHp * 2, foe, ME, 0, never);
    expect(p.alive).toBe(false);
    expect(rt.v2!.meter).toBe(0);
  });
  it("F waits for a full meter; the press empties it, guards the caster through the freeze, and lands at the anticipation's end", () => {
    const { rt, p, foe } = setup();
    pressUlt(rt); frame(rt);
    for (let i = 0; i < 6; i++) frame(rt);
    expect(rt.v2!.cast).toBeNull(); // not charged
    expect(rt.denied.ult).toBe(1);
    rt.v2!.meter = ULT.max;
    pressUlt(rt); frame(rt);
    expect(rt.v2!.cast).not.toBeNull();
    expect(rt.v2!.meter).toBe(0);
    expect(hurtPlayer(rt, 50, foe, ME, 0, never)).toBe(0); // untouchable in the wind-up
    const hp = foe.hp;
    for (let i = 0; i < 12; i++) frame(rt); // 13 frames since the press: 433 ms
    expect(foe.hp).toBe(hp); // 450 ms anticipation
    for (let i = 0; i < 2; i++) frame(rt);
    expect(foe.hp).toBeLessThan(hp);
    expect(rt.v2!.meter).toBe(0); // its own hits charge nothing
    expect(p.ultIframes).toBeGreaterThan(0);
    for (let t = 0; t < ULT_BEATS.freeze + ULT_BEATS.iframesAfter + 0.05; t += 1 / 30) frame(rt);
    expect(p.ultIframes).toBe(0);
  });
  it("knows when you're in combat: a threat near, and 5 s after", () => {
    const { rt, foe } = setup();
    frame(rt);
    expect(inCombat(rt)).toBe(true);
    foe.state = "dead";
    for (let t = 0; t < 4.9; t += 0.1) stepClass(rt, ME, 0.1, 0.1, never);
    expect(inCombat(rt)).toBe(true);
    stepClass(rt, ME, 0.2, 0.2, never);
    expect(inCombat(rt)).toBe(false);
  });
});
