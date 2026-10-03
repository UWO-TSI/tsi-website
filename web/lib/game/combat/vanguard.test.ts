import { describe, expect, it } from "vitest";
import { GUARDIAN, JUGGERNAUT, MARTIAL_ARTIST } from "@/lib/combat/vanguardKits";
import { CHAIN_WINDOW, type ClassKit } from "@/lib/combat/classes";
import { signatureGrant } from "@/lib/combat/weapons";
import { enemyTarget } from "./abilities";
import { attack, attackSpeed, hurtPlayer } from "./actions";
import { classKey, equipClassKit, pressUlt, stepClass } from "./classRuntime";
import { ENEMIES } from "./data";
import { stepCombat } from "./encounter";
import { createRuntime, energyMax, type CombatRuntime } from "./runtime";
import { spawnEnemy, type Enemy, type Vec } from "./sim";

const ME: Vec = { x: 0, z: 0 };
const never = () => 0.99; // no crits, no rolls
const DT = 1 / 60;

/** A level-10 Vanguard on a kit, its tier-1 signature weapon in hand, facing +z at a foe 1.2 u away (a golem: no flinch to speak of). */
function setup(kit: ClassKit, mastery = 1, type = "stone-golem", at: Vec = { x: 0, z: 1.2 }) {
  const rt = createRuntime(), p = rt.player;
  p.safe = false; p.level = 10; p.weapon = signatureGrant(kit.key, 1)!.key; p.stats = { might: 14, finesse: 5, arcana: 0, spirit: 0, vitality: 8 };
  equipClassKit(rt, kit, mastery);
  p.energy = energyMax(rt); p.hp = p.maxHp; p.facing = 0; p.aim = { ...at }; p.last = { ...ME };
  const foe = add(rt, type, at.x, at.z);
  return { rt, p, foe };
}
function add(rt: CombatRuntime, type: string, x: number, z: number): Enemy {
  const e: Enemy = { ...spawnEnemy(`${type}-${rt.seq++}`, ENEMIES[type], x, z), state: "chase" };
  e.hp = 99999; e.facing = Math.atan2(-x, -z); // facing you
  rt.enemies.push(e);
  return e;
}
/** The class layer then the encounter tick, holding you still (the foes keep their facing: no AI step for them). */
function frame(rt: CombatRuntime, dt = DT, ai = false) {
  stepClass(rt, ME, dt, dt, never);
  if (ai) stepCombat(rt, ME, dt, () => true, never);
  else { rt.player.attackCd = Math.max(0, rt.player.attackCd - dt); for (const b of rt.buffs) b.t -= dt; rt.buffs = rt.buffs.filter(b => b.t > 0); }
}
const tap = (rt: CombatRuntime, slot: number) => { classKey(rt, slot, true); classKey(rt, slot, false); frame(rt); };
const lost = (e: Enemy) => 99999 - e.hp;

describe("Guardian: the 0.25 s parry window, the block, Bulwark, the dome, the bouncing shield, Unbreakable", () => {
  it("a tap parries a frontal hit inside 0.25 s: negated, answered with a counter-slash that staggers, energy and armour back", () => {
    const { rt, p, foe } = setup(GUARDIAN);
    p.energy = 50;
    tap(rt, 0); // pressed and released at once: the window outlives the release
    for (let t = 0; t < 0.15; t += DT) frame(rt);
    expect(hurtPlayer(rt, 40, foe, ME, 3, never)).toBe(0);
    expect(p.hp).toBe(p.maxHp);
    expect(p.hurt).toBe(0); // no flinch, no push
    expect(lost(foe)).toBeGreaterThan(0); // the counter-slash
    expect(foe.status.hold).toBeGreaterThan(0); // staggered
    expect(p.energy).toBe(50 - 8 + 20); // Bulwark: 20 energy back
    expect(rt.buffs.some(b => b.stat === "guard" && b.value === 0.3 && b.source === "parry")).toBe(true);
  });
  it("past the window a held block takes 70% off a frontal hit; a hit from behind isn't blocked", () => {
    const { rt, p, foe } = setup(GUARDIAN);
    classKey(rt, 0, true);
    for (let t = 0; t < 0.3; t += DT) frame(rt);
    const guard = 1 - 0.1; // the armour stat direction at mastery 1
    expect(hurtPlayer(rt, 100, foe, ME, 3, never)).toBe(Math.round(100 * guard * 0.3));
    expect(lost(foe)).toBe(0); // no counter outside the window
    p.hp = p.maxHp;
    expect(hurtPlayer(rt, 100, { x: 0, z: -2 }, ME, 3, never)).toBe(Math.round(100 * guard));
  });
  it("a parry pressed too early wastes it: the window is 0.25 s and the cooldown runs", () => {
    const { rt, foe } = setup(GUARDIAN);
    tap(rt, 0);
    for (let t = 0; t < 0.3; t += DT) frame(rt);
    expect(hurtPlayer(rt, 40, foe, ME, 3, never)).toBeGreaterThan(0);
    expect(rt.v2!.cd["guardian.block"]).toBeGreaterThan(0.5);
  });
  it("Aegis Dome stops an enemy shot at its edge", () => {
    const { rt, p } = setup(GUARDIAN);
    tap(rt, 3);
    expect(rt.units.some(u => u.def.kind === "dome")).toBe(true);
    rt.projectiles.push({ id: 1, x: 0, z: 6, vx: 0, vz: -12, life: 2, from: "enemy", damage: 20, kind: "rune", radius: 0.3 });
    for (let i = 0; i < 60; i++) stepCombat(rt, ME, DT, () => true, never);
    expect(rt.projectiles.length).toBe(0);
    expect(p.hp).toBe(p.maxHp);
  });
  it("Shield Throw (mastery 3) bounces between three enemies", () => {
    const { rt, foe } = setup(GUARDIAN, 3, "stone-golem", { x: 0, z: 3 });
    const b = add(rt, "stone-golem", 2.5, 4.5), c = add(rt, "stone-golem", -2.5, 5);
    rt.player.aim = { x: 0, z: 3 };
    tap(rt, 4);
    for (let i = 0; i < 120; i++) stepCombat(rt, ME, DT, () => true, never);
    expect([foe, b, c].every(e => lost(e) > 0)).toBe(true);
  });
  it("Challenge: enemies within 7 u come for you over a decoy", () => {
    const { rt, foe } = setup(GUARDIAN);
    rt.units.push({ id: 9, def: { key: "decoy", name: "P", kind: "decoy", hp: 50, taunt: true }, source: "x", x: 0, z: 1.5, hp: 50, maxHp: 50, life: 3, cd: 0, power: 0, stat: "might", body: null });
    expect(enemyTarget(rt, foe, { ...ME, safe: false, alive: true })).toMatchObject({ x: 0, z: 1.5 });
    tap(rt, 1);
    expect(enemyTarget(rt, foe, { ...ME, safe: false, alive: true })).toMatchObject({ x: 0, z: 0 });
    for (let t = 0; t < 4.1; t += DT) frame(rt);
    expect(rt.player.taunt).toBeNull();
  });
  it("Unbreakable stores every hit for 6 s, then releases it twice over in the shockwave", () => {
    const { rt, p, foe } = setup(GUARDIAN);
    rt.v2!.meter = 100;
    pressUlt(rt);
    for (let t = 0; t < 0.8; t += DT) frame(rt); // past the anticipation and the freeze's i-frames
    const plant = lost(foe);
    expect(plant).toBeGreaterThan(0);
    expect(hurtPlayer(rt, 30, foe, ME, 3, never)).toBe(0);
    expect(hurtPlayer(rt, 45, foe, ME, 3, never)).toBe(0);
    expect(p.hp).toBe(p.maxHp);
    expect(p.absorbed).toBe(75);
    const quiet = setup(GUARDIAN); // the same release with nothing stored
    quiet.rt.v2!.meter = 100; pressUlt(quiet.rt);
    for (let t = 0; t < 6.6; t += DT) { frame(rt); frame(quiet.rt); }
    expect(p.absorbed).toBe(0);
    const released = lost(foe) - plant, without = lost(quiet.foe) - plant;
    expect(released - without).toBeGreaterThan(75 * 2 * 0.9 * (1 - foe.type.defense) - 10);
  });
});

describe("Juggernaut: the hammer hits harder with max HP, Unstoppable, Seismic Drop, Titan", () => {
  it("each hammer hit adds 2% of max HP as damage", () => {
    const a = setup(JUGGERNAUT), b = setup(JUGGERNAUT);
    b.p.maxHp *= 2;
    attack(a.rt, ME, never); attack(b.rt, ME, never);
    const extra = lost(b.foe) - lost(a.foe);
    expect(extra).toBeGreaterThan(0);
    expect(extra).toBeCloseTo(0.02 * a.p.maxHp * (1 - a.foe.type.defense), -1);
  });
  it("Unstoppable: no knockback while attacking, the usual push otherwise", () => {
    const { rt, p, foe } = setup(JUGGERNAUT);
    attack(rt, ME, never);
    hurtPlayer(rt, 10, foe, ME, 5, never);
    expect(p.knock).toBe(0);
    p.attackCd = 0; p.swing = 0;
    hurtPlayer(rt, 10, foe, ME, 5, never);
    expect(p.knock).toBe(5);
  });
  it("Seismic Drop needs the air, slams you down and hits harder from higher", () => {
    const hit = (height: number) => {
      const { rt, p, foe } = setup(JUGGERNAUT, 3);
      p.move = { mode: "air", speed: 0, sinceDash: 9, vx: 0, vz: 0, height };
      tap(rt, 3);
      expect(p.kick?.down).toBe(true);
      for (let t = 0; t < 0.2; t += DT) frame(rt);
      return lost(foe);
    };
    const low = hit(0.2), high = hit(3);
    expect(high / low).toBeGreaterThan(2);
    const ground = setup(JUGGERNAUT, 3);
    tap(ground.rt, 3);
    expect(ground.rt.floaters.some(f => f.text === "Jump first")).toBe(true);
  });
  it("Titan: 2.5× for 10 s, the reach grows and every swing throws a shockwave", () => {
    const { rt, p } = setup(JUGGERNAUT);
    const far = add(rt, "stone-golem", 0, 3.4); // out of a normal swing's 2.2 u, inside Titan's
    attack(rt, ME, never);
    expect(lost(far)).toBe(0);
    rt.v2!.meter = 100; pressUlt(rt);
    for (let t = 0; t < 0.7; t += DT) frame(rt);
    expect(1 + rt.buffs.filter(b => b.stat === "size").reduce((n, b) => n + b.value, 0)).toBe(2.5);
    const before = lost(far);
    p.attackCd = 0; attack(rt, ME, never);
    expect(lost(far)).toBeGreaterThan(before);
  });
});

describe("Martial Artist: the chain, techniques woven in, Rhythm, the clinch", () => {
  it("the basic chain loops jab, cross, hook, body kick, each its own clip", () => {
    const { rt, p } = setup(MARTIAL_ARTIST);
    const clips: string[] = [];
    for (let i = 0; i < 5; i++) { p.attackCd = 0; attack(rt, ME, never); clips.push(p.clip!.verb); frame(rt, 0.2); }
    expect(clips).toEqual(["Unique_Jab", "Unique_Cross", "Unique_Hook", "Unique_BodyKick", "Unique_Jab"]);
  });
  it("a technique right after a chain hit slots in, 40% stronger than as an opener; after the window it's an opener", () => {
    const teep = (afterHit: number | null) => {
      const { rt, p, foe } = setup(MARTIAL_ARTIST, 1, "shadow-fox"); // no armour: damage scales cleanly
      if (afterHit !== null) { attack(rt, ME, never); frame(rt, afterHit); }
      const before = lost(foe);
      p.attackCd = 0;
      tap(rt, 0);
      return { dealt: lost(foe) - before, i: rt.v2!.chain.i };
    };
    const opener = teep(null), woven = teep(0.4), late = teep(CHAIN_WINDOW + 0.1);
    expect(woven.dealt / opener.dealt).toBeCloseTo(1.4, 1);
    expect(late.dealt).toBe(opener.dealt);
    expect(woven.i).toBe(2); // the chain carries on: the next press is the cross... after the teep, the hook
  });
  it("Rhythm: each chain hit adds 8% attack speed up to +40%, and a 1 s gap resets it", () => {
    const { rt, p } = setup(MARTIAL_ARTIST);
    for (let i = 0; i < 7; i++) { p.attackCd = 0; attack(rt, ME, never); frame(rt, 0.1); }
    expect(attackSpeed(rt)).toBeCloseTo(1.4);
    frame(rt, 1.05);
    expect(attackSpeed(rt)).toBe(1);
    expect(rt.v2!.chain.i).toBe(0);
  });
  it("Clinch Knees holds the target for the whole technique while three knees land", () => {
    const { rt, foe } = setup(MARTIAL_ARTIST, 1, "shadow-fox");
    foe.hp = 99999;
    tap(rt, 2);
    const hits: number[] = [];
    let last = lost(foe);
    for (let t = DT; t < 1.3; t += DT) {
      frame(rt);
      expect(foe.status.hold, `held at ${t.toFixed(2)} s`).toBeGreaterThan(0);
      if (lost(foe) > last) { hits.push(Math.round(t * 10) / 10); last = lost(foe); }
    }
    expect(hits).toEqual([0.3, 0.7, 1.1]);
  });
  it("Flying Knee needs a run, a slide or a dash, and starts a chain", () => {
    const { rt, p } = setup(MARTIAL_ARTIST, 3);
    tap(rt, 4);
    expect(rt.floaters.some(f => f.text === "Run, slide or dash first")).toBe(true);
    p.move = { mode: "ground", speed: 7.4, sinceDash: 9, vx: 0, vz: 7.4 };
    tap(rt, 4);
    expect(p.kick).toMatchObject({ speed: 0, up: 0.5 }); // the hop now; the momentum where the knee lands
    expect(rt.v2!.chain.i).toBe(1);
  });
  it("the Art of Eight Limbs: eight strikes on one locked enemy, heavy impacts between, the last with the full sequence", () => {
    const { rt, foe } = setup(MARTIAL_ARTIST);
    const other = add(rt, "stone-golem", 0.6, 1.6);
    rt.v2!.meter = 100; pressUlt(rt);
    let hits = 0, last = 0;
    for (let t = 0; t < 3.2; t += DT) { frame(rt); if (lost(foe) > last) { hits++; last = lost(foe); } }
    expect(hits).toBe(8);
    expect(lost(other)).toBeGreaterThan(0); // the final roundhouse's shockwave
  });
});
