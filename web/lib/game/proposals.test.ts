import { describe, expect, it } from "vitest";
import { PROPOSALS, acceptProposed, pendingOf } from "./proposals";
import { buildVillage, villageOf, type MapObject, type VillageDoc } from "./villageMap";
import { islandOf } from "./defaultIsland";
import worldDoc from "@/data/world-map.json";

describe("placement proposals (lib/game/proposals.ts)", () => {
  const p = PROPOSALS.find(x => x.title === "v1 natural barriers")!;
  it("ships the v1 barriers for the v2 world, every object with a note for David", () => {
    expect(p.target).toBe("world-map");
    expect(p.objects.length).toBeGreaterThan(10);
    for (const o of p.objects) expect(o.note, o.id).toBeTruthy();
  });
  it("shows only what the document doesn't hold, and accepting adds plain map objects once", () => {
    const doc: MapObject[] = [{ id: "default", kind: "spawn", x: 0, z: 0 }];
    expect(pendingOf(p, doc)).toHaveLength(p.objects.length);
    const one = acceptProposed(doc, [p.objects[0]]);
    expect(one).toHaveLength(2);
    expect(one[1]).not.toHaveProperty("note");
    expect(one[1]).toMatchObject({ id: p.objects[0].id, kind: "barrier", model: p.objects[0].model });
    expect(pendingOf(p, one)).toHaveLength(p.objects.length - 1);
    // Accepting again (or all, after one) never doubles an object.
    const all = acceptProposed(one, p.objects);
    expect(all).toHaveLength(1 + p.objects.length);
    expect(pendingOf(p, all)).toEqual([]);
    expect(acceptProposed(all, p.objects)).toHaveLength(all.length);
  });
  it("proposes the beach campfire on the v2 world, on dry land, clear of the barriers", () => {
    const c = PROPOSALS.find(x => x.title === "v1 beach campfire")!;
    expect(c.target).toBe("world-map");
    expect(c.objects).toEqual([expect.objectContaining({ id: "campfire", kind: "campfire", x: -15, z: 112 })]);
    const world = buildVillage(worldDoc as unknown as VillageDoc), island = islandOf(villageOf(world.map, acceptProposed(world.objects, p.objects)));
    expect(island.standable(-15, 112)).toBe(true);
  });
  it("leaves an object David already placed or moved under that id as his", () => {
    const moved: MapObject = { ...p.objects[0], x: 1, z: 2 };
    delete (moved as { note?: string }).note;
    const doc = acceptProposed([moved], p.objects);
    expect(doc.find(o => o.id === moved.id)).toMatchObject({ x: 1, z: 2 });
  });
});
