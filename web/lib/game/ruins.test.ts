import { describe, expect, it } from "vitest";
import { BOSS_CENTER, COURTYARD, ESCORT_PATH, GATE_PLAZA, LANTERN_SPOT, RUNE_CIRCLE, RUINS_SPAWN, TEMPLE_STEPS, createRuins, zoneAt } from "./ruins";
import { WAVES } from "./combat/spawns";
import { inRect } from "./combat/sim";
import { SPAWNS } from "./combat/spawns";

describe("ruins zone", () => {
  const ruins = createRuins();
  it("connects gate → outer → temple → boss chamber on foot", () => {
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
    expect(reach(LANTERN_SPOT)).toBe(true);
    expect(reach(RUNE_CIRCLE)).toBe(true);
    for (const p of ESCORT_PATH) expect(reach(p)).toBe(true);
    expect(reach({ x: BOSS_CENTER.x, z: BOSS_CENTER.z - 4 })).toBe(true);
  });
  it("keeps the spawn in the safe plaza and every enemy outside it, on open floor", () => {
    expect(inRect({ x: RUINS_SPAWN[0], z: RUINS_SPAWN[2] }, GATE_PLAZA)).toBe(true);
    for (const s of [...SPAWNS, ...WAVES.flat()]) {
      expect(inRect(s, GATE_PLAZA)).toBe(false);
      expect(ruins.free(s.x, s.z, 0.2)).toBe(true);
    }
    expect(zoneAt(COURTYARD.x0 + 1, COURTYARD.z0 + 1)).toBe("temple");
    expect(ruins.free(0, -40)).toBe(false);
  });
});
