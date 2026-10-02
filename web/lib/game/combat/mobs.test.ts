import { describe, expect, it } from "vitest";
import { ENEMIES } from "./data";
import { hitAmount, strike } from "./abilities";
import { stepCombat } from "./encounter";
import { SHELL_NOTE } from "./mobs";
import { createRuntime, type CombatRuntime } from "./runtime";
import { ELDER, angleDiff, contactLands, damageEnemy, nextMove, spawnEnemy, stepEnemy, strikeLands, type Enemy } from "./sim";
import { packAt, SPAWN_TABLE } from "./spawns";
import { glow, lobMarker, marker, partPose } from "./telegraph";
import { bossMinutes } from "./balance";

const DT = 1 / 60, ME = { x: 0, z: 0 };
const lcg = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
/** You in the open at the origin, out of the safe zone, with health to spare unless a test says otherwise. */
function arena(hp = 1e6): CombatRuntime {
  const rt = createRuntime();
  rt.player.safe = false; rt.player.maxHp = rt.player.hp = hp;
  return rt;
}
const pack = (type: string, x: number, z: number, n: number) => packAt(`p-${type}`, type, x, z, n).map(s => spawnEnemy(s.id, ENEMIES[s.type], s.x, s.z, s.pack));
/** Step the encounter `seconds` with you at `me` (or wherever `me()` says each tick), calling `each` after every tick. */
function play(rt: CombatRuntime, seconds: number, me: { x: number; z: number } | ((t: number) => { x: number; z: number }) = ME, each?: (t: number) => void) {
  const random = lcg(5);
  for (let t = 0; t < seconds; t += DT) { stepCombat(rt, typeof me === "function" ? me(t) : me, DT, () => true, random); each?.(t); }
}
const hurtBy = (rt: CombatRuntime, f: () => void) => { const before = rt.player.hp; f(); return before - rt.player.hp; };

describe("shadow fox: packs of three flank, then pounce in turn (crouch-flare tell)", () => {
  it("a den circles to different sides of you and each pounces after its own crouch, one after another", () => {
    const rt = arena();
    rt.enemies = pack("shadow-fox", 0, 6, 3);
    const first = new Map<string, { t: number; bearing: number }>();
    play(rt, 8, ME, t => { for (const e of rt.enemies) if (e.state === "windup" && !first.has(e.id)) first.set(e.id, { t, bearing: Math.atan2(e.x, e.z) }); });
    const starts = [...first.values()].sort((a, b) => a.t - b.t);
    expect(starts).toHaveLength(3);
    // From three sides: the widest pair of bearings is well over a right angle apart.
    const spread = Math.max(...starts.flatMap(a => starts.map(b => angleDiff(a.bearing, b.bearing))));
    expect(spread).toBeGreaterThan(2);
    // In turn: never all at once.
    expect(starts[2].t - starts[0].t).toBeGreaterThan(0.6);
  });
  it("crouches low with its mane and eyes flaring through a 0.6 s windup, then leaps 3.6 u down its lane", () => {
    const fox = ENEMIES["shadow-fox"], move = fox.attacks[0];
    expect(move).toMatchObject({ shape: "pounce", windup: 0.6, leap: 3.6 });
    const e = { ...spawnEnemy("f", fox, 0, 3), state: "windup" as const, t: move.windup * 0.95, facing: Math.PI };
    expect(partPose("body", e, 0)!.dy).toBeLessThan(-0.03); // low
    expect(partPose("mane", e, 0)!.s).toBeGreaterThan(1.15); // bristling
    expect(glow(e, 0)).toBeGreaterThan(glow({ ...e, state: "chase", t: 0 }, 0) * 3); // eyes and mane flare
    // The lane: from the fox to where it lands, in the melee family.
    expect(marker(e)).toMatchObject({ family: "melee", from: { x: 0, z: 3 } });
    expect(marker(e)!.x).toBeCloseTo(0);
    expect(marker(e)!.z).toBeCloseTo(3 - 3.6);
  });
  it("hits you once if you stay in its lane, and misses if you step out of it", () => {
    const run = (sidestep: number) => {
      const rt = arena(); rt.enemies = [{ ...spawnEnemy("f", ENEMIES["shadow-fox"], 0, 3), state: "chase" as const }];
      let at = { x: 0, z: 0 };
      return hurtBy(rt, () => play(rt, 1.4, () => at, () => { if (rt.enemies[0].state === "windup" && rt.enemies[0].t > 0.3) at = { x: sidestep, z: 0 }; }));
    };
    expect(run(0)).toBe(ENEMIES["shadow-fox"].attacks[0].damage);
    expect(run(1.6)).toBe(0);
  });
  it("hitting one wakes its den", () => {
    const rt = arena();
    rt.enemies = pack("shadow-fox", 0, 30, 3);
    damageEnemy(rt.enemies[0], 1, { x: 0, z: 28 }, 0);
    play(rt, DT);
    expect(rt.enemies.map(e => e.state)).toEqual(["chase", "chase", "chase"]);
  });
});

describe("thorn crab: a front shell, a slow turn", () => {
  const crab = (facing = 0): Enemy => ({ ...spawnEnemy("c", ENEMIES["thorn-crab"], 0, 0), state: "chase", facing });
  it("turns most of a frontal hit aside; its flank and its back take all of it", () => {
    const rt = arena(), e = crab(0), noCrit = () => 0.99;
    const from = (x: number, z: number) => hitAmount(rt, e, { power: 1, from: { x, z } }, noCrit).amount;
    expect(from(0, 2)).toBeLessThan(from(0, -2) * 0.3);
    expect(from(2, 0)).toBe(from(0, -2));
    // The shell's spark and its hint; a frontal hit never staggers it.
    strike(rt, e, { power: 1, from: { x: 0, z: 2 }, knock: 4, melee: true }, noCrit);
    expect(rt.fx.some(f => f.kind === "glance")).toBe(true);
    expect(rt.floaters.some(f => f.text === SHELL_NOTE)).toBe(true);
    expect(e.stun).toBe(0);
    strike(rt, e, { power: 1, from: { x: 0, z: -2 }, knock: 4, melee: true }, noCrit);
    expect(e.stun).toBeGreaterThan(0);
  });
  it("turns to face you slowly and only sweeps once you're in front", () => {
    const rt = arena(), e = crab(0);
    rt.enemies = [e];
    const behind = { x: 0, z: -0.9 };
    play(rt, 0.25, behind);
    expect(angleDiff(e.facing, 0)).toBeLessThanOrEqual(ENEMIES["thorn-crab"].turn! * 0.25 + 0.05);
    expect(e.state).toBe("chase"); // no sweep at your back
    let wound = -1;
    play(rt, 3, behind, t => { if (wound < 0 && e.state === "windup") wound = t; });
    expect(wound).toBeGreaterThan(0.9); // about π / 2 rad/s later
    expect(angleDiff(e.facing, Math.PI)).toBeLessThan(ENEMIES["thorn-crab"].attacks[0].arc / 2); // you're inside its sweep
  });
});

describe("mushroom beast: lobbed spores, a landing ring, poison puddles", () => {
  it("lobs onto the marked ring: over everything, a burst where it lands and a puddle that ticks while you stand in it", () => {
    const rt = arena(1000);
    rt.enemies = [{ ...spawnEnemy("m", ENEMIES["mushroom-beast"], 0, 0), state: "chase" as const }];
    const spot = { x: 0, z: 5 };
    play(rt, 1.0, spot);
    const ball = rt.projectiles.find(p => p.kind === "spore")!;
    expect(ball).toBeDefined();
    expect(lobMarker(ball)).toMatchObject({ family: "ranged", x: 0 });
    expect(lobMarker(ball).z).toBeCloseTo(5);
    // Standing between it and the ring: it flies over you.
    expect(hurtBy(rt, () => play(rt, 0.3, { x: 0, z: 2.5 }))).toBe(0);
    // On the ring when it lands: the burst, then the puddle's ticks.
    const burst = hurtBy(rt, () => play(rt, 0.6, spot));
    expect(burst).toBeGreaterThanOrEqual(ENEMIES["mushroom-beast"].attacks[0].damage);
    expect(rt.hazards).toMatchObject([{ kind: "poison", x: 0 }]);
    expect(rt.fx.some(f => f.kind === "spores")).toBe(true);
    rt.enemies = [];
    expect(hurtBy(rt, () => play(rt, 1.5, spot))).toBeGreaterThanOrEqual(2 * 3);
    expect(hurtBy(rt, () => play(rt, 1, { x: 4, z: 5 }))).toBe(0); // out of it
    play(rt, 3, { x: 4, z: 5 });
    expect(rt.hazards).toHaveLength(0); // dried up
  });
  it("keeps its distance to throw: it winds up from 5.5 u", () => {
    const e = spawnEnemy("m", ENEMIES["mushroom-beast"], 0, 0);
    let ev = null;
    for (let t = 0; t < 2.5 && !ev; t += DT) ev = stepEnemy(e, { x: 0, z: 5.2, safe: false, alive: true }, DT);
    expect(ev).toMatchObject({ kind: "lob", to: { x: 0, z: 5.2 } });
    expect(Math.hypot(e.x, e.z)).toBeLessThan(0.5); // it threw from where it stood
  });
});

describe("rune wisp: rune bolts down a marked line, short blinks to keep its range", () => {
  it("fires a rune bolt from range", () => {
    const rt = arena();
    rt.enemies = [{ ...spawnEnemy("w", ENEMIES["rune-wisp"], 0, 0), state: "chase" as const }];
    play(rt, 0.8, { x: 0, z: 5 });
    expect(rt.projectiles).toMatchObject([{ kind: "rune", from: "enemy" }]);
  });
  it("closer than 3.2 u it shimmers, blinks 4 u away and can't blink again for a while", () => {
    const rt = arena(), e = { ...spawnEnemy("w", ENEMIES["rune-wisp"], 0, 0), state: "chase" as const };
    rt.enemies = [e];
    const near = { x: 0, z: 1.5 };
    play(rt, 0.1, near);
    expect(e.state).toBe("windup");
    expect(e.move.shape).toBe("blink");
    expect(marker(e)).toBeNull(); // the shimmer is the tell, not a marker
    expect(partPose("body", { ...e, t: e.move.windup * 0.9 }, 0)!.s).toBeLessThan(0.4);
    play(rt, 0.3, near);
    expect(Math.hypot(e.x - near.x, e.z - near.z)).toBeGreaterThan(3.2);
    expect(rt.fx.filter(f => f.kind === "blink")).toHaveLength(2); // out and in
    // Chase it down again at once: it fights instead of blinking.
    e.x = 0; e.z = 0.2;
    play(rt, 1.2, near);
    expect(rt.fx.filter(f => f.kind === "blink")).toHaveLength(2);
  });
  it("won't blink out of its leash or into a wall", () => {
    const e = { ...spawnEnemy("w", ENEMIES["rune-wisp"], 0, 0), state: "chase" as const };
    const wall = (x: number) => x < 1; // free only to the east
    for (let t = 0; t < 0.5; t += DT) stepEnemy(e, { x: -1, z: 0, safe: false, alive: true }, DT, (x) => wall(-x));
    expect(e.x).toBeGreaterThan(0); // it went the open way
  });
});

describe("pollen sprites: a swarm that orbits, darts in one by one and bursts into slowing pollen", () => {
  it("the spawn table has clouds of 8 to 15", () => {
    const clouds = SPAWN_TABLE.find(r => r.type === "pollen-sprite")!.at.map(a => a[2] ?? 1);
    expect(clouds.length).toBeGreaterThanOrEqual(2);
    for (const n of clouds) { expect(n).toBeGreaterThanOrEqual(8); expect(n).toBeLessThanOrEqual(15); }
    expect(ENEMIES["pollen-sprite"]).toMatchObject({ pack: "swarm" });
    expect(ENEMIES["pollen-sprite"].hp).toBeLessThan(ENEMIES["shadow-fox"].hp / 3); // weak
  });
  it("a cloud of 12 rings you and trickles in: never more than three darting at once, over several seconds", () => {
    const rt = arena();
    rt.enemies = pack("pollen-sprite", 0, 6, 12);
    let most = 0, firstDart = -1, lastDart = -1;
    const round: number[] = [];
    play(rt, 9, ME, t => {
      const going = rt.enemies.filter(e => e.state === "windup" || e.state === "active").length;
      most = Math.max(most, going);
      if (going) { if (firstDart < 0) firstDart = t; lastDart = t; }
      if (t > 2.4 && t < 2.45) for (const e of rt.enemies) if (e.state === "chase") round.push(Math.atan2(e.x, e.z));
    });
    expect(most).toBeLessThanOrEqual(3);
    expect(lastDart - firstDart).toBeGreaterThan(3);
    // While they wait, they surround you (bearings all round, not one clump).
    const spread = Math.max(...round.flatMap(a => round.map(b => angleDiff(a, b))));
    expect(spread).toBeGreaterThan(2.5);
    expect(rt.enemies.every(e => e.state === "dead")).toBe(true); // every one has darted and burst
  });
  it("a dart that reaches you bursts into pollen that slows you, and gives no kill credit; a swatted sprite does", () => {
    const rt = arena(), s = spawnEnemy("s", ENEMIES["pollen-sprite"], 0, 2.5);
    rt.enemies = [s];
    const before = rt.player.hp;
    play(rt, 1.2);
    expect(s.state).toBe("dead");
    expect(before - rt.player.hp).toBe(ENEMIES["pollen-sprite"].attacks[0].damage);
    expect(rt.hazards).toMatchObject([{ kind: "pollen", slow: 0.35 }]);
    expect(rt.fx.some(f => f.kind === "pollen")).toBe(true);
    expect(rt.player.speed).toBeLessThan(0.75); // slowed while in the puff
    expect(rt.killQueue).toHaveLength(0);
    const swatted = { ...spawnEnemy("t", ENEMIES["pollen-sprite"], 0, 1), state: "chase" as const };
    rt.enemies = [swatted];
    strike(rt, swatted, { power: 5, from: ME }, () => 0.99);
    expect(rt.killQueue).toMatchObject([{ enemy: "pollen-sprite" }]);
  });
  it("a dart that misses still bursts where it runs out", () => {
    const rt = arena(), s = spawnEnemy("s", ENEMIES["pollen-sprite"], 0, 2.5);
    rt.enemies = [s];
    let at = { x: 0, z: 0 };
    play(rt, 1.4, () => at, () => { if (s.state === "windup") at = { x: 3, z: 0 }; });
    expect(s.state).toBe("dead");
    expect(rt.hazards[0].x).toBeCloseTo(0);
  });
});

describe("pack AI keeps its separation and wander (combat polish 5)", () => {
  it("a cloud orbiting you keeps apart", () => {
    const rt = arena();
    rt.enemies = pack("pollen-sprite", 0, 5, 10);
    for (const e of rt.enemies) e.cd = 99; // hold the darts: watch the orbit
    let closest = Infinity;
    play(rt, 4, ME, t => { if (t > 2) for (const [i, a] of rt.enemies.entries()) for (const b of rt.enemies.slice(i + 1)) closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z)); });
    expect(closest).toBeGreaterThan(2 * ENEMIES["pollen-sprite"].radius * 0.9);
  });
});

describe("elder thorn crab (mini-boss): shell phases and claw sweeps", () => {
  const ELDER_T = ENEMIES["elder-thorn-crab"];
  const elder = () => ({ ...spawnEnemy("e", ELDER_T, 0, 0), state: "chase" as const, facing: 0 });
  const shapes = (e: Enemy, n: number) => Array.from({ length: n }, () => nextMove(e).shape);
  it("is a mini-boss with its own bar and title, heavy to push around", () => {
    expect(ELDER_T.miniboss?.title).toBeTruthy();
    expect(ELDER_T.elite).toBe(true);
    const e = elder();
    damageEnemy(e, 1, { x: 0, z: -1 }, 4);
    expect(Math.hypot(e.kx, e.kz)).toBeLessThan(0.5);
  });
  it("takes about 1.5–2.5 minutes with a starter weapon and less with tier 2+ (landing on its flank half the time)", () => {
    for (const w of ["sword-driftwood", "wraps-cloth", "bow-willow", "staff-oak"]) {
      expect(bossMinutes(w, "elder-thorn-crab"), w).toBeGreaterThanOrEqual(1.5);
      expect(bossMinutes(w, "elder-thorn-crab"), w).toBeLessThanOrEqual(2.5);
    }
    for (const w of ["sword-iron", "revolver-brass", "staff-rune"]) expect(bossMinutes(w, "elder-thorn-crab"), w).toBeLessThan(1.6);
  });
  it("stops a charge at the edge of its leash instead of running home to heal", () => {
    const c = { ...spawnEnemy("c", ELDER_T, 0, 0), state: "chase" as const, phase: 2 as const, move: ELDER_T.attacks.find(m => m.shape === "charge")! };
    c.x = 0; c.z = ELDER_T.leashRadius - 3;
    const rt = arena(); rt.enemies = [c];
    play(rt, 2, { x: 0, z: ELDER_T.leashRadius + 2 });
    expect(Math.hypot(c.x - c.spawnX, c.z - c.spawnZ)).toBeLessThanOrEqual(ELDER_T.leashRadius);
    expect(c.state).not.toBe("return");
  });
  it("shell closed above 60%: sweeps only, its front all but closed to you", () => {
    const e = elder();
    expect(new Set(shapes(e, 6))).toEqual(new Set(["sweep"]));
    const rt = arena(), front = hitAmount(rt, e, { power: 1, from: { x: 0, z: 2 } }, () => 0.99).amount, back = hitAmount(rt, e, { power: 1, from: { x: 0, z: -2 } }, () => 0.99).amount;
    expect(front).toBeLessThan(back * 0.2);
  });
  it("cracks at 60%: the crack shows, sweeps come faster, a charge down a marked lane ends in a stagger, the front opens up", () => {
    const rt = arena(), e = elder();
    rt.enemies = [e];
    const sweep = ELDER_T.attacks.find(m => m.shape === "sweep")!;
    damageEnemy(e, Math.ceil(ELDER_T.hp * (1 - ELDER.cracked)) + 1, { x: 0, z: -2 }, 0);
    expect(partPose("glow_crack", e, 0)!.s).toBe(0);
    play(rt, DT, { x: 0, z: 5 });
    expect(e.phase).toBe(2);
    expect(rt.fx.some(f => f.kind === "crack")).toBe(true);
    expect(rt.floaters.some(f => f.text === "Its shell cracks")).toBe(true);
    expect(partPose("glow_crack", e, 0)!.s).toBe(1);
    const moves = Array.from({ length: 6 }, () => nextMove(e));
    expect(moves.map(m => m.shape)).toContain("charge");
    expect(moves.find(m => m.shape === "sweep")!.windup).toBeLessThan(sweep.windup);
    const back = hitAmount(rt, e, { power: 1, from: { x: 0, z: -2 } }, () => 0.99).amount;
    e.facing = 0;
    expect(hitAmount(rt, e, { power: 1, from: { x: 0, z: 2 } }, () => 0.99).amount).toBeGreaterThan(back * 0.35);
    // The charge: a lane marker during its windup, a run of 7 u, then a stagger window.
    const c = { ...spawnEnemy("c", ELDER_T, 0, 0), state: "chase" as const, phase: 2 as const, move: ELDER_T.attacks.find(m => m.shape === "charge")! };
    const crt = arena(); crt.enemies = [c];
    play(crt, 0.5, { x: 0, z: 6 });
    expect(c.state).toBe("windup");
    expect(marker(c)).toMatchObject({ family: "melee", from: { x: 0, z: 0 } });
    expect(strikeLands(c, { x: 0, z: 6 })).toBe(true);
    const hurt = hurtBy(crt, () => play(crt, 1.4, { x: 0, z: 6 }));
    expect(hurt).toBeGreaterThan(0);
    expect(c.z).toBeGreaterThan(5);
    expect(c.state).toBe("recover");
    expect(c.move.stagger).toBe(true);
  });
  it("enrages at 25%: claw slams whose shockwave runs out and hits once where its front passes you", () => {
    const rt = arena(), e = elder();
    rt.enemies = [e];
    damageEnemy(e, Math.ceil(ELDER_T.hp * (1 - ELDER.enraged)) + 1, { x: 0, z: -2 }, 0);
    play(rt, DT, { x: 0, z: 1.5 });
    expect(e.phase).toBe(3);
    expect(e.move.shape).toBe("slam");
    expect(marker({ ...e, state: "windup", t: 0.5 })).toMatchObject({ family: "area" });
    // Outside the slam's ring but inside the shockwave's reach: the wave alone hits you, once.
    const out = { x: 0, z: 4 };
    let waves = 0;
    const hurt = hurtBy(rt, () => play(rt, 3, t => (t < 0.1 ? { x: 0, z: 1.5 } : out), () => { waves = Math.max(waves, rt.hazards.filter(h => h.kind === "wave").length); }));
    expect(waves).toBe(1);
    expect(hurt).toBeGreaterThan(0);
    expect(hurt).toBeLessThan(e.move.damage * 2);
  });
  it("resets to its closed shell and full health when you leave", () => {
    const e = elder();
    damageEnemy(e, ELDER_T.hp * 0.8, { x: 0, z: -2 }, 0);
    stepEnemy(e, { x: 0, z: 2, safe: false, alive: true }, DT);
    expect(e.phase).toBe(3);
    for (let t = 0; t < 10; t += DT) stepEnemy(e, { x: 0, z: 2, safe: true, alive: true }, DT);
    expect(e).toMatchObject({ state: "idle", hp: ELDER_T.hp, phase: 1 });
  });
});

describe("contact attacks", () => {
  it("touch you at most once per attack", () => {
    const e = { ...spawnEnemy("f", ENEMIES["shadow-fox"], 0, 0.5), state: "active" as const, landed: false };
    expect(contactLands(e, ME)).toBe(true);
    expect(contactLands(e, ME)).toBe(false);
  });
});
