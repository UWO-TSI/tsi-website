import { describe, expect, it } from "vitest";
import { ENEMIES, MISSIONS } from "./data";
import { BUFFER, attack, combatPush, combatTuning, createInputs, dashDodge, hurtPlayer, regenEnergy, runInputs, startDodge, triggerAbility } from "./actions";
import { hitAmount, resolveCast } from "./abilities";

/** One hit from the equipped weapon (systems damage formula), as `attack` lands it. */
const weaponDamage = (rt: Parameters<typeof hitAmount>[0], e: Parameters<typeof hitAmount>[1], random: () => number) => hitAmount(rt, e, { power: 1, from: e }, random);
import { stepCombat } from "./encounter";
import { NO_INPUT, STEP, createMoveState, stepMove, type MoveWorld } from "@/lib/game/movement/sim";
import { startMission } from "./missions";
import { createRuntime, ENERGY } from "./runtime";
import { DODGE, STUN, damageEnemy, spawnEnemy, stepEnemy } from "./sim";
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

describe("input buffering (combat polish 1)", () => {
  const me = { x: 0, z: 0 }, frame = 1 / 60;
  it("a click is a queued attack: a tap that goes down and up between two frames still swings", () => {
    const rt = createRuntime(), q = createInputs();
    rt.player.safe = false;
    q.held = true; q.attack = BUFFER; q.held = false; // pointerdown, pointerup, then the frame
    runInputs(rt, q, me, frame);
    expect(rt.player.attackCd).toBeGreaterThan(0);
    expect(q.attack).toBe(0); // consumed once
  });
  it("a click in the last 150 ms of the cooldown swings the moment it is back; an earlier one is dropped", () => {
    const rt = createRuntime(), q = createInputs();
    rt.player.attackCd = 0.1; q.attack = BUFFER;
    let swung = -1;
    for (let t = 0; t < 0.3; t += frame) { const before = rt.player.attackCd; runInputs(rt, q, me, frame); stepCombat(rt, me, frame); if (swung < 0 && rt.player.attackCd > before) swung = t; }
    expect(swung).toBeGreaterThan(0.09);
    expect(swung).toBeLessThan(0.13);
    const late = createRuntime(), r = createInputs();
    late.player.attackCd = 0.3; r.attack = BUFFER;
    for (let t = 0; t < 0.5; t += frame) { runInputs(late, r, me, frame); stepCombat(late, me, frame); }
    expect(late.player.attackCd).toBe(0); // never swung
  });
  it("a click during the dodge lands as the dodge ends", () => {
    const rt = createRuntime(), q = createInputs();
    startDodge(rt, { x: 1, z: 0 });
    rt.player.dodgeAge = DODGE.duration - 0.05; q.attack = BUFFER;
    for (let t = 0; t < 0.2; t += frame) { runInputs(rt, q, me, frame); stepCombat(rt, me, frame); }
    expect(rt.player.swing).toBeGreaterThan(0);
  });
  it("an ability pressed in the last 150 ms of its cooldown fires when it is ready", () => {
    const rt = caster(), q = createInputs();
    rt.cooldowns.slot1 = 0.1;
    q.keys.push({ id: "slot1", left: BUFFER });
    for (let t = 0; t < 0.2 && !rt.casting; t += frame) { runInputs(rt, q, me, frame); stepCombat(rt, me, frame); }
    expect(rt.casting).not.toBeNull();
    expect(rt.denied.slot1).toBe(0);
  });
  it("an ability pressed with more cooldown than that pulses its slot and never fires later", () => {
    const rt = caster(), q = createInputs();
    rt.cooldowns.slot1 = 0.6;
    q.keys.push({ id: "slot1", left: BUFFER });
    expect(runInputs(rt, q, me, frame)).toBe(true); // refused: the scene publishes the pulse at once
    expect(rt.denied.slot1).toBe(1);
    for (let t = 0; t < 1; t += frame) { runInputs(rt, q, me, frame); stepCombat(rt, me, frame); }
    expect(rt.casting).toBeNull();
  });
});

describe("combat cues (combat polish 3): the encounter says what happened, the scene plays it", () => {
  it("a killing swing cues the swing, the hit and the defeat; a hit taken cues the hurt", () => {
    const rt = createRuntime();
    rt.player.safe = false; rt.player.facing = 0;
    rt.enemies = [spawnEnemy("a", { ...ENEMIES["shadow-fox"], hp: 5 }, 0, 1.2)];
    attack(rt, { x: 0, z: 0 }, fixed);
    expect(rt.cues.map(c => [c.kind, c.melee])).toEqual([["swing", false], ["hit", true], ["defeat", false]]);
    rt.cues.length = 0;
    hurtPlayer(rt, 10, { x: 0, z: 1 }, { x: 0, z: 0 });
    expect(rt.cues.map(c => c.kind)).toEqual(["hurt"]);
  });
  it("an enemy's windup and the guardian's stagger window cue once each", () => {
    const rt = createRuntime();
    rt.player.safe = false;
    const boss = spawnEnemy("b", ENEMIES["guardian-statue"], 0, 0);
    boss.state = "chase"; boss.move = ENEMIES["guardian-statue"].attacks.find(m => m.shape === "beam")!;
    rt.enemies = [boss];
    const kinds: string[] = [];
    for (let t = 0; t < 3.5; t += 1 / 60) { stepCombat(rt, { x: 0, z: 5 }, 1 / 60); kinds.push(...rt.cues.map(c => c.kind)); rt.cues.length = 0; }
    expect(kinds.filter(k => k === "windup")).toHaveLength(1);
    expect(kinds.filter(k => k === "stagger")).toHaveLength(1);
  });
});

describe("impact (combat polish 4)", () => {
  /** How far a hit with this knockback pushes you over its flinch (the encounter's impulse, integrated). */
  const pushed = (knock: number) => {
    const rt = createRuntime(), me = { x: 0, z: 0 };
    rt.player.safe = false;
    hurtPlayer(rt, 5, { x: 0, z: -1 }, me, knock);
    let z = 0;
    for (let t = 0; t < 0.4; t += 1 / 120) { stepCombat(rt, me, 1 / 120); z += rt.player.impulse.z / 120; }
    return z;
  };
  it("pushes you by the attack's own knockback: a golem's slam further than a spit", () => {
    const golem = ENEMIES["stone-golem"].attacks[0].knockback, spit = ENEMIES["mushroom-beast"].attacks[0].knockback;
    expect(pushed(golem) / golem).toBeGreaterThan(0.2); // about 0.225 u per point
    expect(pushed(golem) / golem).toBeLessThan(0.24);
    expect(pushed(golem)).toBeGreaterThan(pushed(spit) * 2);
  });
  it("a hit staggers an enemy's chase for a beat (elites half), the boss not at all", () => {
    const fox = spawnEnemy("f", ENEMIES["shadow-fox"], 0, 0), boss = spawnEnemy("b", ENEMIES["guardian-statue"], 0, 0), golem = spawnEnemy("g", ENEMIES["stone-golem"], 0, 0);
    fox.state = "chase";
    damageEnemy(fox, 1, { x: 0, z: -1 }, 0); damageEnemy(boss, 1, { x: 0, z: -1 }, 0); damageEnemy(golem, 1, { x: 0, z: -1 }, 0);
    expect([fox.stun, golem.stun, boss.stun]).toEqual([STUN, STUN / 2, 0]);
    stepEnemy(fox, { x: 0, z: 5, safe: false, alive: true }, 0.1);
    expect(fox.z).toBe(0); // held
    stepEnemy(fox, { x: 0, z: 5, safe: false, alive: true }, 0.1);
    expect(fox.z).toBeGreaterThan(0); // chasing again
  });
});
