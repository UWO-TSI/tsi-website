import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FISH, RAW_TURN_X } from "../fishing";
import { worldModel } from "./active";

describe("worldModel", () => {
  it("swaps a remodelled dump model for ours", () => {
    expect(worldModel("/assets/acnh/fish/carp.glb")).toBe("/assets/game/remodel/fish/carp.glb");
    expect(worldModel("/assets/acnh/props/fence-rope-a.glb")).toBe("/assets/game/remodel/props/fence-rope-a.glb");
    expect(worldModel("/assets/acnh/props/rock-b.glb")).toBe("/assets/game/remodel/props/rock-b.glb");
    expect(worldModel("/assets/acnh/critters/mantis.glb")).toBe("/assets/game/remodel/critters/mantis.glb");
    expect(worldModel("/assets/acnh/critters/monarch-butterfly.glb")).toBe("/assets/game/remodel/critters/monarch-butterfly.glb");
  });
  it("gives the rod's add-ons their low-poly copy, and the close-up keeps the high-def (design bible, Models 2)", async () => {
    const { TACKLE } = await import("../rods");
    for (const t of TACKLE) {
      const lp = worldModel(t.model);
      expect(lp).toBe(t.model.replace("/assets/game/items/", "/assets/game/items/lp/"));
      expect(existsSync(join(process.cwd(), "public", lp)), lp).toBe(true);
      expect(existsSync(join(process.cwd(), "public", t.model)), t.model).toBe(true);
    }
  });
  it("leaves what isn't remodelled alone", () => {
    for (const url of ["/assets/acnh/critters/firefly.glb", "/assets/acnh/props/crab-hermit.glb", "/assets/acnh/props/crab-gazami.glb", "/assets/acnh/fruit/apple.glb", "/assets/acnh/sea/scallop.glb", "/assets/acnh/props/rock-d.glb"])
      expect(worldModel(url)).toBe(url);
  });
  it("has our file for every fish the new world can catch", () => {
    const missing = FISH.map(f => worldModel(f.model)).filter(u => u.startsWith("/assets/game/remodel/") && !existsSync(join(process.cwd(), "public", u)));
    expect(missing).toEqual([]);
  });
  it("draws our fish in the game's frame, none raw", () => {
    const ours = FISH.filter(f => f.model.startsWith("/assets/game/remodel/"));
    expect(ours.length).toBe(81);
    expect(ours.filter(f => f.raw)).toEqual([]);
  });
  it("hangs a raw export (head +z, back +y) head up with its back toward -z (the sea creatures)", () => {
    const turn = ([x, y, z]: number[]) => [x, y * Math.cos(RAW_TURN_X) - z * Math.sin(RAW_TURN_X), y * Math.sin(RAW_TURN_X) + z * Math.cos(RAW_TURN_X)].map(v => Math.round(v));
    const [head, back] = [turn([0, 0, 1]), turn([0, 1, 0])];
    expect([head, back]).toEqual([[0, 1, 0], [0, 0, -1]]);
  });
});
