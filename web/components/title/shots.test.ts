import { describe, expect, it } from "vitest";
import { fallbackShot, stagedShot } from "./shots";
import { village } from "@/lib/game/villageMap";
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
