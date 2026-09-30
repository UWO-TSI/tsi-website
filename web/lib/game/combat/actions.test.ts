import { describe, expect, it } from "vitest";
import { ENEMIES, MISSIONS } from "./data";
import { attack, combatPush, combatTuning, dashDodge, hurtPlayer, regenEnergy, resolveCast, startDodge, triggerAbility, weaponDamage } from "./actions";
import { stepCombat } from "./encounter";
import { NO_INPUT, STEP, createMoveState, stepMove, type MoveWorld } from "@/lib/game/movement/sim";
import { startMission } from "./missions";
import { createRuntime, ENERGY } from "./runtime";
import { DODGE, spawnEnemy } from "./sim";
import { equipKit } from "./abilities";
import { subclassByKey } from "@/lib/combat/kits";

/** An Elementalist: slot 1 is Elemental Burst, drawn with the easy spark rune. */
const caster = () => { const rt = createRuntime(); equipKit(rt, subclassByKey("elementalist")); return rt; };

const fixed = () => 0.5; // no crits

describe("player actions", () => {
  it("a sword swing hits what's in front, queues kill XP and counts toward a hunt", () => {
    const rt = createRuntime();
    rt.player.safe = false; rt.player.facing = 0;
    rt.mission = startMission(MISSIONS.find(m => m.id === "hunt-foxes")!);
    rt.enemies = [spawnEnemy("a", { ...ENEMIES["shadow-fox"], hp: 5 }, 0, 1.2), spawnEnemy("b", ENEMIES["shadow-fox"], 0, -1.2)];
    expect(attack(rt, { x: 0, z: 0 }, fixed)).toBe(true);
    expect(rt.enemies[0].state).toBe("dead");
    expect(rt.enemies[1].hp).toBe(ENEMIES["shadow-fox"].hp);
    expect(rt.mission.progress.counter).toBe(1);
    expect(rt.killQueue).toMatchObject([{ enemy: "shadow-fox" }]);
    expect(rt.player.hits["sword-driftwood"]).toBe(1);
    expect(attack(rt, { x: 0, z: 0 }, fixed)).toBe(false); // cooldown
  });
  it("uses the systems damage rule: defense reduces, a broken weapon halves", () => {
    const rt = createRuntime();
    const fox = spawnEnemy("f", ENEMIES["shadow-fox"], 0, 1), crab = spawnEnemy("c", ENEMIES["thorn-crab"], 0, 1);
    const whole = weaponDamage(rt, fox, fixed).amount;
    expect(weaponDamage(rt, crab, fixed).amount).toBeLessThan(whole);
    rt.player.durability["sword-driftwood"] = 0;
    expect(weaponDamage(rt, fox, fixed).amount).toBe(Math.max(1, Math.round(whole / 2)));
  });
  it("bow and staff fire projectiles; the summoning charm keeps at most two wisps", () => {
    const rt = createRuntime();
    rt.player.weapon = "bow-willow"; attack(rt, { x: 0, z: 0 });
    expect(rt.projectiles[0]).toMatchObject({ kind: "arrow", from: "player" });
    rt.player.weapon = "tome-spirits";
    for (let i = 0; i < 3; i++) { rt.player.attackCd = 0; attack(rt, { x: 0, z: 0 }); }
    expect(rt.units.filter(u => u.source === "weapon")).toHaveLength(2);
  });
  it("dodging grants i-frames, cancels casting and has a cooldown", () => {
    const rt = caster();
    rt.player.safe = false;
    triggerAbility(rt, "slot1");
    expect(rt.casting).not.toBeNull();
    expect(startDodge(rt, { x: 1, z: 0 })).toBe(true);
    expect(rt.casting).toBeNull();
    expect(rt.cooldowns.slot1).toBe(1.5); // a cancel costs the short recovery, not the cooldown (row C3)
    rt.player.dodgeAge = 0.1;
    expect(hurtPlayer(rt, 20, { x: 1, z: 0 }, { x: 0, z: 0 })).toBe(0);
    rt.player.dodgeAge = DODGE.iframeEnd + 0.05;
    expect(hurtPlayer(rt, 20, { x: 1, z: 0 }, { x: 0, z: 0 })).toBe(20);
    expect(startDodge(rt, { x: 1, z: 0 })).toBe(false);
  });
  it("the safe zone blocks hostile damage", () => {
    const rt = createRuntime();
    rt.player.safe = true;
    expect(hurtPlayer(rt, 50, { x: 1, z: 0 }, { x: 0, z: 0 })).toBe(0);
    rt.player.safe = false;
    hurtPlayer(rt, 500, { x: 1, z: 0 }, { x: 0, z: 0 });
    expect(rt.player.alive).toBe(false);
  });
  it("runes cost energy; energy regenerates after a second, never while tracing", () => {
    const rt = caster();
    expect(triggerAbility(rt, "slot1")).toBe(true);
    const after = rt.player.energy;
    expect(after).toBe(ENERGY.max - Math.ceil(35 * 0.25)); // a quarter of Elemental Burst's 35 to start
    regenEnergy(rt, 2);
    expect(rt.player.energy).toBe(after); // still tracing
    rt.casting = null; rt.player.sinceSpend = 0;
    regenEnergy(rt, 0.5);
    expect(rt.player.energy).toBe(after);
    regenEnergy(rt, 1);
    expect(rt.player.energy).toBeGreaterThan(after);
    rt.player.energy = 5;
    rt.cooldowns.slot1 = 0;
    expect(triggerAbility(rt, "slot1")).toBe(false);
  });
  it("incantation potency scales the effect; a fizzle does nothing", () => {
    const run = (outcome: "fail" | "normal" | "enhanced", power: number) => {
      const rt = caster();
      rt.enemies = [spawnEnemy("t", ENEMIES["stone-golem"], 3, 0)];
      rt.player.aim = { x: 3, z: 0 };
      triggerAbility(rt, "slot1");
      resolveCast(rt, { x: 0, z: 0 }, { accuracy: 90, coverage: 1, deviation: 0, order: 1, scribble: false, outcome, power }, fixed);
      return ENEMIES["stone-golem"].hp - rt.enemies[0].hp;
    };
    expect(run("fail", 0)).toBe(0);
    expect(run("enhanced", 1.5)).toBeGreaterThan(run("normal", 0.8));
  });
});

describe("the ruins dodge on the movement kit (specs/movement.md)", () => {
  const flat: MoveWorld = { top: () => 0, wet: () => false };
  /** Q at `presses` (seconds), as PlayerAvatar runs it: the kit's step, a dash event starts the dodge, then the encounter tick. */
  const run = (seconds: number, presses: number[], each?: (time: number, rt: ReturnType<typeof createRuntime>, z: number) => void) => {
    const rt = createRuntime(), t = combatTuning(1);
    rt.player.safe = false;
    let s = createMoveState(0, 0, flat);
    const dashes: number[] = [];
    for (let i = 0; i < Math.round(seconds / STEP); i++) {
      const time = i * STEP;
      s = stepMove(s, { ...NO_INPUT, z: 1, dashPressed: presses.some(p => Math.abs(p - time) < STEP / 2), push: combatPush(rt.player) }, STEP, flat, t);
      if (s.events.some(e => e.kind === "dash")) { dashes.push(time); dashDodge(rt, { x: s.dashX, z: s.dashZ }); }
      stepCombat(rt, { x: s.x, z: s.z }, STEP);
      each?.(time + STEP, rt, s.z);
    }
    return { rt, s, dashes };
  };
  it("is Q's dash with the roll's reach and time, invulnerable through today's i-frame window", () => {
    const hits: [number, number][] = [];
    let atEnd = 0;
    run(0.6, [0], (time, rt, z) => {
      if (Math.abs(time - DODGE.duration) < STEP / 2) atEnd = z;
      if ([0.1, 0.25, 0.45].some(t => Math.abs(time - t) < STEP / 2)) hits.push([time, hurtPlayer(rt, 10, { x: 0, z: 5 }, { x: 0, z })]);
    });
    // The roll moved 14 u/s easing to 40% over its 0.34 s: 3.33u, plus the walk it started from.
    expect(atEnd).toBeGreaterThan(3.2);
    expect(atEnd).toBeLessThan(4);
    expect(hits.map(([, lost]) => lost > 0)).toEqual([false, false, true]);
  });
  it("waits out the dodge's cooldown, and the roll's own impulse never moves you twice", () => {
    const { dashes } = run(2, [0, 0.5, DODGE.duration + DODGE.cooldown + 0.02]);
    expect(dashes).toHaveLength(2);
    expect(dashes[1]).toBeCloseTo(DODGE.duration + DODGE.cooldown + 0.02, 2);
    const rt = createRuntime();
    rt.player.safe = false;
    startDodge(rt, { x: 0, z: 1 });
    stepCombat(rt, { x: 0, z: 0 }, 0.05);
    expect(rt.player.impulse.z).toBeGreaterThan(0);
    expect(combatPush(rt.player)).toBeUndefined();
    rt.player.dodgeAge = null; rt.player.dash = { x: 1, z: 0, speed: 20, left: 0.2, iframes: false, then: null };
    stepCombat(rt, { x: 0, z: 0 }, 0.05);
    expect(combatPush(rt.player)).toEqual({ x: 20, z: 0 });
  });
  it("walks and sprints at the combat speed stat", () => {
    expect(combatTuning(1.2).walkSpeed).toBeCloseTo(7.4 * 1.2);
    expect(combatTuning(1.2).sprintSpeed).toBeCloseTo(12 * 1.2);
    expect(combatTuning(1).dashCooldown).toBeCloseTo(DODGE.duration + DODGE.cooldown);
  });
});
