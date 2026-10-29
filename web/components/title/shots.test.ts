import { describe, expect, it } from "vitest";
import { join } from "node:path";
import * as THREE from "three";
import { fallbackShot, stagedShot, titleView } from "./shots";
import { loadWorldFromDisk } from "@/lib/game/world/disk";
import { villageOfWorld } from "@/lib/game/world/village";
import { objectById, objectsOf, village } from "@/lib/game/villageMap";
import { villageIsland } from "@/lib/game/defaultIsland";
import type { IslandPhase } from "@/lib/game/islandTime";
import type { Season } from "@/lib/game/season";

const PHASES: IslandPhase[] = ["dawn", "day", "evening", "night"];
const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

describe("the title's staged shots", () => {
  const v = village();
  const island = villageIsland(v);

  it("stands on dry ground in every phase and season on the live island", () => {
    for (const phase of PHASES) for (const season of SEASONS) {
      const shot = stagedShot(phase, season, v, island);
      if (!shot.float) {
        expect(island.wet(shot.x, shot.z), `${season} ${phase} in the water`).toBe(false);
        expect(island.standable(shot.x, shot.z), `${season} ${phase} not standable`).toBe(true);
      }
      expect(shot.fov).toBeGreaterThan(0);
    }
  });

  it("falls back to a shore shot when a repainted island moves the ground", () => {
    const drowned = { ...island, wet: () => true, standable: () => false };
    for (const phase of PHASES) {
      expect(stagedShot(phase, "summer", v, drowned)).toEqual(fallbackShot(v, drowned));
    }
  });
});

describe("what the title can see", () => {
  const v = villageOfWorld(loadWorldFromDisk(join(__dirname, "../../data/world")));
  const island = villageIsland(v);
  const shot = stagedShot("day", "summer", v, island);
  const seen = titleView(v, island, "summer", shot, new THREE.PerspectiveCamera(38, 1, 0.05, 140), 16 / 9);
  const at = (x: number, z: number, r: number) => new THREE.Sphere(new THREE.Vector3(x, island.ground(x, z) + 1, z), r);

  it("sees the HQ it is staged on, and nothing behind the camera", () => {
    const hq = objectById("landmark", "hq", v)!;
    expect(seen(at(hq.x, hq.z, 1))).toBe(true);
    const yaw = THREE.MathUtils.degToRad(shot.yaw);
    expect(seen(at(shot.x - Math.sin(yaw) * 20, shot.z - Math.cos(yaw) * 20, 5))).toBe(false);
  });

  it("lights only the plaza's lamps, not the island's", () => {
    const lamps = objectsOf("lamp", v), lit = lamps.filter(l => seen(at(l.x, l.z, 5)));
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.length).toBeLessThan(lamps.length / 3);
  });
});
