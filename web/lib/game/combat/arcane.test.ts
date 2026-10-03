import { describe, expect, it } from "vitest";
import { ELEMENTALIST, ILLUSIONIST, NECROMANCER, TRANSMUTER } from "@/lib/combat/arcaneKits";
import { classMods, type ClassKit } from "@/lib/combat/classes";
import { presetAllocation } from "@/lib/combat/progression";
import { UNITS, traitFor } from "@/lib/combat/kits";
import { ULT } from "@/lib/combat/ult";
import { enemyTarget, strike, summon } from "./abilities";
import { attack, hurtPlayer } from "./actions";
import { cdKey, classKey, equipClassKit, mashNotes, mashPotency, pressUlt, stepClass } from "./classRuntime";
import { ENEMIES } from "./data";
import { stepCombat } from "./encounter";
import { HOLD_AFTER, createInputState, press, release, tick } from "./input";
import { corpse, corpseLife, inWall, wallHeight } from "./primitives";
import { gripFor, verbClip, verbInfo, type Verb } from "@/lib/game/character/clips";
import { createRuntime, energyMax, type CombatRuntime } from "./runtime";
import { spawnEnemy, type Enemy } from "./sim";

const ME = { x: 0, z: 0 };
const never = () => 0.99; // no crits, no rolls
const WEAPON: Record<string, string> = { elementalist: "prism-staff-1", illusionist: "trick-deck-1", necromancer: "bone-tome-1", transmuter: "tooth-charm-1" };
const ALL = { "fox-stride": 1, "crab-shell": 1, "wisp-core": 1, "pollen-swarm": 1, "golem-fist": 1 };
function setup(kit: ClassKit, mastery = 1, foes: [number, number][] = [[0, 4]], traits: Record<string, number> = ALL) {
  const rt = createRuntime(), p = rt.player;
  p.safe = false; p.weapon = WEAPON[kit.key]; p.level = 10; p.stats = presetAllocation("Arcane", 10);
  equipClassKit(rt, kit, mastery, undefined, traits);
  p.energy = energyMax(rt); p.hp = p.maxHp;
  foes.forEach(([x, z], i) => rt.enemies.push({ ...spawnEnemy(`foe${i}`, ENEMIES["stone-golem"], x, z), state: "chase" }));
  p.aim = { x: 0, z: 4 };
  return { rt, p, foe: rt.enemies[0] };
}
function frame(rt: CombatRuntime, dt = 1 / 30) { stepClass(rt, ME, dt, dt, never); stepCombat(rt, ME, dt, () => true, never); }
const frames = (rt: CombatRuntime, n: number) => { for (let i = 0; i < n; i++) frame(rt); };
const tap = (rt: CombatRuntime, slot: number) => { classKey(rt, slot, true); classKey(rt, slot, false); };
const hold = (e: Enemy) => { e.status.hold = 99; return e; };
const corpseAt = (rt: CombatRuntime, x: number, z: number, id = `c${x}${z}`) => { const e = spawnEnemy(id, ENEMIES["shadow-fox"], x, z); e.state = "dead"; e.hp = 0; rt.enemies.push(e); return e; };

describe("the Arcane kits as locked (design sheet)", () => {
  it("Elementalist: four elements on 1–4, six pair combos (two at 1, the rest at 3, 5, 7, 9), mana only, max mana 120 → 200", () => {
    const k = ELEMENTALIST;
    expect(k.keys.map(a => a.elements)).toEqual([["fire"], ["water"], ["earth"], ["wind"]]);
    expect(k.combos!.map(c => [c.keys, c.ability.unlock ?? 1])).toEqual([[[0, 1], 1], [[0, 3], 1], [[0, 2], 3], [[1, 2], 5], [[1, 3], 7], [[2, 3], 9]]);
    for (const a of [...k.keys, ...k.combos!.map(c => c.ability)]) { expect(a.cooldown_s).toBe(0); expect(a.energy).toBeGreaterThan(0); }
    const combo = Math.min(...k.combos!.map(c => c.ability.energy)), solo = Math.max(...k.keys.map(a => a.energy));
    expect(combo).toBeGreaterThan(solo); // combos cost more than solos
    expect(classMods(k, 1).energyMax).toBe(120); expect(classMods(k, 20).energyMax).toBe(200);
    expect(k.ult.channel).toEqual({ seconds: 5, guard: 0.5, notes: 12 });
    expect(k.movement).toMatchObject({ name: "Air Step", on: "airJump" });
  });
  it("Illusionist: Mirror Clone, Swap, Mirror Ward, Trick Card (mastery 3), Vanish; clones 2/3/4 and 10/14/18 s by mastery", () => {
    const at = (m: number) => setup(ILLUSIONIST, m).rt.v2!;
    expect(at(1).keys.map(a => a?.name ?? null)).toEqual(["Mirror Clone", "Swap", "Mirror Ward", null, "Vanish"]);
    expect(at(3).keys[3]?.name).toBe("Trick Card");
    const cap = (m: number) => at(m).keys[0]!.effects.find(e => e.kind === "summon")!.cap;
    expect([cap(1), cap(10), cap(20)]).toEqual([2, 3, 4]);
    const life = (m: number) => Math.round(UNITS["mirror-clone"].life! * classMods(ILLUSIONIST, m).duration);
    expect([life(1), life(10), life(20)]).toEqual([10, 14, 18]);
    expect(ILLUSIONIST.passive).toMatchObject({ kind: "decoy_share", value: 0.3 });
  });
  it("Necromancer: Raise Dead, Command, Corpse Explosion, Dark Pact, Bone Surf (mastery 3, mid-slide); the skeleton cap 4 → 8", () => {
    const { rt } = setup(NECROMANCER);
    expect(rt.v2!.keys.map(a => a?.name ?? null)).toEqual(["Raise Dead", "Command", "Corpse Explosion", "Dark Pact", null]);
    expect(NECROMANCER.keys[4]).toMatchObject({ name: "Bone Surf", unlock: 3, when: "sliding" });
    expect(rt.v2!.capacity).toBe(4);
    expect(setup(NECROMANCER, 20).rt.v2!.capacity).toBe(8);
  });
  it("Transmuter: five forms on one shared form cooldown, 3 s at mastery 1 down to 0.75 s at 20, learned by defeating their mob", () => {
    const { rt } = setup(TRANSMUTER, 1, [[0, 4]], {});
    expect(rt.v2!.keys.map(a => a?.name ?? null)).toEqual(["Fox Form", null, null, null, null]); // the fox is known at the start
    const all = setup(TRANSMUTER).rt.v2!;
    expect(new Set(all.keys.map(a => cdKey(a!)))).toEqual(new Set(["form"]));
    expect(all.keys[0]!.cooldown_s).toBe(3);
    expect(setup(TRANSMUTER, 20).rt.v2!.keys[0]!.cooldown_s).toBeCloseTo(0.75);
    expect(TRANSMUTER.keys.map(a => a.learn ?? null)).toEqual([null, "crab-shell", "wisp-core", "pollen-swarm", "golem-fist"]);
    expect(traitFor("pollen-sprite")?.key).toBe("pollen-swarm"); // the zone-1 sprites teach the Pollen form
    for (const a of TRANSMUTER.keys) expect(a.energy).toBeLessThan(15); // cheaper than other classes' skills
  });
});

describe("the shared primitives (primitives.ts)", () => {
  it("a zone burns what's in it each pulse; a seeking one wanders onto the pack and drags it in", () => {
    const { rt, foe } = setup(ELEMENTALIST, 1, [[0, 5]]);
    hold(foe);
    tap(rt, 0); tap(rt, 3); frames(rt, 3); // fire + wind: Fire Tornado at the aim
    const z = rt.field.zones[0];
    expect(z.seek).toBeGreaterThan(0);
    const hp = foe.hp; frames(rt, 40);
    expect(foe.hp).toBeLessThan(hp);
  });
  it("Steam Veil: enemies inside the steam miss you about half the time", () => {
    const { rt, p } = setup(ELEMENTALIST, 1, [[0, 1.5]]);
    tap(rt, 0); tap(rt, 1); frames(rt, 3);
    expect(rt.field.zones[0].blind).toBe(0.5);
    let landed = 0;
    for (let i = 0; i < 200; i++) { p.hp = p.maxHp; if (hurtPlayer(rt, 10, { x: 0, z: 1.5 }, ME, 0, () => (i % 2 ? 0.2 : 0.8)) > 0) landed++; }
    expect(landed).toBe(100);
  });
  it("Spring Grove heals you while you stand in it", () => {
    const { rt, p } = setup(ELEMENTALIST, 5, []);
    p.hp = p.maxHp * 0.5;
    tap(rt, 1); tap(rt, 2); frames(rt, 31);
    expect(p.hp / p.maxHp).toBeGreaterThan(0.52);
  });
  it("Riptide: a tap pulls the enemy to you; the pair held casts the dash to it instead", () => {
    const s = createInputState(), kit = { inputs: [{ kind: "tap" as const }, { kind: "tap" as const }], combos: [[0, 1] as [number, number]], holds: [true] };
    expect(press(s, kit, 0, 0)).toEqual([]); expect(press(s, kit, 1, 0.1)).toEqual([]);
    expect(release(s, kit, 1, 0.2)).toEqual([{ kind: "combo", combo: 0 }]);
    press(s, kit, 0, 1); press(s, kit, 1, 1.05);
    expect(tick(s, kit, 1.05 + HOLD_AFTER)).toEqual([{ kind: "comboHold", combo: 0 }]);
    const { rt, foe } = setup(ELEMENTALIST, 7, [[0, 8]]);
    tap(rt, 1); tap(rt, 3); frames(rt, 2);
    expect(foe.kx * 0 + foe.kz).toBeLessThan(0); // pulled toward you (-z)
  });
  it("Rampart: a ramped stone wedge that blocks shots and bodies where it stands tall", () => {
    const { rt } = setup(ELEMENTALIST, 9, []);
    rt.player.aim = { x: 0, z: 4 };
    tap(rt, 2); tap(rt, 3); frames(rt, 12);
    const w = rt.field.walls[0];
    expect(w).toBeDefined();
    expect(wallHeight(rt, w.x, w.z + w.d * 0.45)).toBeGreaterThan(wallHeight(rt, w.x, w.z - w.d * 0.45)); // a ramp up away from you
    expect(inWall(rt, w.x, w.z + w.d * 0.4)).toBe(true);
    expect(inWall(rt, w.x + w.w, w.z)).toBe(false);
  });
  it("Swap trades places with the clone nearest the aim (a teleport that keeps your speed) and heals 5%", () => {
    const { rt, p } = setup(ILLUSIONIST, 1, []);
    tap(rt, 0); frames(rt, 2);
    const clone = rt.units.find(u => u.def.kind === "clone")!;
    expect(clone.hp).toBe(Math.round(p.maxHp * 0.3));
    clone.x = 3; clone.z = 3; p.hp = p.maxHp * 0.5; p.aim = { x: 3, z: 3 };
    tap(rt, 1); frame(rt);
    expect(p.kick?.to).toEqual({ x: 3, z: 3 });
    expect(clone.x).toBe(0);
    expect(p.hp / p.maxHp).toBeCloseTo(0.55, 2);
  });
  it("Mirror Ward reflects a shot at its shooter; looking at a clone it bounces through it, doubled and a sure crit", () => {
    const { rt, p, foe } = setup(ILLUSIONIST, 1, [[0, 6]]);
    hold(foe);
    const shoot = () => rt.projectiles.push({ id: rt.seq++, x: 0, z: 1, vx: 0, vz: -11, life: 1, from: "enemy", damage: 12, kind: "rune", radius: 0.3 });
    tap(rt, 2); frame(rt);
    shoot(); frames(rt, 2);
    expect(p.hp).toBe(p.maxHp);
    expect(rt.projectiles.some(s => s.from === "player" && s.kind === "card" && s.vz > 0)).toBe(true);
    // mistimed: the window is spent
    frames(rt, 30); shoot(); frames(rt, 3);
    expect(p.hp).toBeLessThan(p.maxHp);
    // through a clone under the aim: double, a sure crit
    p.hp = p.maxHp; rt.v2!.cd = {};
    summon(rt, "mirror-clone", 1, { pos: { x: 1, z: 2 }, aim: { x: 1, z: 2 }, dir: { x: 0, z: 1 }, sup: 1, stat: "arcana" }, "illusionist.mirror-clone", 2, { x: 1, z: 2 });
    p.aim = { x: 1, z: 2 };
    tap(rt, 2); frame(rt); shoot(); frames(rt, 2);
    const back = rt.projectiles.find(s => s.from === "player" && s.hit?.crit);
    expect(back?.hit?.power).toBeGreaterThan(0);
  });
  it("Vanish: enemies lose you; coming close or attacking reveals you, and the first hit out deals 80% more once", () => {
    const { rt, p } = setup(ILLUSIONIST, 1, [[0, 6]]);
    tap(rt, 4); frame(rt);
    expect(rt.field.stealth).toBeGreaterThan(3);
    p.attackCd = 0; attack(rt, ME, never);
    expect(rt.field.stealth).toBe(0);
    const fox = () => ({ ...spawnEnemy("fox", ENEMIES["shadow-fox"], 0, 3), hp: 999 }); // no defense or armour: the ratio reads true
    const amb = strike(rt, fox(), { power: 1, from: ME }, never), after = strike(rt, fox(), { power: 1, from: ME }, never);
    expect(amb / after).toBeCloseTo(1.8, 1);
    expect(p.alive).toBe(true);
  });
  it("Raise Dead raises the corpses near the aim as skeletons (a bone wisp with none); Command sends them all, then calls them back", () => {
    const { rt, foe } = setup(NECROMANCER, 1, [[0, 9]]);
    tap(rt, 0); frame(rt);
    expect(rt.units.map(u => u.def.key)).toEqual(["bone-wisp"]);
    rt.v2!.cd = {}; corpseAt(rt, 0, 4); corpseAt(rt, 1, 4); corpseAt(rt, -1, 4);
    tap(rt, 0); frame(rt);
    expect(rt.units.filter(u => u.def.key === "skeleton").length).toBe(3);
    expect(rt.units.find(u => u.def.key === "skeleton")!.body?.type.id).toBe("skeleton-warrior");
    p_aim(rt, foe); tap(rt, 1); frame(rt);
    expect(rt.field.order).toMatchObject({ mode: "charge", target: foe.id });
    rt.v2!.cd = {}; tap(rt, 1); frame(rt);
    expect(rt.field.order.mode).toBe("guard");
  });
  it("Corpse Explosion blows up the corpse at the aim and chains through the corpses round it", () => {
    const { rt, foe } = setup(NECROMANCER, 1, [[0, 6]]);
    hold(foe);
    const a = corpseAt(rt, 0, 4), b = corpseAt(rt, 0, 6.5), c = corpseAt(rt, 2, 8.5);
    rt.player.aim = { x: 0, z: 4 };
    const hp = foe.hp; tap(rt, 2); frame(rt);
    expect(a.raised && b.raised && c.raised).toBe(true); // all three went
    expect(hp - foe.hp).toBeGreaterThan(0);
  });
  it("Dark Pact consumes a minion for a heal and a bone shield; with none it refuses and spends nothing", () => {
    const { rt, p } = setup(NECROMANCER, 1, []);
    p.hp = p.maxHp * 0.5; const e = p.energy;
    tap(rt, 3); frame(rt);
    expect(p.energy).toBe(e);
    corpseAt(rt, 0, 4); tap(rt, 0); frame(rt); rt.v2!.cd = {};
    tap(rt, 3); frame(rt);
    expect(rt.units.length).toBe(0);
    expect(p.hp / p.maxHp).toBeCloseTo(0.62, 2); expect(p.shield).toBeGreaterThan(0);
  });
  it("Bone Surf holds a slide's speed and ploughs enemies aside; a slide-jump out of it carries more", () => {
    const { rt, p, foe } = setup(NECROMANCER, 3, [[0, 1]]);
    p.move = { mode: "slide", speed: 13, sinceDash: 9, vx: 0, vz: 13 };
    tap(rt, 4); frame(rt);
    expect(rt.field.surf).not.toBeNull();
    expect(p.kick?.hold).toBeGreaterThanOrEqual(12);
    expect(foe.hp).toBeLessThan(foe.type.hp);
  });
  it("Grave Tithe: a kill near you heals 3% and its corpse lasts twice as long", () => {
    const { rt, p, foe } = setup(NECROMANCER, 1, [[0, 2]]);
    p.hp = p.maxHp * 0.5; p.last = { ...ME };
    const dead = foe; dead.hp = 1; strike(rt, dead, { power: 5, from: ME }, never);
    expect(p.hp / p.maxHp).toBeCloseTo(0.53, 2);
    expect(corpseLife(dead)).toBe(40);
    dead.deadFor = 30; expect(corpse(dead)).toBe(true);
  });
  it("forms: a shift takes the form's click attack and stance, leaves a small barrier, and a hit within 0.25 s is countered", () => {
    const { rt, p, foe } = setup(TRANSMUTER, 1, [[0, 1.5]]);
    hold(foe);
    tap(rt, 1); frame(rt); // the crab
    expect(rt.v2!.form).toBe("crab");
    expect(p.shield).toBeGreaterThan(0); // Shed Skin
    expect(hurtPlayer(rt, 30, { x: 0, z: 1.5 }, ME, 3, never)).toBe(0); // Perfect Shift: blocked, pinched back
    expect(foe.hp).toBeLessThan(foe.type.hp);
    frames(rt, 12);
    expect(hurtPlayer(rt, 30, { x: 0, z: 1.5 }, ME, 3, never)).toBeGreaterThan(0); // past the window it lands
    p.attackCd = 0; attack(rt, ME, never);
    expect(p.attackCd).toBeCloseTo(0.6, 2); // the pinch's cadence
    // one shared cooldown: the fox waits
    tap(rt, 0); frame(rt);
    expect(rt.v2!.form).toBe("crab");
  });
  it("the Golem's Perfect Shift takes the hit without flinching and slams back", () => {
    const { rt, p } = setup(TRANSMUTER, 1, [[0, 1.5]]);
    tap(rt, 4); frame(rt);
    const lost = hurtPlayer(rt, 40, { x: 0, z: 1.5 }, ME, 5, never);
    expect(lost).toBeGreaterThan(0); expect(lost).toBeLessThan(20);
    expect(p.knock).toBe(0);
  });
});

describe("the Arcane ults", () => {
  it("Cataclysm: a 5 s rooted, guarded charge with a mash of 12 notes three at a time; the hits set the power 0.5–1.5; it releases early on the last note", () => {
    expect(mashPotency(0, 12)).toBe(0.5); expect(mashPotency(12, 12)).toBe(1.5); expect(mashPotency(6, 12)).toBe(1);
    const { rt, foe } = setup(ELEMENTALIST, 1, [[0, 5], [1, 5]]);
    for (const e of rt.enemies) hold(e);
    rt.v2!.meter = ULT.max; pressUlt(rt); frame(rt);
    const v = rt.v2!;
    expect(v.channel?.notes.length).toBe(12);
    expect(mashNotes(v)).toHaveLength(3);
    expect(rt.buffs.some(b => b.stat === "guard" && b.value === 0.5)).toBe(true);
    expect(attack(rt, ME, never)).toBe(false); // the charge takes your hands
    while (v.channel) { classKey(rt, v.channel.notes[v.channel.at], true); frame(rt); }
    expect(v.cast?.potency).toBe(1.5);
    const hp = foe.hp; frames(rt, 30);
    expect(hp - foe.hp).toBeGreaterThan(0);
  });
  it("The Joker: a sweeping mirror traps what it crosses (pressed flat), then shatters on all of them at the end", () => {
    const { rt } = setup(ILLUSIONIST, 1, [[0, 3], [2, 6], [-3, 8]]);
    rt.player.aim = { x: 0, z: 10 };
    rt.v2!.meter = ULT.max; pressUlt(rt);
    frames(rt, 14 + 20);
    const sweep = rt.field.sweeps[0];
    expect(sweep?.trapped.length).toBeGreaterThan(0);
    expect(sweep!.trapped.every(e => e.flat === 1)).toBe(true);
    frames(rt, 40);
    expect(rt.field.sweeps).toHaveLength(0);
    expect(rt.enemies.every(e => e.hp < e.type.hp)).toBe(true);
    expect(rt.tally.ult).toBeGreaterThan(0);
  });
  it("Army of the Dead: every corpse and thirty skeletons rise outside the cap, march, and burst together at the finisher", () => {
    const { rt } = setup(NECROMANCER, 1, [[0, 6], [1, 7]]);
    corpseAt(rt, 0, 4); corpseAt(rt, 2, 4);
    rt.v2!.meter = ULT.max; pressUlt(rt); frames(rt, 18);
    const army = rt.units.filter(u => u.def.key === "army-skeleton");
    expect(army.length).toBe(32);
    expect(rt.units.filter(u => (u.def.cost ?? 1) > 0)).toHaveLength(0); // no capacity spent
    frames(rt, 95);
    expect(rt.units.filter(u => u.def.key === "army-skeleton")).toHaveLength(0);
  });
  it("Chimera: ten seconds fused (no form cooldowns or energy), hits in the window are the ult's, then the pounce and back to the form before", () => {
    const { rt, p } = setup(TRANSMUTER, 1, [[0, 2]]);
    tap(rt, 4); frame(rt);
    rt.v2!.meter = ULT.max; pressUlt(rt); frames(rt, 16);
    expect(rt.v2!.form).toBe("chimera");
    const meter = rt.v2!.meter, e = p.energy;
    tap(rt, 0); frame(rt);
    expect(rt.v2!.form).toBe("chimera"); expect(p.energy).toBe(e); // a move, no shift, free
    strike(rt, rt.enemies[0], { power: 1, from: ME }, never);
    expect(rt.v2!.meter).toBe(meter); // the window's hits charge nothing
    frames(rt, 30 * 11);
    expect(rt.v2!.form).toBe("golem");
  });
});

describe("Attunement and Who's Real?", () => {
  it("alternating elements adds ult points; the same element twice adds none", () => {
    const { rt } = setup(ELEMENTALIST, 1, [[0, 30]]);
    tap(rt, 0); frames(rt, 14);
    const m0 = rt.v2!.meter;
    tap(rt, 2); frames(rt, 14);
    const m1 = rt.v2!.meter;
    tap(rt, 2); frames(rt, 14);
    expect(m1 - m0).toBeGreaterThan(0);
    expect(rt.v2!.meter - m1).toBe(0);
    expect(rt.v2!.element).toBe("earth");
  });
  it("while clones stand, about 30% of enemies go after one instead of you", () => {
    const foes: [number, number][] = Array.from({ length: 60 }, (_, i) => [i - 30, 8]);
    const { rt } = setup(ILLUSIONIST, 1, foes);
    tap(rt, 0); frame(rt);
    const clone = rt.units.find(u => u.def.kind === "clone")!;
    const lured = rt.enemies.filter(e => { const t = enemyTarget(rt, e, { ...ME, safe: false, alive: true }); return t.x === clone.x && t.z === clone.z; }).length;
    expect(lured / 60).toBeGreaterThan(0.18); expect(lured / 60).toBeLessThan(0.42);
    rt.units = [];
    expect(rt.enemies.every(e => enemyTarget(rt, e, { ...ME, safe: false, alive: true }).x === 0)).toBe(true);
  });
});

function p_aim(rt: CombatRuntime, e: Enemy) { rt.player.aim = { x: e.x, z: e.z }; }

describe("the Arcane clips and grips", () => {
  it("every clip an Arcane kit names is in the verb library (its own clips baked by build_clips.py @unique), on its weapon's grip", () => {
    for (const k of [ELEMENTALIST, ILLUSIONIST, NECROMANCER, TRANSMUTER]) {
      const grip = gripFor(k.signature.type);
      for (const a of [...k.keys, ...(k.combos ?? []).flatMap(c => [c.ability, ...(c.hold ? [c.hold] : [])]), k.ult]) {
        if (!a.clip) continue;
        const name = "verb" in a.clip ? verbClip(a.clip.verb as Verb, grip) : a.clip.unique;
        expect(verbInfo(name), `${a.key}: ${name}`).not.toBeNull();
        if ("unique" in a.clip) expect(verbInfo(name)!.grip, name).toBe(grip);
      }
    }
    expect([ELEMENTALIST, ILLUSIONIST, NECROMANCER, TRANSMUTER].map(k => gripFor(k.signature.type))).toEqual(["Staff", "OneHand", "Book", "Fists"]);
  });
});
