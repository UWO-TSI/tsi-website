import { describe, expect, it } from "vitest";
import { BOSS_CENTER, COURTYARD, ESCORT_PATHS, FETCH_SPOTS, GATE_PLAZA, RUINS_PILLARS, RUINS_ROCKS, RUINS_SPAWN, SURVIVE_CIRCLES, TEMPLE_STEPS, createRuins, zoneAt } from "./ruins";
import { NO_INPUT, STEP, createMoveState, stepMove, walkTo } from "./movement/sim";
import { capacity, respawnAfter, SPAWN_TABLE, SPAWNS, WAVES } from "./combat/spawns";
import { inRect } from "./combat/sim";
import { ENEMIES } from "./combat/data";
import { ENEMIES as ROSTER, ZONE_LEVEL } from "@/lib/combat/content";

const MAP_ZONE = { outer: "outer", inner: "temple", boss: "boss" } as const;

describe("ruins zone", () => {
  const ruins = createRuins();
  it("connects gate → outer → temple → boss chamber on foot, with every mission place reachable", () => {
    // Flood fill from the spawn over walkable points.
    const seen = new Set<string>(); const queue = [[RUINS_SPAWN[0], RUINS_SPAWN[2]]];
    while (queue.length) {
      const [x, z] = queue.pop()!; const k = `${x},${z}`;
      if (seen.has(k) || !ruins.free(x, z)) continue;
      seen.add(k);
      queue.push([x + 0.5, z], [x - 0.5, z], [x, z + 0.5], [x, z - 0.5]);
    }
    const reach = (p: { x: number; z: number }) => [...seen].some(k => { const [x, z] = k.split(",").map(Number); return Math.hypot(x - p.x, z - p.z) < 0.8; });
    expect(reach({ x: 0, z: -14 })).toBe(true);
    expect(reach(TEMPLE_STEPS)).toBe(true);
    for (const p of Object.values(FETCH_SPOTS)) expect(reach(p)).toBe(true);
    for (const c of Object.values(SURVIVE_CIRCLES)) expect(reach(c)).toBe(true);
    for (const p of Object.values(ESCORT_PATHS).flat()) expect(reach(p)).toBe(true);
    expect(reach({ x: BOSS_CENTER.x, z: BOSS_CENTER.z - 4 })).toBe(true);
  });
  it("keeps the spawn in the safe plaza and every enemy outside it, on open floor", () => {
    expect(inRect({ x: RUINS_SPAWN[0], z: RUINS_SPAWN[2] }, GATE_PLAZA)).toBe(true);
    for (const s of [...SPAWNS, ...Object.values(WAVES).flat(2)]) {
      expect(inRect(s, GATE_PLAZA)).toBe(false);
      expect(ruins.free(s.x, s.z, ENEMIES[s.type].radius * 0.6)).toBe(true);
    }
    expect(zoneAt(COURTYARD.x0 + 1, COURTYARD.z0 + 1)).toBe("temple");
    expect(ruins.free(0, -40)).toBe(false);
  });
  it("walks the canyon on the movement kit: the floor is open, pillars and rocks are walls", () => {
    const at = walkTo(ruins.world, RUINS_SPAWN[0], RUINS_SPAWN[2], 0, -14);
    expect(Math.hypot(at.x, at.z + 14)).toBeLessThan(0.15);
    for (const p of [...RUINS_PILLARS, ...RUINS_ROCKS]) {
      const from = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dz]) => [p.x + dx, p.z + dz]).find(([x, z]) => ruins.free(x, z));
      if (!from) continue;
      const end = walkTo(ruins.world, from[0], from[1], p.x, p.z);
      expect(Math.hypot(end.x - p.x, end.z - p.z)).toBeGreaterThan(0.7);
    }
  });
  it("keeps you in the canyon: a running jump at its wall never mantles onto the cliff top", () => {
    let s = createMoveState(2, -28, ruins.world, Math.PI / 2);
    const seen: string[] = [];
    for (let i = 0; i < 2.5 / STEP; i++) {
      s = stepMove(s, { ...NO_INPUT, x: 1, sprint: true, jump: true, jumpPressed: i % 60 === 20 }, STEP, ruins.world);
      seen.push(...s.events.map(e => e.kind));
    }
    expect(seen).toContain("jump");
    expect(seen).not.toContain("mantle");
    expect(s.y).toBeLessThan(1.5); // never on the 1.5u cliff top (mid-jump peaks reach 1.28 since row 276)
    expect(zoneAt(s.x, s.z)).toBe("plaza");
  });
});

describe("spawn table (combat-content A1)", () => {
  it("places the whole roster, each type in its roster zone at the zone's fixed level (row 230)", () => {
    expect(new Set(SPAWN_TABLE.map(r => r.type))).toEqual(new Set(ROSTER.map(e => e.key)));
    for (const row of SPAWN_TABLE) {
      const e = ROSTER.find(x => x.key === row.type)!;
      expect(row.zone).toBe(e.zone);
      expect(e.level).toBe(ZONE_LEVEL[e.zone] + (e.kind === "elite" ? 2 : 0));
      for (const [x, z] of row.at) expect(zoneAt(x, z)).toBe(MAP_ZONE[row.zone]);
    }
    const zoneOf = (t: string) => SPAWN_TABLE.find(r => r.type === t)!.zone;
    for (const t of ["shadow-fox", "thorn-crab", "mushroom-beast", "rune-wisp", "pollen-sprite", "elder-thorn-crab"]) expect(zoneOf(t)).toBe("outer");
    // Packs: every member of a den or cloud is in the zone too.
    for (const s of SPAWNS.filter(x => x.pack)) expect(zoneAt(s.x, s.z)).toBe("outer");
    for (const t of ["animated-book", "stone-golem"]) expect(zoneOf(t)).toBe("inner");
    expect(zoneOf("guardian-statue")).toBe("boss");
  });
  it("puts the elder thorn crab in the outer area's far corner and the guardian alone in its chamber", () => {
    const [[x, z]] = SPAWN_TABLE.find(r => r.type === "elder-thorn-crab")!.at;
    expect((x / 15) ** 2 + ((z + 14) / 11.5) ** 2).toBeGreaterThan(0.8); // near the edge of the outer ellipse
    expect(SPAWNS.filter(s => zoneAt(s.x, s.z) === "boss").map(s => s.type)).toEqual(["guardian-statue"]);
  });
  it("gives each spawn a stable id, respawns the wild but not the boss, and sizes instancing for waves and summons", () => {
    expect(new Set(SPAWNS.map(s => s.id)).size).toBe(SPAWNS.length);
    expect(respawnAfter("shadow-fox-1-1")).toBeGreaterThan(0); // a den's first fox
    expect(respawnAfter("thorn-crab-1")).toBeGreaterThan(0);
    expect(respawnAfter("guardian-statue-1")).toBe(0);
    expect(respawnAfter("wv1-0")).toBe(0);
    expect(capacity("rune-wisp")).toBe(SPAWNS.filter(s => s.type === "rune-wisp").length + 1 + 2); // one in a wave, two summons
    expect(capacity("animated-book")).toBe(3 + 3);
  });
});
