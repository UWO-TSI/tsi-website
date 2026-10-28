import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FISH } from "../fishing";
import { GAME_WORLD, worldModel } from "./active";

describe("worldModel", () => {
  it("swaps a remodelled dump model for ours in the new world only", () => {
    expect(worldModel("/assets/acnh/fish/carp.glb", "new")).toBe("/assets/game/remodel/fish/carp.glb");
    expect(worldModel("/assets/acnh/props/fence-rope-a.glb", "new")).toBe("/assets/game/remodel/props/fence-rope-a.glb");
    expect(worldModel("/assets/acnh/props/rock-b.glb", "new")).toBe("/assets/game/remodel/props/rock-b.glb");
    expect(worldModel("/assets/acnh/critters/mantis.glb", "new")).toBe("/assets/game/remodel/critters/mantis.glb");
    expect(worldModel("/assets/acnh/critters/monarch-butterfly.glb", "new")).toBe("/assets/game/remodel/critters/monarch-butterfly.glb");
    expect(worldModel("/assets/acnh/fish/carp.glb", "village")).toBe("/assets/acnh/fish/carp.glb");
  });
  it("leaves what isn't remodelled alone", () => {
    for (const url of ["/assets/acnh/critters/firefly.glb", "/assets/acnh/props/crab-hermit.glb", "/assets/acnh/props/crab-gazami.glb", "/assets/acnh/fruit/apple.glb", "/assets/acnh/sea/scallop.glb", "/assets/acnh/props/rock-d.glb"])
      expect(worldModel(url, "new")).toBe(url);
  });
  it("has our file for every fish the new world can catch", () => {
    const missing = FISH.map(f => worldModel(f.model, "new")).filter(u => u.startsWith("/assets/game/remodel/") && !existsSync(join(process.cwd(), "public", u)));
    expect(missing).toEqual([]);
  });
  it("draws our fish in the game's frame, none raw, in the new world (the village keeps the dump's raw ones)", () => {
    const ours = FISH.filter(f => f.model.startsWith("/assets/game/remodel/"));
    expect(ours.length).toBe(GAME_WORLD === "new" ? 81 : 0);
    expect(ours.filter(f => f.raw)).toEqual([]);
  });
});
