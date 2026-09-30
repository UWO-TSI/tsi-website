import { describe, expect, it } from "vitest";
import { ENEMIES, WEAPONS } from "./data";
import { summonWisps } from "./actions";
import { hitAmount } from "./abilities";
import { createRuntime } from "./runtime";
import { BOSS, beamLands, damageEnemy, spawnEnemy, stepEnemy, strikeLands, type Enemy, type EnemyEvent } from "./sim";
import { glow, marker, partPose } from "./telegraph";
import { damage, WEAPONS as SYSTEM_WEAPONS } from "@/lib/combat/weapons";
import { ZERO_STATS } from "@/lib/combat/progression";

const BOSS_TYPE = ENEMIES["guardian-statue"];
/** Step the enemy; each event is recorded with the move and state it fired in. */
const fight = (e: Enemy, p: { x: number; z: number }, seconds: number, dt = 1 / 60) => {
  const out: { kind: EnemyEvent["kind"]; shape: string; t: number }[] = [];
  for (let t = 0; t < seconds; t += dt) { const ev = stepEnemy(e, { ...p, safe: false, alive: true }, dt); if (ev) out.push({ kind: ev.kind, shape: e.move.shape, t: e.t }); }
  return out;
};
/** Shapes of the moves the boss throws, in order (a beam counts once, when it starts). */
const thrown = (events: ReturnType<typeof fight>) => events.filter(ev => ev.kind === "strike" || ev.kind === "summon" || (ev.kind === "beam" && ev.t === 0)).map(ev => ev.shape);
const moves = (e: Enemy, p: { x: number; z: number }, seconds: number) => thrown(fight(e, p, seconds));

describe("guardian statue: three patterns and phase transitions", () => {
  it("above half health: slam on a ring marker where you stood, slam, then the beam", () => {
    const b = spawnEnemy("b", BOSS_TYPE, 0, 0);
    expect(moves(b, { x: 0, z: 5 }, 12).slice(0, 3)).toEqual(["smash", "smash", "beam"]);
    // The smash hits the ring it aimed at, not the boss's own feet.
    const s = spawnEnemy("s", BOSS_TYPE, 0, 0);
    fight(s, { x: 0, z: 6 }, 0.2);
    expect(s.state).toBe("windup");
    expect(s.move.shape).toBe("smash");
    expect(marker(s)).toMatchObject({ x: 0, z: 6, r: s.move.range, arc: Math.PI * 2 });
    expect(strikeLands(s, { x: 0, z: 6.5 })).toBe(true);
    expect(strikeLands(s, { x: 0, z: 1 })).toBe(false);
  });
  it("the beam sweeps once over you, then leaves it staggered for bonus damage", () => {
    const b = spawnEnemy("b", BOSS_TYPE, 0, 0);
    b.state = "chase"; b.move = BOSS_TYPE.attacks.find(m => m.shape === "beam")!;
    const me = { x: 0, z: 5 };
    let hits = 0, sawActive = false;
    for (let t = 0; t < 3.5; t += 1 / 60) {
      const ev = stepEnemy(b, { ...me, safe: false, alive: true }, 1 / 60);
      if ((b.state as Enemy["state"]) === "active") sawActive = true;
      if (ev?.kind === "beam" && beamLands(b, me)) hits++;
    }
    expect(sawActive).toBe(true);
    expect(hits).toBe(1);
    expect(b.state).toBe("recover");
    expect(b.move.stagger).toBe(true);
    const rt = createRuntime(); rt.player.weapon = "sword-iron";
    const normal = spawnEnemy("n", BOSS_TYPE, 0, 1);
    expect(hitAmount(rt, b, { power: 1, from: b }, () => 0.5).amount).toBeGreaterThan(hitAmount(rt, normal, { power: 1, from: normal }, () => 0.5).amount);
    expect(glow(b, 0)).toBeLessThan(glow(normal, 0)); // the light goes out: the opening
  });
  it("below half it calls two rune wisps (topped up, never more), and enrages at a fifth", () => {
    const rt = createRuntime();
    const b = spawnEnemy("b", BOSS_TYPE, 0, 0);
    rt.enemies = [b];
    fight(b, { x: 0, z: 5 }, 0.1);
    damageEnemy(b, Math.ceil(BOSS_TYPE.hp * 0.55), { x: 0, z: 5 }, 0);
    const events = fight(b, { x: 0, z: 5 }, 6);
    expect(events[0].kind).toBe("phase");
    expect(b.phase).toBe(2);
    expect(thrown(events).slice(0, 2)).toEqual(["smash", "summon"]); // the slam already in the air lands, then it calls for help
    summonWisps(rt, b); summonWisps(rt, b);
    expect(rt.enemies.filter(e => e.summoned && e.type.id === "rune-wisp")).toHaveLength(BOSS.summons);
    const smash = BOSS_TYPE.attacks.find(m => m.shape === "smash")!;
    damageEnemy(b, Math.ceil(BOSS_TYPE.hp * 0.3), { x: 0, z: 5 }, 0);
    fight(b, { x: 0, z: 5 }, 1 / 60);
    expect(b.phase).toBe(3);
    const enraged = [0, 1, 2, 3, 4, 5].map(() => { b.state = "recover"; b.t = 99; stepEnemy(b, { x: 0, z: 5, safe: false, alive: true }, 1 / 60); return b.move; }).find(m => m.shape === "smash")!;
    expect(enraged.windup).toBeLessThan(smash.windup);
    expect(enraged.damage).toBeGreaterThan(smash.damage);
  });
  it("resets to phase one and full health when you leave (row 8)", () => {
    const b = spawnEnemy("b", BOSS_TYPE, 0, 0);
    fight(b, { x: 0, z: 5 }, 0.1);
    damageEnemy(b, Math.ceil(BOSS_TYPE.hp * 0.9), { x: 0, z: 5 }, 0);
    fight(b, { x: 0, z: 5 }, 0.1);
    expect(b.phase).toBe(3);
    for (let t = 0; t < 10; t += 1 / 60) stepEnemy(b, { x: 0, z: 5, safe: true, alive: true }, 1 / 60);
    expect(b).toMatchObject({ state: "idle", hp: BOSS_TYPE.hp, phase: 1 });
  });
  it("is a wall for starter weapons and beatable at level 10 with tier 2+ (armor + defense)", () => {
    // Level 10, all 27 points in the weapon's stat; mean hit with 10% crits; seconds to kill at 50% uptime.
    const ttk = (key: string) => {
      const w = SYSTEM_WEAPONS.find(x => x.key === key)!, stats = { ...ZERO_STATS, [w.scaling[0]]: 27 };
      const hit = (crit: boolean) => damage({ weapon: w, durability: 99, stats, level: 10, enemyDefense: BOSS_TYPE.defense, enemyArmor: BOSS_TYPE.armor, crit });
      return BOSS_TYPE.hp / ((0.9 * hit(false) + 0.1 * hit(true)) / WEAPONS[key].cooldown) / 0.5;
    };
    const starters = ["sword-driftwood", "bow-willow", "staff-oak"].map(ttk), geared = ["sword-iron", "revolver-brass", "staff-rune"].map(ttk);
    expect(Math.min(...starters)).toBeGreaterThan(2 * Math.max(...geared.slice(0, 1)));
    expect(Math.max(...geared)).toBeLessThan(5 * 60);
    expect(Math.min(...starters)).toBeGreaterThan(5 * 60);
  });
});

describe("telegraph helper (one for every enemy)", () => {
  const at = (id: string, state: Enemy["state"], t: number) => ({ ...spawnEnemy("x", ENEMIES[id], 0, 0), state, t });
  it("ramps the glow through the windup", () => {
    const fox = ENEMIES["shadow-fox"], w = fox.attacks[0].windup;
    expect(glow(at("shadow-fox", "windup", w * 0.9), 0)).toBeGreaterThan(glow(at("shadow-fox", "windup", w * 0.1), 0));
    expect(glow(at("shadow-fox", "windup", w * 0.9), 0)).toBeGreaterThan(glow(at("shadow-fox", "chase", 0), 0) * 3);
  });
  it("poses the named parts per attack: claws open for a sweep, arms rise for a slam, the lid opens, the cap swells", () => {
    const crab = at("thorn-crab", "windup", 0.8);
    expect(partPose("claw_l", crab, 0)!.ry).toBeGreaterThan(0.5);
    expect(partPose("claw_r", crab, 0)!.ry).toBeLessThan(-0.5);
    expect(partPose("arm_l", at("stone-golem", "windup", 1), 0)!.rx).toBeLessThan(-2);
    expect(partPose("lid", at("animated-book", "windup", 0.6), 0)!.rx).toBeLessThan(-0.8);
    expect(partPose("cap", at("mushroom-beast", "windup", 0.9), 0)!.sy).toBeGreaterThan(1.2);
    expect(partPose("body", at("shadow-fox", "recover", 0.01), 0)!.dz).toBeGreaterThan(0.08); // the lunge
    expect(partPose("glow_eyes", crab, 0)).toBeNull(); // glow parts ride their parent and only change brightness
    const running = at("shadow-fox", "chase", 0);
    expect(partPose("leg_fl", running, 0.1)!.rx).toBeCloseTo(-partPose("leg_fr", running, 0.1)!.rx); // a trot: pairs opposite
  });
  it("draws a marker for every attack shape while it winds up, and the beam line while it sweeps", () => {
    for (const id of Object.keys(ENEMIES)) for (const move of ENEMIES[id].attacks) {
      expect(marker({ ...at(id, "windup", move.windup / 2), move })).not.toBeNull();
    }
    const b = { ...at("guardian-statue", "active", 0.5), move: BOSS_TYPE.attacks.find(m => m.shape === "beam")! };
    expect(marker(b)).toMatchObject({ r: b.move.range, fill: 1 });
    expect(marker(at("shadow-fox", "chase", 0))).toBeNull();
  });
});
