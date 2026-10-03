import { afterEach, describe, expect, it, vi } from "vitest";
import { CLASS_KITS } from "@/lib/combat/classes";
import { ARCANE_KITS } from "@/lib/combat/arcaneKits";
import { GATE_PLAZA } from "@/lib/game/ruins";
import { hurtPlayer } from "./actions";
import { stepCombat } from "./encounter";
import { addNote, bestSignature, classRows, clearPlaytest, DUMMY_BOLT, dpsView, PLAYTEST, playtestFrame, readNotes, setPlaytest, spawnPlaytest, TEST_GROUND } from "./playtest";
import { createRuntime, type CombatRuntime } from "./runtime";
import { inRect, shellFactor, spawnEnemy } from "./sim";
import { ENEMIES } from "./data";
import { SPAWNS } from "./spawns";

/** A page with this query (`?combat=demo` turns the playtest on), with its own localStorage. */
function page(search: string) {
  const store = new Map<string, string>();
  vi.stubGlobal("window", { location: { search } });
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
}
/** The ruins as the scene starts them: the spawn table out, you outside the safe zone. */
function ruins(): CombatRuntime {
  const rt = createRuntime();
  rt.enemies = SPAWNS.map(s => spawnEnemy(s.id, ENEMIES[s.type], s.x, s.z, s.pack));
  rt.player.safe = false;
  return rt;
}
const run = (rt: CombatRuntime, me: { x: number; z: number }, seconds: number, dt = 0.05) => {
  for (let t = 0; t < seconds; t += dt) { stepCombat(rt, me, dt); playtestFrame(rt, me, dt); }
};

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); PLAYTEST.god = false; PLAYTEST.mana = false; });

describe("the picker's roster", () => {
  it("lists the 16 subclasses by family, landed exactly where a member kit is in CLASS_KITS", () => {
    const rows = classRows();
    expect(rows.map(r => r.family)).toEqual(["Arcane", "Ranger", "Vanguard", "Warden"].flatMap(f => [f, f, f, f]));
    for (const r of rows) {
      expect(!!r.kit).toBe(CLASS_KITS.some(k => k.key === r.key && !k.dev));
      expect(r.fantasy).not.toBe("");
    }
    expect(rows.filter(r => r.family === "Arcane").every(r => r.kit)).toBe(true);
    expect(rows.some(r => r.key === "demo")).toBe(false); // the dev kit is no subclass
    expect(rows.find(r => r.key === "monk")!.name).toBe("Martial Artist");
  });

  it("shows a family's kit as soon as its wave adds it to CLASS_KITS", () => {
    const coming = classRows().find(r => !r.kit);
    if (!coming) return; // every wave has landed
    CLASS_KITS.push({ ...ARCANE_KITS[0], key: coming.key, name: "Landed", family: coming.family });
    try { expect(classRows().find(r => r.key === coming.key)).toMatchObject({ name: "Landed", kit: { key: coming.key } }); }
    finally { CLASS_KITS.pop(); }
  });

  it("puts the best tier of the kit's signature type in hand", () => {
    expect(bestSignature("elementalist", ["sword-driftwood", "prism-staff-1", "prism-staff-3"])).toBe("prism-staff-3");
    expect(bestSignature("elementalist", ["sword-driftwood"])).toBeNull();
  });
});

describe("the dev controls' guards", () => {
  for (const [why, search, env] of [["without ?combat=demo", "?ruins=1", "test"], ["in a production build", "?combat=demo", "production"]] as const) {
    it(`do nothing ${why}`, () => {
      page(search);
      vi.stubEnv("NODE_ENV", env);
      const rt = ruins(), before = rt.enemies.length;
      setPlaytest("god", true); setPlaytest("mana", true);
      expect(PLAYTEST).toEqual({ god: false, mana: false });
      expect(spawnPlaytest(rt, "dummy")).toEqual([]);
      clearPlaytest(rt);
      expect(rt.enemies).toHaveLength(before);
      PLAYTEST.god = PLAYTEST.mana = true; // even set by hand, the frame step leaves you alone
      rt.player.hp = 10; rt.player.energy = 3;
      playtestFrame(rt, { x: 0, z: -20 }, 0.05);
      expect([rt.player.hp, rt.player.energy]).toEqual([10, 3]);
      expect(addNote(rt, "felt slow")).toBe(false);
    });
  }

  it("god mode keeps your health full and infinite mana your pool, in the demo", () => {
    page("?combat=demo&classes=v2");
    const rt = ruins(), me = { x: 0, z: -20 };
    setPlaytest("god", true); setPlaytest("mana", true);
    expect(hurtPlayer(rt, 30, { x: 0, z: -19 }, me, 0)).toBeGreaterThan(0);
    rt.player.energy = 0;
    playtestFrame(rt, me, 0.05);
    expect(rt.player.hp).toBe(rt.player.maxHp);
    expect(rt.player.energy).toBe(100);
    expect(rt.player.alive).toBe(true);
  });

  it("keeps a timestamped note with the class being played", () => {
    page("?combat=demo");
    expect(addNote(createRuntime(), "  Fireball feels late  ", new Date("2026-10-03T14:05:00Z"))).toBe(true);
    expect(readNotes()).toEqual([{ at: "2026-10-03T14:05:00.000Z", subclass: "No class", mastery: null, text: "Fireball feels late" }]);
  });
});

describe("the spawner", () => {
  it("puts a fox pack past the safe zone at the gate, waiting for you", () => {
    page("?combat=demo");
    const rt = ruins(), pack = spawnPlaytest(rt, "shadow-fox");
    expect(pack).toHaveLength(3);
    for (const e of pack) {
      expect(e.type.id).toBe("shadow-fox");
      expect(e.state).toBe("idle");
      expect(inRect(e, GATE_PLAZA)).toBe(false);
      expect(Math.hypot(e.x - TEST_GROUND.x, e.z - TEST_GROUND.z)).toBeLessThan(5);
    }
    expect(new Set(pack.map(e => e.pack?.id)).size).toBe(1);
  });

  it("keeps one of a kind that draws once (the boss): the newest", () => {
    page("?combat=demo");
    const rt = ruins();
    spawnPlaytest(rt, "guardian-statue");
    const [second] = spawnPlaytest(rt, "guardian-statue");
    expect(rt.enemies.filter(e => e.type.id === "guardian-statue")).toEqual([second]);
  });

  it("has a dummy that never fights back, drifts home after a shove, and takes full damage", () => {
    page("?combat=demo");
    const rt = ruins();
    clearPlaytest(rt);
    const [d] = spawnPlaytest(rt, "dummy"), me = { x: d.x, z: d.z - 1 };
    expect(d.type).toMatchObject({ defense: 0, armor: 0 });
    d.kx = 6; // a knockback
    run(rt, me, 12);
    expect(rt.player.hp).toBe(rt.player.maxHp);
    expect(rt.projectiles).toHaveLength(0);
    expect(d.state).not.toBe("dead");
    expect(Math.hypot(d.x - d.spawnX, d.z - d.spawnZ)).toBeLessThan(0.05);
  });

  it("has a shell dummy whose front stays toward the gate (flank it or backstab it)", () => {
    page("?combat=demo");
    const rt = ruins();
    clearPlaytest(rt);
    const [d] = spawnPlaytest(rt, "shell");
    run(rt, { x: d.x + 3, z: d.z + 3 }, 2); // you circle behind it; it doesn't turn
    expect(shellFactor(d, { x: d.x, z: d.z - 2 })).toBeLessThan(1);
    expect(shellFactor(d, { x: d.x, z: d.z + 2 })).toBe(1);
  });

  it("has a ranged dummy that fires a slow bolt at you, then waits", () => {
    page("?combat=demo");
    const rt = ruins();
    clearPlaytest(rt);
    const [d] = spawnPlaytest(rt, "ranged"), me = { x: d.x, z: d.z - 6 };
    playtestFrame(rt, me, 0.016);
    playtestFrame(rt, me, 0.016);
    expect(rt.projectiles).toHaveLength(1);
    expect(rt.projectiles[0]).toMatchObject({ from: "enemy", damage: DUMMY_BOLT.damage });
    expect(Math.hypot(rt.projectiles[0].vx, rt.projectiles[0].vz)).toBeCloseTo(DUMMY_BOLT.speed);
    expect(rt.projectiles[0].vz).toBeLessThan(0); // toward you
  });

  it("clears every enemy and their shots, not yours", () => {
    page("?combat=demo");
    const rt = ruins();
    spawnPlaytest(rt, "pollen-sprite");
    rt.projectiles.push({ id: 1, x: 0, z: 0, vx: 0, vz: 1, life: 1, from: "enemy", damage: 5, kind: "rune", radius: 0.3 }, { id: 2, x: 0, z: 0, vx: 0, vz: 1, life: 1, from: "player", damage: 0, kind: "bolt", radius: 0.3 });
    clearPlaytest(rt);
    expect(rt.enemies).toEqual([]);
    expect(rt.projectiles.map(s => s.from)).toEqual(["player"]);
  });

  it("reads DPS over the last 5 s of fight", () => {
    page("?combat=demo");
    const rt = ruins(), me = { x: 0, z: -28 };
    playtestFrame(rt, me, 0.05);
    rt.tally.dealt += 400;
    for (let i = 0; i < 20; i++) playtestFrame(rt, me, 0.05);
    expect(dpsView(rt)).toMatchObject({ total: 400, dps: 80 });
    for (let i = 0; i < 120; i++) playtestFrame(rt, me, 0.05);
    expect(dpsView(rt).dps).toBe(0);
  });
});
