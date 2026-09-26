import { describe, expect, it } from "vitest";
import { CAPS, FAMILY_ABILITIES, SUBCLASSES, subclassByKey, TRAITS, type Ability } from "@/lib/combat/kits";
import { presetAllocation } from "@/lib/combat/progression";
import { ENEMIES } from "./data";
import { hurtPlayer, resolveCast, startDodge, triggerAbility } from "./actions";
import { CAST, equipKit, heal, hitAmount, strike, summon, fireSlot } from "./abilities";
import { stepCombat } from "./encounter";
import { createRuntime, SLOT_IDS, type CombatRuntime } from "./runtime";
import { spawnEnemy, type Enemy } from "./sim";
import type { IncantationScore } from "./contract";

const noCrit = () => 0.99;
const cast = (power = 1): IncantationScore => ({ accuracy: 80, coverage: 1, deviation: 0, order: 1, scribble: false, outcome: "normal", power });
const ME = { x: 0, z: 0 };
/** A level-10 member of `sub` with the family preset, facing +z at a dummy 1.8 m ahead (inside every melee reach). */
function setup(sub: string, loadout: string[] = [], hp = 5000): { rt: CombatRuntime; dummy: Enemy } {
  const rt = createRuntime(), s = subclassByKey(sub)!;
  rt.player.stats = presetAllocation(s.family, 10); rt.player.safe = false; rt.player.aim = { x: 0, z: 1.8 }; rt.player.facing = 0;
  rt.player.maxHp = rt.player.hp = 300;
  equipKit(rt, s, loadout);
  const dummy = { ...spawnEnemy("dummy", { ...ENEMIES["thorn-crab"], hp, defense: 0, speed: 0 }, 0, 1.8), state: "chase" as const };
  rt.enemies = [dummy];
  return { rt, dummy };
}
const press = (rt: CombatRuntime, slot: number, power = 1) => {
  const ok = fireSlot(rt, slot, ME, noCrit);
  if (ok && rt.casting) resolveCast(rt, ME, cast(power), noCrit);
  return ok;
};
const run = (rt: CombatRuntime, seconds: number) => { for (let t = 0; t < seconds; t += 1 / 30) stepCombat(rt, ME, 1 / 30, () => true, noCrit); };
const keyOf = (rt: CombatRuntime, slot: number) => rt.slots[slot]!.key;

describe("the sixteen kits run from data through one system (Part B 1)", () => {
  it("offers 5 abilities per kit (signature, two own, two family), four equipped by default, incantations only on selected spells", () => {
    for (const s of SUBCLASSES) {
      const { rt } = setup(s.key);
      expect(rt.slots.every(Boolean)).toBe(true);
      expect(rt.slots[0]).toBe(s.signature);
    }
    const drawn = [...SUBCLASSES.flatMap(s => [s.signature, ...s.abilities]), ...Object.values(FAMILY_ABILITIES).flat()].filter(a => a.incantation).map(a => a.key);
    expect(drawn.sort()).toEqual(["arcane.starfall", "elementalist.burst", "summoner.call", "warden.covenant"]); // row 52: selected powerful spells only
  });
  for (const s of SUBCLASSES) {
    it(`${s.name}: every equipped ability has an effect, pays energy and starts its cooldown`, () => {
      for (let slot = 0; slot < 4; slot++) {
        const { rt, dummy } = setup(s.key);
        rt.enemies.push(spawnEnemy("corpse", ENEMIES["shadow-fox"], 1, 2)); rt.enemies[1].state = "dead";
        const ab = rt.slots[slot]!;
        const before = { hp: dummy.hp, units: rt.units.length, shield: rt.player.shield, buffs: rt.buffs.length, energy: rt.player.energy };
        rt.player.hp = 150; // room to heal
        expect(press(rt, slot)).toBe(true);
        const dashed = !!rt.player.dash;
        run(rt, 0.6); // dashes land, shots arrive, totems pulse
        const did = dummy.hp < before.hp || rt.units.length > before.units || rt.player.shield > before.shield || rt.buffs.length > before.buffs || rt.player.hp > 150 || rt.transform
          || dashed || dummy.status.distract > 0;
        expect(did, `${ab.name} did nothing`).toBeTruthy();
        expect(rt.player.energy).toBeLessThan(before.energy + 0.6 * 12 + 1e-6);
        expect(rt.cooldowns[SLOT_IDS[slot]]).toBeGreaterThan(ab.cooldown_s - 0.7);
        expect(press(rt, slot)).toBe(false); // still cooling down
      }
    });
  }
});

describe("incantations on the rune prototype (rows 52, 53, C2, C3)", () => {
  it("start for a quarter of the energy; a fizzle pays nothing more and recovers briefly; the world keeps running while drawing", () => {
    const { rt, dummy } = setup("elementalist");
    dummy.state = "idle";
    const fox = spawnEnemy("fox", ENEMIES["shadow-fox"], 0, 6); rt.enemies.push(fox);
    expect(fireSlot(rt, 0, ME)).toBe(true);
    expect(rt.casting?.rune).toBe("spark");
    expect(rt.player.energy).toBe(100 - Math.ceil(35 * CAST.start));
    run(rt, 1); // tracing: the fox still comes (no pause, row 53)
    expect(Math.hypot(fox.x, fox.z)).toBeLessThan(6);
    resolveCast(rt, ME, { ...cast(0), outcome: "fail" });
    expect(dummy.hp).toBe(5000);
    expect(rt.cooldowns.slot1).toBe(CAST.recovery);
  });
  it("potency scales damage fully but caps shields and heals at 1.2 and control at 1", () => {
    const dmg = (power: number) => { const { rt, dummy } = setup("elementalist"); press(rt, 0, power); return 5000 - dummy.hp; };
    expect(dmg(1.5)).toBeGreaterThan(dmg(1) * 1.4);
    const ward = (power: number) => { const { rt } = setup("druid", ["warden.covenant"]); press(rt, 0, power); return { shield: rt.player.shield, hold: rt.enemies[0].status.hold }; };
    expect(ward(1.5).shield).toBeCloseTo(ward(1).shield * 1.2, 1);
    expect(ward(1.5).hold).toBeCloseTo(ward(1).hold, 5);
  });
  it("a dodge cancels the drawing (row C3)", () => {
    const { rt } = setup("summoner");
    press(rt, 0); // call is drawn: resolve it, then start another drawn one
    rt.cooldowns.slot4 = 0;
    expect(fireSlot(rt, 3, ME)).toBe(true); // Verdant Covenant
    expect(startDodge(rt, { x: 1, z: 0 })).toBe(true);
    expect(rt.casting).toBeNull();
  });
});

describe("summons, totems, traps and decoys persist within caps (row 50)", () => {
  it("Summoner companions persist, cost capacity, and the oldest leaves when a new one would pass it", () => {
    const { rt } = setup("summoner");
    const cap = rt.kit!.capacity;
    expect(cap).toBe(2 + Math.floor(rt.player.stats.spirit / 5) + subclassByKey("summoner")!.mods!.capacity!);
    for (let i = 0; i < 4; i++) { rt.cooldowns.slot1 = rt.cooldowns.slot2 = rt.cooldowns.slot3 = 0; rt.player.energy = 100; press(rt, i % 3); }
    const cost = rt.units.reduce((n, u) => n + (u.def.kind === "minion" ? u.def.cost ?? 1 : 0), 0);
    expect(cost).toBeLessThanOrEqual(cap);
    expect(rt.units.every(u => u.life === null)).toBe(true); // persistent
    run(rt, 30);
    expect(rt.units.length).toBeGreaterThan(0);
  });
  it("different companion types coexist, and dropping an ability from the loadout dismisses its units", () => {
    const { rt } = setup("summoner");
    press(rt, 1); rt.player.energy = 100; press(rt, 2);
    expect(new Set(rt.units.map(u => u.def.key))).toEqual(new Set(["fox", "crab"]));
    equipKit(rt, subclassByKey("summoner"), ["summoner.call", "summoner.fox-pack", "warden.renew", "warden.covenant"]);
    expect(rt.units.map(u => u.def.key)).toEqual(["fox", "fox"]);
  });
  it("the summoning weapon selects the Summoner's companions (row 43)", () => {
    const { rt } = setup("summoner");
    rt.player.weapon = "tome-warden";
    press(rt, 0);
    expect(rt.units.map(u => u.def.key)).toEqual(["fox", "fox"]);
  });
  it("Shaman: one totem per role, three at most; overlapping circles work harder (Resonance)", () => {
    const { rt } = setup("shaman");
    for (let i = 0; i < 2; i++) { rt.cooldowns.slot1 = 0; rt.player.energy = 100; press(rt, 0); }
    expect(rt.units.filter(u => u.def.key === "totem-ember")).toHaveLength(1);
    rt.player.energy = 100; press(rt, 1); rt.player.energy = 100; press(rt, 2);
    expect(rt.units.filter(u => u.def.kind === "totem")).toHaveLength(CAPS.totems);
    // Mending totem alone vs overlapping another: the same pulse heals more inside the overlap.
    const healed = (overlap: boolean) => {
      const { rt: r } = setup("shaman"); r.enemies = []; r.player.hp = 100; r.player.aim = { x: 0, z: 0 };
      press(r, 1); if (overlap) { r.player.energy = 100; press(r, 0); }
      const hp = r.player.hp; run(r, 1.05); return r.player.hp - hp;
    };
    expect(healed(true)).toBeGreaterThan(healed(false) * 1.2);
  });
  it("Sniper traps: two at most; one springs on the first enemy through it, holding and hurting it", () => {
    const { rt, dummy } = setup("sniper");
    rt.player.aim = { x: 0, z: 8 };
    for (let i = 0; i < 3; i++) { rt.cooldowns.slot1 = 0; rt.player.energy = 100; press(rt, 0); }
    expect(rt.units.filter(u => u.def.kind === "trap")).toHaveLength(CAPS.traps);
    rt.units[0].x = dummy.x; rt.units[0].z = dummy.z;
    run(rt, 0.1);
    expect(dummy.status.hold).toBeGreaterThan(2);
    expect(dummy.hp).toBeLessThan(5000);
    expect(rt.units.filter(u => u.def.kind === "trap")).toHaveLength(1);
  });
  it("the Illusionist's phantom draws enemies to it and they count as distracted (Misdirection)", () => {
    const { rt, dummy } = setup("illusionist");
    const plain = hitAmount(rt, dummy, { power: 1, from: ME }, noCrit).amount;
    press(rt, 0);
    expect(rt.units.filter(u => u.def.kind === "decoy")).toHaveLength(1);
    expect(hitAmount(rt, dummy, { power: 1, from: ME }, noCrit).amount).toBeGreaterThan(plain);
  });
});

describe("starters and missing gear (plan edge cases)", () => {
  it("Necromancer raises a bone wisp with no body near, a shade of the fallen enemy with one", () => {
    const { rt } = setup("necromancer");
    press(rt, 0);
    expect(rt.units.map(u => u.def.key)).toEqual(["bone-wisp"]);
    const { rt: r2 } = setup("necromancer");
    const golem = { ...spawnEnemy("g", ENEMIES["stone-golem"], 2, 2), state: "dead" as const };
    r2.enemies.push(golem);
    press(r2, 0);
    expect(r2.units[0]).toMatchObject({ def: { key: "shade" }, body: { type: { id: "stone-golem" } } });
    expect(golem.raised).toBe(true);
  });
  it("Transmuter fights before any kill with Fox Stride; learned traits join the kit and mastery raises their tier", () => {
    const { rt, dummy } = setup("transmuter");
    expect(rt.slots.map(a => a?.key)).toContain("trait.fox-stride");
    const slot = rt.slots.findIndex(a => a?.key === "trait.fox-stride");
    press(rt, slot); run(rt, 0.5);
    expect(dummy.hp).toBeLessThan(5000);
    expect(rt.transform).not.toBeNull();
    expect(rt.player.shield).toBeGreaterThan(0); // Shed Skin
    const golemHit = (kills: number) => { const r = createRuntime(); r.player.stats = presetAllocation("Arcane", 10); equipKit(r, subclassByKey("transmuter"), ["trait.golem-fist"], { "golem-fist": kills });
      const d = { ...spawnEnemy("d", { ...ENEMIES["thorn-crab"], hp: 5000, defense: 0 }, 0, 3), state: "chase" as const }; r.enemies = [d]; r.player.aim = { x: 0, z: 3 }; press(r, 0); return 5000 - d.hp; };
    expect(golemHit(30)).toBeGreaterThan(golemHit(1));
    expect(TRAITS.find(t => t.key === "golem-fist")!.from).toEqual(["stone-golem"]);
  });
  it("Gunslinger without a revolver at 70%; Monk with wraps full, with a sword 85%; Guardian without a shield blocks half", () => {
    const fan = (weapon: string) => { const { rt, dummy } = setup("gunslinger"); rt.player.weapon = weapon; rt.player.aim = { x: 0, z: 1.2 }; dummy.z = 1.2; press(rt, 0); run(rt, 0.3); return 5000 - dummy.hp; };
    expect(fan("bow-willow") / fan("revolver-brass")).toBeLessThan(0.8);
    const flow = (weapon: string) => { const { rt, dummy } = setup("monk"); rt.player.weapon = weapon; press(rt, 0); run(rt, 0.4); return 5000 - dummy.hp; };
    expect(flow("sword-driftwood")).toBeLessThan(flow("wraps-cloth"));
    const { rt } = setup("guardian");
    press(rt, 0);
    expect(rt.buffs.find(b => b.stat === "block")!.value).toBeCloseTo(0.4); // no buckler: 0.8 × 0.5
  });
});

describe("passives (one modifier each on the shared hooks)", () => {
  const hitOn = (rt: CombatRuntime, e: Enemy) => hitAmount(rt, e, { power: 1, from: ME }, noCrit).amount;
  it("Guardian: a frontal hit is blocked, answered with a bash and builds a barrier; one from behind isn't", () => {
    const { rt, dummy } = setup("guardian");
    rt.player.weapon = "shield-buckler";
    press(rt, 0);
    const took = hurtPlayer(rt, 40, { x: 0, z: 2 }, ME);
    expect(took).toBeLessThanOrEqual(Math.round(40 * 0.2));
    expect(rt.player.shield).toBeGreaterThan(0);
    expect(dummy.hp).toBeLessThan(5000); // Shield Counter's bash
    rt.player.shield = 0;
    expect(hurtPlayer(rt, 40, { x: 0, z: -2 }, ME)).toBe(40);
  });
  it("Assassin and Druid heal from hits (the Druid twice from held enemies); Necromancer from deaths nearby", () => {
    const { rt, dummy } = setup("assassin"); rt.player.hp = 100;
    strike(rt, dummy, { power: 1, from: ME }, noCrit);
    expect(rt.player.hp).toBeGreaterThan(100);
    const drain = (held: boolean) => { const { rt: r, dummy: d } = setup("druid"); r.player.hp = 100; if (held) d.status.hold = 2; strike(r, d, { power: 1, from: ME }, noCrit); return r.player.hp - 100; };
    expect(drain(true)).toBeCloseTo(drain(false) * 2, 5);
    const { rt: n, dummy: nd } = setup("necromancer"); n.player.hp = 100; n.player.last = ME; nd.hp = 1;
    strike(n, nd, { power: 1, from: ME }, noCrit);
    expect(n.player.hp).toBeCloseTo(100 + 300 * 0.04);
  });
  it("Elementalist: a different element than the last hits harder", () => {
    const { rt, dummy } = setup("elementalist", ["elementalist.frost-nova", "elementalist.firebolt"]);
    dummy.x = 0; dummy.z = 2;
    press(rt, 0); const first = 5000 - dummy.hp; // frost, no previous element
    dummy.hp = 5000; dummy.status.hold = 0; rt.cooldowns.slot1 = 0; rt.player.energy = 100;
    rt.passive.element = "fire"; press(rt, 0); const switched = 5000 - dummy.hp;
    expect(switched).toBeGreaterThan(first);
  });
  it("Marksman standing still, Hunter on the same target, Sniper from far away all hit harder", () => {
    const { rt: m, dummy: md } = setup("marksman"); m.player.last = ME;
    const moving = hitOn(m, md); m.player.still = 1; expect(hitOn(m, md)).toBeGreaterThan(moving);
    const { rt: h, dummy: hd } = setup("hunter");
    const firstHit = hitOn(h, hd); for (let i = 0; i < 4; i++) strike(h, hd, { power: 0.01, from: ME }, noCrit);
    expect(hitOn(h, hd)).toBeGreaterThan(firstHit);
    const { rt: s, dummy: sd } = setup("sniper"); s.player.last = ME;
    const near = hitOn(s, sd); sd.z = 12; expect(hitOn(s, sd)).toBeGreaterThan(near);
  });
  it("Gunslinger: crits take a second off Fan the Hammer, three times per use", () => {
    const { rt, dummy } = setup("gunslinger");
    press(rt, 0);
    const cd = rt.cooldowns.slot1;
    for (let i = 0; i < 5; i++) strike(rt, dummy, { power: 0.01, from: ME }, () => 0); // every hit a crit
    expect(rt.cooldowns.slot1).toBeCloseTo(cd - 3);
  });
  it("Monk: consecutive hits raise speed; Juggernaut takes hits without knockback", () => {
    const { rt, dummy } = setup("monk");
    run(rt, 0.05); const base = rt.player.speed;
    for (let i = 0; i < 3; i++) strike(rt, dummy, { power: 0.01, from: ME }, noCrit);
    run(rt, 0.05);
    expect(rt.player.speed).toBeGreaterThan(base);
    const { rt: j } = setup("juggernaut");
    hurtPlayer(j, 10, { x: 0, z: 2 }, ME); run(j, 1 / 30);
    expect(j.player.impulse).toEqual({ x: 0, z: 0 });
  });
  it("Summoner: each companion strengthens the others (Pack Bond); Priest: healing past full becomes a shield", () => {
    const { rt, dummy } = setup("summoner");
    const src = { power: 1, from: ME, unit: true };
    const alone = hitAmount(rt, dummy, src, noCrit).amount;
    summon(rt, "fox", 3, { pos: ME, aim: ME, dir: { x: 0, z: 1 }, sup: 1, stat: "spirit" }, "summoner.fox-pack");
    expect(hitAmount(rt, dummy, src, noCrit).amount).toBeGreaterThan(alone);
    const { rt: p } = setup("priest");
    heal(p, 60);
    expect(p.player.shield).toBeCloseTo(30);
  });
  it("Assassin moves faster and has less health; Juggernaut more (row 35)", () => {
    const { rt } = setup("assassin"); run(rt, 0.05);
    const { rt: other } = setup("monk"); run(other, 0.05);
    expect(rt.player.speed).toBeGreaterThan(other.player.speed);
    const s = subclassByKey("assassin")!;
    expect(s.mods?.max_hp).toBeLessThan(0);
  });
});

describe("dashes", () => {
  it("i-frames make hits miss; what follows a dash lands where it ends", () => {
    const { rt } = setup("juggernaut", ["vanguard.leap"]);
    rt.enemies = [{ ...spawnEnemy("far", { ...ENEMIES["thorn-crab"], hp: 5000, defense: 0, speed: 0 }, 0, 5), state: "chase" }];
    rt.player.aim = { x: 0, z: 5 };
    press(rt, 0);
    expect(rt.enemies[0].hp).toBe(5000); // not yet: the strike lands on arrival
    let at = { ...ME };
    for (let t = 0; t < 0.5; t += 1 / 30) { at = { x: at.x + rt.player.impulse.x / 30, z: at.z + rt.player.impulse.z / 30 }; stepCombat(rt, at, 1 / 30, () => true, noCrit); }
    expect(at.z).toBeGreaterThan(3.5);
    expect(rt.enemies[0].hp).toBeLessThan(5000);
    const { rt: a } = setup("assassin");
    press(a, 0);
    expect(hurtPlayer(a, 30, { x: 0, z: 1 }, ME)).toBe(0);
  });
});

it("abilities are only reachable through the four slots and the swap key", () => {
  const { rt } = setup("priest");
  expect(triggerAbility(rt, "slot1", ME)).toBe(true);
  expect(keyOf(rt, 0)).toBe("priest.holy-beam");
  const owned = rt.player.owned.length;
  expect(triggerAbility(rt, "swap", ME)).toBe(true);
  expect(owned).toBeGreaterThan(1);
  const none: Ability | null = createRuntime().slots[0];
  expect(none).toBeNull();
});
