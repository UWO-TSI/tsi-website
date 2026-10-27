import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FISH } from "../fishing";
import { worldModel } from "./active";

describe("worldModel", () => {
  it("swaps a remodelled dump model for ours in the new world only", () => {
    expect(worldModel("/assets/acnh/critters/monarch-butterfly.glb", "new")).toBe("/assets/game/remodel/critters/monarch-butterfly.glb");
    expect(worldModel("/assets/acnh/props/rock-b.glb", "new")).toBe("/assets/game/remodel/props/rock-b.glb");
    expect(worldModel("/assets/acnh/critters/monarch-butterfly.glb", "village")).toBe("/assets/acnh/critters/monarch-butterfly.glb");
  });
  it("leaves what isn't remodelled alone", () => {
    for (const url of ["/assets/acnh/critters/firefly.glb", "/assets/acnh/fruit/apple.glb", "/assets/acnh/sea/scallop.glb", "/assets/acnh/props/rock-d.glb"])
      expect(worldModel(url, "new")).toBe(url);
  });
  it("has our file for every fish the new world can catch", () => {
    const missing = FISH.map(f => worldModel(f.model, "new")).filter(u => u.startsWith("/assets/game/remodel/") && !existsSync(join(process.cwd(), "public", u)));
    expect(missing).toEqual([]);
  });
});
