import { describe, expect, it } from "vitest";
import type { MapObject } from "@/lib/game/villageMap";
import { DEFAULT_HOTBAR } from "@/lib/game/world/editorTools";
import { createTerrain, type WorldTerrain } from "@/lib/game/world/terrain";
import { beginStroke, ed, endStroke, strokeFrame, undo } from "./editorStore";

const prop = (id: string, x: number, z: number, extra: Partial<MapObject> = {}): MapObject => ({ id, kind: "prop", x, z, model: "barrel", ...extra });

/** Aim from (x, 1.5, 0) along +z at the ground just in front of the prop at that x. */
function aim(t: WorldTerrain, x: number, z: number) {
  Object.assign(ed.ray, { x, y: 1.5, z: z - 5, dx: 0, dy: 0, dz: 1 });
  ed.hit = { x, y: 0, z, water: false } as typeof ed.hit;
  void t;
}

describe("the eraser", () => {
  const t = createTerrain(64, 64, 0, 0);
  const reset = () => {
    ed.world = { terrain: t } as typeof ed.world;
    ed.objects = [prop("a", 10, 10), prop("b", 14, 10, { pin: true, of: [14, 10] as [number, number] }), prop("c", 40, 10, { pin: true })];
    ed.hotbar = [...DEFAULT_HOTBAR];
    ed.hotbar[0] = { type: "erase", label: "Eraser" };
    ed.slot = 0;
  };

  it("deletes the object under the crosshair on a click, leaving the generator's as a pinned gone, and undoes it", () => {
    reset();
    aim(t, 10, 10);
    beginStroke(0, false);
    endStroke();
    expect(ed.objects.find(o => o.id === "a")).toMatchObject({ gone: true, pin: true });
    undo();
    expect(ed.objects.find(o => o.id === "a")?.gone).toBeUndefined();
  });

  it("erases everything a held drag passes over as one undo, and a placed object just goes", () => {
    reset();
    beginStroke(0, false);
    for (const x of [10, 14, 40]) { aim(t, x, 10); strokeFrame(0.016); }
    endStroke();
    expect(ed.objects.filter(o => !o.gone).map(o => o.id)).toEqual([]);
    expect(ed.objects.find(o => o.id === "c")).toBeUndefined();
    undo();
    expect(ed.objects.map(o => o.id)).toEqual(["a", "b", "c"]);
    expect(ed.objects.some(o => o.gone)).toBe(false);
  });
});
