import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { signatureSeedSql } from "@/lib/combat/seed";
import { join } from "node:path";
import { classKit, classMods, kitAt, MAX_KEYS, upgraded, withMods, type ClassKit } from "@/lib/combat/classes";
import { DRUID, PRIEST, SHAMAN, SUMMONER, WARDEN_KITS } from "@/lib/combat/wardenKits";
import { UNITS, CAPS } from "@/lib/combat/kits";
import { SUBCLASS_FOR_TYPE } from "@/lib/oracle/subclass";
import { WEAPONS as SYSTEM_WEAPONS, signatureGrant } from "@/lib/combat/weapons";
import { ULT } from "@/lib/combat/ult";
import { gripFor, verbInfo } from "@/lib/game/character/clips";
import { cancelCast, resolveCast, strike } from "./abilities";
import { attack, hurtPlayer } from "./actions";
import { classKey, classMove, equipClassKit, pressUlt, stepClass } from "./classRuntime";
import { ENEMIES, WEAPONS } from "./data";
import { stepCombat } from "./encounter";
import { createRuntime, energyMax, type CombatRuntime } from "./runtime";
import { spawnEnemy, type Enemy } from "./sim";
import { field, fadeOf, inGrowth, rooted, walled, wallStops } from "./field";
import { enclosed, hull, linksOf, totemState, TOTEM } from "./totems";
import { BEAST, beastCap, beastState, RITUAL, setTamed } from "./beasts";

const never = () => 0.99; // no crits, no rolls
let ME = { x: 0, z: 0 };
const WEAPON: Record<string, string> = { summoner: "seal-gloves-1", shaman: "totem-staff-1", druid: "living-staff-1", priest: "sunstone-staff-1" };
function setup(kit: ClassKit, mastery = 1, foes: [string, number, number][] = [["stone-golem", 0, 4]]) {
  ME = { x: 0, z: 0 };
  const rt = createRuntime(), p = rt.player;
  p.safe = false; p.weapon = WEAPON[kit.key]; p.owned.push(p.weapon); p.level = 10; p.energy = 100;
  equipClassKit(rt, kit, mastery);
  p.energy = energyMax(rt); p.hp = p.maxHp; p.last = { ...ME };
  const list = foes.map(([type, x, z], i) => { const e: Enemy = { ...spawnEnemy(`foe${i}`, ENEMIES[type], x, z), state: "chase" }; rt.enemies.push(e); return e; });
  p.aim = { x: 0, z: 4 };
  return { rt, p, foes: list, foe: list[0] };
}
function frame(rt: CombatRuntime, dt = 1 / 30) {
  stepClass(rt, ME, dt, dt, never);
  stepCombat(rt, ME, dt, () => true, never);
}
const frames = (rt: CombatRuntime, n: number) => { for (let i = 0; i < n; i++) frame(rt); };
const tap = (rt: CombatRuntime, slot: number) => { classKey(rt, slot, true); classKey(rt, slot, false); };
/** Hold every foe in place (and give them plenty of health) so a test reads one rule. */
const start = new WeakMap<Enemy, number>();
const pin = (rt: CombatRuntime, hp = 99999) => { for (const e of rt.enemies) { e.status.hold = 999; e.hp = hp; start.set(e, hp); } };
const hurt = (e: Enemy) => (start.get(e) ?? e.type.hp) - e.hp;

describe("the Warden kits (data)", () => {
  it("four kits, keys 1–5, an ult, a passive, a stat direction, each in the Warden family and the Oracle map", () => {
    expect(WARDEN_KITS.map(k => k.key)).toEqual(["summoner", "shaman", "druid", "priest"]);
    for (const k of WARDEN_KITS) {
      expect(classKit(k.key)).toBe(k);
      expect(k.family).toBe("Warden");
      expect(k.keys.length).toBe(MAX_KEYS);
      expect(new Set(k.keys.map(a => a.key)).size).toBe(5);
      expect(k.keys.filter(a => a.heavy).length).toBeLessThanOrEqual(2); // §3: at most 2 heavy
      expect(k.keys.filter(a => a.effects.some(e => e.kind === "dash" && e.iframes)).length).toBeLessThanOrEqual(1);
      expect(Object.values(SUBCLASS_FOR_TYPE).filter(s => s.subclass === k.key).length).toBe(1);
      expect(k.ult.anticipation_ms).toBeGreaterThanOrEqual(250); expect(k.ult.anticipation_ms).toBeLessThanOrEqual(600);
      expect(k.ult.charge).toBeGreaterThanOrEqual(0.8); expect(k.ult.charge).toBeLessThanOrEqual(1.25);
      for (const a of [...k.keys, k.ult]) if (a.energy) { expect(a.energy).toBeGreaterThanOrEqual(15); expect(a.energy).toBeLessThanOrEqual(45); }
    }
    expect([SUMMONER, SHAMAN, DRUID, PRIEST].map(k => k.stat.kind)).toEqual(["summon_power", "area", "max_hp", "healing"]);
    expect([SUMMONER, SHAMAN, DRUID, PRIEST].map(k => k.role)).toEqual(["support", "damage", "tank", "healer"]);
  });
  it("each has its own signature weapon type, five tiers, a grip and an island look", () => {
    for (const k of WARDEN_KITS) {
      const tiers = SYSTEM_WEAPONS.filter(w => w.subclass === k.key);
      expect(tiers.map(w => w.tier)).toEqual([1, 2, 3, 4, 5]);
      expect(new Set(tiers.map(w => w.type))).toEqual(new Set([k.signature.type]));
      expect(signatureGrant(k.key, 1)?.key).toBe(WEAPON[k.key]);
      for (const w of tiers) expect(WEAPONS[w.key]?.model).toBe(`/assets/game/weapons/${w.key}.glb`);
    }
    expect(gripFor("seal-gloves")).toBe("Fists");
    expect(["totem-staff", "living-staff", "sunstone-staff"].map(gripFor)).toEqual(["Staff", "Staff", "Staff"]);
    expect(WEAPONS["seal-gloves-1"].kind).toBe("melee");
    expect(WEAPONS["sunstone-staff-1"].kind).toBe("staff");
  });
  it("the family's seed migration carries the signature weapons exactly as the TS has them", () => {
    const dir = join(__dirname, "../../../supabase/migrations"), file = readdirSync(dir).find(f => f.endsWith("_classes_v2_warden_seed.sql"))!;
    expect(readFileSync(join(dir, file), "utf8")).toContain(signatureSeedSql(["summoner", "shaman", "druid", "priest"]));
  });
  it("its unique clips are in the verb library, authored for its signature weapon's grip; every ult has one", () => {
    for (const k of WARDEN_KITS) {
      expect(k.ult.clip && "unique" in k.ult.clip ? k.ult.clip.unique : null).toBe(`Ult_${k.name}`);
      for (const a of [...k.keys, k.ult]) if (a.clip && "unique" in a.clip) {
        const info = verbInfo(a.clip.unique);
        expect(info, a.clip.unique).toBeTruthy();
        expect(info!.grip).toBe(gripFor(k.signature.type));
      }
    }
  });
  it("every key, ult, passive and class has its icon on disk", () => {
    const pub = join(__dirname, "../../../public");
    for (const k of WARDEN_KITS) for (const icon of [k.look.icon, k.look.passive!, k.ult.icon!, ...k.keys.map(a => a.icon!)]) expect(existsSync(join(pub, icon)), icon).toBe(true);
  });
  it("the movement keys open at mastery 3; the Summoner's keys open by taming", () => {
    expect(kitAt(SHAMAN, 1).keys[4]).toBeNull(); expect(kitAt(SHAMAN, 3).keys[4]?.key).toBe("shaman.hop");
    expect(kitAt(DRUID, 2).keys[3]).toBeNull(); expect(kitAt(DRUID, 3).keys[3]?.key).toBe("druid.swing");
    expect(kitAt(PRIEST, 2).keys[4]).toBeNull(); expect(kitAt(PRIEST, 3).keys[4]?.key).toBe("priest.step");
    expect(SUMMONER.keys.map(a => a.tame ?? null)).toEqual([null, "owl", "toad", "serpent", "rabbits"]);
  });
  it("ranks and the stat direction reach the field effects (area grows zones, healing power grows their heal)", () => {
    const zone = DRUID.keys[2].effects[0];
    expect(zone.kind).toBe("zone");
    const up = upgraded(DRUID.keys[2], { label: "x", power: 1.2, radius: 1.25 }).effects[0];
    expect(up).toMatchObject({ kind: "zone", heal: 0.048, radius: 2.5 });
    const shaman20 = withMods(SHAMAN.keys[3], classMods(SHAMAN, 20)).effects[0];
    expect(shaman20).toMatchObject({ kind: "overcharge", radius: 2.6 * 1.25 });
    const priest20 = withMods(PRIEST.keys[3], classMods(PRIEST, 20)).effects[1];
    expect(priest20).toMatchObject({ kind: "zone", heal: 0.025 * 1.3 });
  });
});

describe("field primitives", () => {
  it("a zone pulses its damage on what's inside, slows it, and heals you while you stand in it; it ends", () => {
    const { rt, p, foe } = setup(DRUID, 1, [["stone-golem", 0, 2]]);
    pin(rt);
    p.hp = p.maxHp * 0.5;
    tap(rt, 4); frame(rt); // Wild Ground: round you, 4.5 u
    const z = field(rt).zones.find(x => x.key === "druid.wild")!;
    expect(z).toBeTruthy();
    frames(rt, 60);
    expect(hurt(foe)).toBeGreaterThan(0);
    expect(foe.status.slowFor).toBeGreaterThan(0);
    expect(p.hp).toBeGreaterThan(p.maxHp * 0.5);
    expect(inGrowth(rt, ME)).toBe(true);
    frames(rt, 8 * 30);
    expect(field(rt).zones.some(x => x.key === "druid.wild")).toBe(false);
  });
  it("a zone at the aim stays where it was cast; one per key (a new cast replaces it)", () => {
    const { rt } = setup(PRIEST, 1);
    pin(rt);
    rt.casting = null;
    classKey(rt, 3, true); frame(rt); // Sanctify (drawn)
    resolveCast(rt, ME, { accuracy: 80, coverage: 1, deviation: 0, order: 1, scribble: false, outcome: "normal", power: 0.92 }, never);
    const z = field(rt).zones.find(x => x.key === "priest.sanctum")!;
    expect([z.x, z.z]).toEqual([0, 4]);
    expect(field(rt).zones.filter(x => x.key === "priest.sanctum").length).toBe(1);
  });
  it("a thorn wall stops enemies walking through it and their shots, and cuts what touches it", () => {
    const { rt, foe } = setup(DRUID, 1, [["stone-golem", 0, 6]]);
    tap(rt, 1); frame(rt); // Thorn Wall across the aim (0, 4)
    const w = field(rt).walls[0];
    expect(w).toBeTruthy();
    expect(Math.abs(w.a.z - 4)).toBeLessThan(1e-6); expect(Math.abs(w.a.x - w.b.x)).toBeCloseTo(5);
    expect(walled(rt, 0, 4.2, 0.3)).toBe(true);
    expect(walled(rt, 0, 7, 0.3)).toBe(false);
    expect(wallStops(rt, { x: 0, z: 6 }, { x: 0, z: 3 })).toBe(true);
    for (let i = 0; i < 120; i++) frame(rt); // the golem walks at you: the wall holds it on the far side
    expect(foe.z).toBeGreaterThan(4);
    expect(hurt(foe)).toBeGreaterThan(0);
  });
  it("a channel fires again and again toward your current aim, and a dodge ends it", () => {
    const { rt, p, foe } = setup(PRIEST, 1, [["stone-golem", 0, 5]]);
    pin(rt);
    classKey(rt, 2, true); frame(rt);
    resolveCast(rt, ME, { accuracy: 80, coverage: 1, deviation: 0, order: 1, scribble: false, outcome: "normal", power: 0.92 }, never);
    expect(field(rt).channel).toBeTruthy();
    p.hp = p.maxHp * 0.5;
    frames(rt, 20);
    const once = hurt(foe);
    expect(once).toBeGreaterThan(0);
    expect(p.hp).toBeGreaterThan(p.maxHp * 0.5); // it heals you as it burns
    p.dodgeAge = 0; frame(rt);
    expect(field(rt).channel).toBeNull();
  });
  it("a pull drags the enemy at your aim to you and holds it; bosses don't budge", () => {
    const { rt, foe } = setup(SUMMONER, 1, [["shadow-fox", 0, 7]]);
    setTamed(rt, null);
    pin(rt);
    foe.status.hold = 0;
    tap(rt, 2); frame(rt); // the toad's entry: its tongue
    for (let i = 0; i < 20; i++) frame(rt);
    expect(Math.hypot(foe.x, foe.z)).toBeLessThan(3);
    const { rt: rt2, foe: boss } = setup(SUMMONER, 1, [["guardian-statue", 0, 7]]);
    setTamed(rt2, null);
    tap(rt2, 2); frames(rt2, 20);
    expect(boss.z).toBeCloseTo(7, 0);
  });
  it("root and fade: you can't move rooted; translucent while faded, solid again after", () => {
    const { rt } = setup(SUMMONER);
    setTamed(rt, null);
    tap(rt, 4); frame(rt); // Escape Rabbits
    expect(fadeOf(rt)).toBeLessThan(0.5);
    expect(field(rt).floods.length).toBe(1);
    expect(rt.buffs.some(b => b.stat === "speed")).toBe(true);
    frames(rt, 4 * 30);
    expect(fadeOf(rt)).toBe(1);
    const d = setup(DRUID).rt;
    d.v2!.meter = ULT.max; pressUlt(d); frames(d, 25);
    expect(rooted(d)).toBe(true);
  });
});

describe("Summoner", () => {
  it("beasts out at once: 2 at mastery 1, 3 at 10, 4 at 20 (the wolves are half a beast each)", () => {
    expect([1, 9, 10, 19, 20].map(beastCap)).toEqual([2, 2, 3, 3, 4]);
    const { rt } = setup(SUMMONER);
    setTamed(rt, null);
    pin(rt);
    tap(rt, 0); frames(rt, 40); tap(rt, 1); frames(rt, 40); tap(rt, 2); frames(rt, 40);
    const out = rt.units.filter(u => u.def.key.startsWith("beast-"));
    expect(out.reduce((n, u) => n + (u.def.cost ?? 1), 0)).toBeLessThanOrEqual(2);
    expect(out.some(u => u.def.key === "beast-toad")).toBe(true); // the newest stays, the oldest went back
  });
  it("keys toggle a beast in and out; it enters with its move (the wolves pounce, the serpent stuns)", () => {
    const { rt, p, foe } = setup(SUMMONER, 1, [["stone-golem", 0, 5]]);
    setTamed(rt, null);
    pin(rt);
    tap(rt, 0); frame(rt); frame(rt);
    expect(rt.units.filter(u => u.def.key === "beast-wolf").length).toBe(2);
    expect(hurt(foe)).toBeGreaterThan(0);
    frames(rt, 40);
    tap(rt, 0); frame(rt);
    expect(rt.units.some(u => u.def.key === "beast-wolf")).toBe(false);
    const fox: Enemy = { ...spawnEnemy("fox", ENEMIES["shadow-fox"], 1, 5), state: "chase" };
    rt.enemies.push(fox);
    p.aim = { x: 1, z: 5 };
    tap(rt, 3); frame(rt); frame(rt);
    expect(fox.status.hold).toBeGreaterThan(1.4); // the serpent's burst stuns (a normal enemy: the whole 1.6 s)
  });
  it("the owl's entry glides you forward; a killed beast goes on cooldown and Shadow Bond strengthens the rest", () => {
    const { rt, p } = setup(SUMMONER);
    setTamed(rt, null);
    pin(rt);
    tap(rt, 1); frame(rt); frame(rt);
    expect(p.kick?.speed).toBeGreaterThan(0);
    expect(p.kick?.up).toBeGreaterThan(0);
    frames(rt, 40);
    tap(rt, 0); frames(rt, 3);
    const owl = rt.units.find(u => u.def.key === "beast-owl");
    const wolf = rt.units.find(u => u.def.key === "beast-wolf")!;
    expect(owl).toBeTruthy();
    const before = wolf.power;
    owl!.hp = 0; frame(rt); frame(rt);
    expect(rt.v2!.cd["summoner.owl"]).toBeGreaterThan(BEAST.deathCd - 1);
    expect(wolf.power).toBeCloseTo(before * 1.3);
    expect(beastState(rt).dead["summoner.owl"]).toBeGreaterThan(0);
  });
  it("untamed beasts can't be called; the ritual tames the next in turn when its untamed form falls", () => {
    const { rt, p } = setup(SUMMONER, 1, []);
    setTamed(rt, []);
    frame(rt);
    expect(rt.v2!.keys.map(a => a?.key ?? null)).toEqual(["summoner.wolves", null, null, null, null]);
    ME = { x: RITUAL.x, z: RITUAL.z }; p.last = { ...ME };
    frame(rt);
    expect(beastState(rt).ritual?.beast).toBe("owl");
    frames(rt, 40);
    const form = rt.enemies.find(e => e.type.id === "shadow-owl")!;
    expect(form).toBeTruthy();
    expect(form.type.local).toBe(true);
    strike(rt, form, { power: 999, from: ME }, never);
    frame(rt);
    expect(beastState(rt).events.map(e => e.beast)).toEqual(["owl"]);
    expect(rt.v2!.keys[1]?.key).toBe("summoner.owl");
    expect(rt.killQueue.some(k => k.enemy === "shadow-owl")).toBe(false);
  });
  it("leaving the ward ends the ritual (the form sinks back) and it can start again", () => {
    const { rt, p } = setup(SUMMONER, 1, []);
    setTamed(rt, []);
    ME = { x: RITUAL.x, z: RITUAL.z }; p.last = { ...ME };
    frames(rt, 45);
    expect(rt.enemies.some(e => e.type.id === "shadow-owl")).toBe(true);
    ME = { x: RITUAL.x + RITUAL.ward + 1, z: RITUAL.z };
    frame(rt);
    expect(beastState(rt).ritual).toBeNull();
    expect(rt.enemies.some(e => e.type.id === "shadow-owl")).toBe(false);
  });
  it("Shadow Garden: every tamed beast rises past the cap, enemies sink, your dash warps; the risen go back after", () => {
    const { rt, p } = setup(SUMMONER, 1, [["stone-golem", 0, 3], ["stone-golem", 2, 3]]);
    setTamed(rt, null);
    pin(rt);
    tap(rt, 0); frames(rt, 3);
    rt.v2!.meter = ULT.max; pressUlt(rt); frames(rt, 20);
    const beasts = rt.units.filter(u => u.def.key.startsWith("beast-"));
    expect(new Set(beasts.map(u => u.def.key))).toEqual(new Set(["beast-wolf", "beast-owl", "beast-toad", "beast-serpent"]));
    expect(beastState(rt).garden).toBeTruthy();
    p.aim = { x: 3, z: 0 };
    expect(classMove(rt, ME, "dash", never)).toBe(true);
    expect(p.kick?.to).toEqual({ x: 3, z: 0 });
    frames(rt, 6 * 30);
    expect(beastState(rt).garden).toBeNull();
    expect(rt.units.filter(u => u.def.key.startsWith("beast-")).map(u => u.def.key)).toEqual(["beast-wolf", "beast-wolf"]);
  });
});

describe("Shaman", () => {
  it("totems are thrown: they plant at the aim when they land and stagger what they land on", () => {
    const { rt, foe } = setup(SHAMAN, 1, [["shadow-fox", 0, 4]]);
    pin(rt); foe.status.hold = 0;
    tap(rt, 0); frame(rt);
    expect(rt.units.some(u => u.def.key === "totem-storm")).toBe(false); // still in the air
    expect(field(rt).flights.length).toBe(1);
    frames(rt, 16);
    const t = rt.units.find(u => u.def.key === "totem-storm")!;
    expect([t.x, t.z]).toEqual([0, 4]);
    expect(hurt(foe)).toBeGreaterThan(0);
  });
  it("one of each totem, three at most; the hop's spirit post is outside the cap", () => {
    const { rt, p } = setup(SHAMAN, 3, []);
    for (const [slot, aim] of [[0, { x: -3, z: 3 }], [1, { x: 3, z: 3 }], [2, { x: 0, z: 6 }]] as const) { p.aim = { ...aim }; tap(rt, slot); frames(rt, 200); }
    expect(rt.units.filter(u => u.def.kind === "totem").length).toBe(3);
    p.move = { mode: "air", speed: 8, sinceDash: 9, vx: 0, vz: 8 };
    tap(rt, 4); frame(rt);
    expect(rt.units.filter(u => u.def.kind === "totem").length).toBe(4);
    expect(UNITS["totem-spirit"].uncapped).toBe(true);
    expect(CAPS.totems).toBe(3);
  });
  it("links: totems in range draw lightning that cuts what crosses it; three enclose a pack inside their triangle", () => {
    const a = { x: 0, z: 0 }, b = { x: 6, z: 0 }, c = { x: 3, z: 5 };
    expect(hull([a, b, c, { x: 3, z: 1 }]).length).toBe(3);
    const { rt, p, foes } = setup(SHAMAN, 1, [["stone-golem", 3, 2], ["stone-golem", 3, -4], ["stone-golem", 1.5, 0.2]]);
    pin(rt);
    for (const [slot, aim] of [[0, a], [1, b], [2, c]] as const) { p.aim = { ...aim }; tap(rt, slot); frames(rt, 240); }
    const totems = rt.units.filter(u => u.def.kind === "totem");
    const { links } = linksOf(totems, TOTEM.link);
    expect(links.length).toBe(3);
    expect(enclosed(rt.enemies, links).map(e => e.id).sort()).toEqual(["foe0", "foe2"]);
    expect(totemState(rt).enclosed).toBe(2);
    expect(hurt(foes[2])).toBeGreaterThan(hurt(foes[1])); // the beam along the bottom edge cuts it
  });
  it("Overcharge unloads every linked totem, harder for each enemy enclosed", () => {
    // Two foes it hits either way (one on the bottom link, one in the first totem's burst), inside the triangle or just outside it, plus a third inside.
    const run = (inside: boolean) => {
      const z = inside ? 1 : -1;
      const { rt, p, foes } = setup(SHAMAN, 1, [["stone-golem", 3, 1.2 * z], ["stone-golem", 1.5, 0.8 * z], ...(inside ? [["stone-golem", 3, 2.5] as [string, number, number]] : [])]);
      pin(rt);
      for (const [slot, aim] of [[0, { x: 0, z: 0 }], [1, { x: 6, z: 0 }], [2, { x: 3, z: 5 }]] as const) { p.aim = { ...aim }; tap(rt, slot); frames(rt, 200); }
      for (const u of rt.units) u.cd = 99; // the totems' own zaps and bursts and the beams' cuts wait: only Overcharge lands this frame
      totemState(rt).beamT = 99;
      [[3, 1.2 * z], [1.5, 0.8 * z], [3, 2.5]].forEach(([x, zz], i) => { const e = foes[i]; if (e) Object.assign(e, { x, z: zz, kx: 0, kz: 0 }); }); // back where they stood (the landings knocked them)
      const before = hurt(foes[0]); // on the bottom link and in both near bursts, inside or out: only the multiplier differs
      p.energy = 100; tap(rt, 3); frame(rt);
      return { dealt: hurt(foes[0]) - before, enclosed: totemState(rt).enclosed };
    };
    const a = run(true), b = run(false);
    expect([a.enclosed, b.enclosed]).toEqual([3, 0]);
    expect(a.dealt / b.dealt).toBeGreaterThan(1.45); // ×1.54 before the golem's flat armour
  });
  it("Spirit Awakening plants the missing totems and raises their spirits; their hits are the ult's", () => {
    const { rt } = setup(SHAMAN, 1, [["stone-golem", 0, 5], ["stone-golem", 1, 6]]);
    pin(rt);
    rt.v2!.meter = ULT.max; pressUlt(rt); frames(rt, 20);
    expect(rt.units.filter(u => u.def.kind === "totem").map(u => u.def.key).sort()).toEqual(["totem-earth", "totem-fire", "totem-storm"]);
    expect(rt.units.filter(u => u.def.key.startsWith("spirit-")).length).toBe(3);
    const ult = rt.tally.ult;
    frames(rt, 60);
    expect(rt.tally.ult).toBeGreaterThan(ult);
  });
});

describe("Druid", () => {
  it("every heal is a share of max HP, and max HP is the stat mastery raises", () => {
    const one = setup(DRUID, 1).p.maxHp, twenty = setup(DRUID, 20).p.maxHp;
    expect(twenty / one).toBeCloseTo(1.3, 1);
    const { rt, p } = setup(DRUID, 1);
    p.hp = 1;
    tap(rt, 2); frame(rt); frames(rt, 30); // Healing Bloom: 4% a second, and Overgrowth doubled inside it
    expect(p.hp - 1).toBeGreaterThan(p.maxHp * (0.04 + 0.016) * 0.9);
  });
  it("Overgrowth regenerates, twice as fast in your own growth", () => {
    const { rt, p } = setup(DRUID, 1, []);
    p.hp = p.maxHp * 0.5; frames(rt, 30);
    const plain = p.hp - p.maxHp * 0.5;
    expect(plain).toBeCloseTo(p.maxHp * 0.008, 0);
    const g = setup(DRUID, 1, []);
    g.p.hp = g.p.maxHp * 0.5;
    tap(g.rt, 4); frame(g.rt); // Wild Ground (growth; it also heals 1%/s)
    g.p.hp = g.p.maxHp * 0.5; frames(g.rt, 30);
    expect(g.p.hp - g.p.maxHp * 0.5).toBeGreaterThan(plain * 2);
  });
  it("Vine Swing: holding swings you toward the anchor; letting go flies you on", () => {
    const { rt, p } = setup(DRUID, 3, []);
    classKey(rt, 3, true); frame(rt);
    expect(field(rt).tether).toBeTruthy();
    const kick = () => rt.player.kick; // read fresh (the frame writes it)
    p.kick = null; frame(rt);
    expect(kick()?.speed).toBeGreaterThan(0);
    classKey(rt, 3, false); frame(rt);
    expect(field(rt).tether).toBeNull();
    expect(kick()?.up).toBeGreaterThan(0.8);
  });
  it("World Tree: rooted, very fast regeneration and lifesteal on everything hostile round you; near-unkillable", () => {
    const { rt, p, foes } = setup(DRUID, 1, [["stone-golem", 0, 3], ["animated-book", 3, 0], ["animated-book", -3, 0]]);
    rt.v2!.meter = ULT.max; pressUlt(rt); frames(rt, 25);
    expect(rooted(rt)).toBe(true);
    pin(rt, 99999);
    for (let i = 0; i < 6 * 30; i++) { if (i % 15 === 0) hurtPlayer(rt, p.maxHp * 0.08, foes[0], ME, 0, never); frame(rt); } // 16% of max HP a second aimed at you
    expect(p.alive).toBe(true);
    expect(p.hp / p.maxHp).toBeGreaterThan(0.6);
    expect(foes.every(e => hurt(e) > 0)).toBe(true);
  });
});

describe("Priest", () => {
  const score = (accuracy: number) => ({ accuracy, coverage: 1, deviation: 0, order: 1, scribble: false, outcome: (accuracy < 50 ? "fail" : accuracy >= 95 ? "enhanced" : "normal") as "fail" | "normal" | "enhanced", power: 1 });
  it("every skill is drawn; the drawing scales it 60% (rough) to 150% (clean), heals included", () => {
    const heal = (acc: number) => {
      const { rt, p } = setup(PRIEST, 1, []);
      p.hp = 1;
      classKey(rt, 0, true); frame(rt);
      expect(rt.casting?.rune).toBe("cross");
      resolveCast(rt, ME, score(acc), never);
      return p.hp - 1;
    };
    const rough = heal(50), clean = heal(96);
    expect(clean / rough).toBeCloseTo(1.5 / 0.6, 1);
    expect(heal(40)).toBeLessThan(1); // under 50% fizzles (a tick of Blessed's regen aside)
    expect(PRIEST.keys.map(a => a.input?.kind === "drawn" ? a.input.shape : null)).toEqual(["cross", "circle", "line", "triangle", "chevron"]);
  });
  it("Lightbolt: a basic hit hurts the enemy and heals you; past full, healing becomes a shield", () => {
    const { rt, p, foe } = setup(PRIEST, 1, [["stone-golem", 0, 3]]);
    pin(rt);
    p.hp = p.maxHp * 0.5;
    attack(rt, ME, never);
    frames(rt, 12);
    expect(hurt(foe)).toBeGreaterThan(0);
    expect(p.hp).toBeGreaterThan(p.maxHp * 0.5);
    p.hp = p.maxHp; p.shield = 0;
    classKey(rt, 0, true); frame(rt);
    resolveCast(rt, ME, score(96), never);
    expect(p.shield).toBeGreaterThan(0);
  });
  it("Divine Descent is drawn: a clean sigil heals you to full and burns; a fizzle or a cancel keeps 75% of the meter", () => {
    const { rt, p, foe } = setup(PRIEST, 1, [["stone-golem", 0, 4], ["stone-golem", 1, 4]]);
    pin(rt);
    rt.v2!.meter = ULT.max; pressUlt(rt); frame(rt);
    expect(rt.casting?.ult).toBe(true);
    expect(rt.casting?.rune).toBe("wings");
    expect(rt.v2!.meter).toBe(ULT.max);
    resolveCast(rt, ME, score(40), never);
    expect(rt.v2!.meter).toBe(75);
    rt.v2!.meter = ULT.max; pressUlt(rt); frame(rt);
    cancelCast(rt);
    expect(rt.v2!.meter).toBe(75);
    rt.v2!.meter = ULT.max; pressUlt(rt); frame(rt);
    p.hp = 10;
    resolveCast(rt, ME, score(97), never);
    expect(rt.v2!.meter).toBe(0);
    frames(rt, 20);
    expect(p.hp).toBe(p.maxHp);
    expect(hurt(foe)).toBeGreaterThan(0);
  });
});
