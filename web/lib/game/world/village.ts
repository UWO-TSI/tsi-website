/**
 * A smooth world as the game's village (lib/game/villageMap.ts `Village`): its objects, and a derived cell map for the
 * systems that still think in cells (fishing water, forage and bug nodes, the glide guide, the campfire's sand), with
 * `terrain` set so the renderer (components/game/grid/GridWorld.tsx) and the walker (lib/game/defaultIsland.ts) take
 * the heightfield path. Its water (the seabed props, the fish, the water's colour) reads the real seabed.
 */
import { heightField, type MapAnnotation } from "../grid";
import { setBerths, setWaterSource } from "../seabed";
import { landBounds, type MapObject, type Village } from "../villageMap";
import { riverCells } from "./cells";
import { cellMapOf, seabedDepth, terrainShoreField, type WorldTerrain } from "./terrain";

/** Which ground a village draws and walks: the smooth heightfield (a world from the editor's files) or its cells (every other world). */
export function groundKind(v: Pick<Village, "terrain">): "heightfield" | "cells" {
  return v.terrain ? "heightfield" : "cells";
}

/**
 * A village from a smooth world. Build a fresh one after editing the terrain (the cell map is derived once). `shore` is
 * the terrain's shore field when it was already made (lib/game/world/derive.ts, in a worker).
 */
export function villageOfWorld(w: { terrain: WorldTerrain; objects: readonly MapObject[]; annotations?: readonly MapAnnotation[] }, made?: ReturnType<typeof terrainShoreField>): Village {
  const t = w.terrain, map = cellMapOf(t);
  let shore: ReturnType<typeof terrainShoreField> | null = made ?? null;
  setWaterSource(map, { dip: (x, z) => seabedDepth(t, x, z), shore: () => (shore ??= terrainShoreField(t)) });
  // Its wharves' berths stay calm-ish for the moored boats (the waves' calm, lib/game/seabed.ts bakeWaveCalm).
  setBerths(map, w.objects.filter(o => o.kind === "landmark" && o.id === "wharf").map(o => ({ x: o.x, z: o.z, yaw: o.yaw ?? 0 })));
  return { map, field: heightField(map), objects: w.objects, bounds: landBounds(map), terrain: t, rivers: riverCells(w.annotations) };
}
