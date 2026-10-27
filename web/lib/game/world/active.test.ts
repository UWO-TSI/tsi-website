import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FISH } from "../fishing";
import { worldModel } from "./active";

describe("worldModel", () => {
  it("swaps a remodelled dump model for ours in the new world only", () => {
    expect(worldModel("/assets/acnh/fish/carp.glb", "new")).toBe("/assets/game/remodel/fish/carp.glb");
    expect(worldModel("/assets/acnh/props/fence-rope-a.glb", "new")).toBe("/assets/game/remodel/props/fence-rope-a.glb");
    expect(worldModel("/assets/acnh/fish/carp.glb", "village")).toBe("/assets/acnh/fish/carp.glb");
  });
  it("leaves what isn't remodelled alone", () => {
    for (const url of ["/assets/acnh/critters/firefly.glb", "/assets/acnh/critters/monarch-butterfly.glb", "/assets/acnh/props/crab-hermit.glb", "/assets/acnh/props/rock-b.glb", "/assets/acnh/fruit/apple.glb", "/assets/acnh/sea/scallop.glb", "/assets/acnh/props/rock-d.glb"])
      expect(worldModel(url, "new")).toBe(url);
  });
  it("has our file for every fish the new world can catch", () => {
    const missing = FISH.map(f => worldModel(f.model, "new")).filter(u => u.startsWith("/assets/game/remodel/") && !existsSync(join(process.cwd(), "public", u)));
    expect(missing).toEqual([]);
  });
});
