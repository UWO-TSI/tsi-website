"use client";

/**
 * GridWorld (M4/M5, 2026-07-26) — the tile world, mounted behind `?grid=1`.
 *
 * Replaces Terrain / River / RoadTiles / RiverBanks / RiverBankWalls with the
 * cell grid. Everything else in the scene (props, NPCs, sky, weather, the
 * player) is untouched and still mounts around it, so this is a substrate
 * swap rather than a second game.
 *
 * The default URL is unchanged until David approves the slice.
 */

import { useEffect, useMemo } from "react";
import islandMapDoc from "@/data/island-map.json";
import { parseIslandMap, heightAtWorld, type IslandMap, type PlacedProp } from "@/lib/game/grid";
import { setTerrainHeightProvider } from "../terrain";
import GridTerrain from "./GridTerrain";
import GridCliffs from "./GridCliffs";
import GrassTufts from "./GrassTufts";
import { applyGrassNormalStrength } from "./terrainMaterials";
import { useTuning } from "@/lib/game/tuning";

let cached: { map: IslandMap; props: PlacedProp[] } | null = null;

/**
 * Parse once per page load. The map is 128x128 and static; re-parsing it on
 * every mount would cost 16k cells of work for nothing.
 */
export function getIslandMap(): { map: IslandMap; props: PlacedProp[] } {
  if (!cached) cached = parseIslandMap(islandMapDoc);
  return cached;
}

/**
 * Is the tile world switched on for this page load?
 *
 * A plain function, not a hook: the flag is read from the URL once and cannot
 * change without a navigation, and it is needed from more than one component
 * (GameWorld mounts the substrate in one place and gates RoadTiles in
 * another). Making it a hook would force a hook call inside a JSX expression
 * in a second component, which is exactly the kind of thing that later breaks
 * when someone wraps it in a condition. Follows the `?aerial=1` precedent in
 * curvedWorld.ts, which reads its param at module init for the same reason.
 */
let gridFlag: boolean | null = null;
export function isGridEnabled(): boolean {
  if (gridFlag === null) {
    gridFlag =
      typeof window !== "undefined" && new URLSearchParams(window.location.search).get("grid") === "1";
  }
  return gridFlag;
}

export default function GridWorld() {
  const { map } = useMemo(() => getIslandMap(), []);
  const t = useTuning();

  // The ground material is shared and cached, so the normal-map settings are
  // pushed onto it rather than recreated — a slider move must not rebuild every
  // chunk's material.
  useEffect(() => {
    applyGrassNormalStrength(t.grass.normalStrength, t.grass.normalScale);
  }, [t.grass.normalStrength, t.grass.normalScale]);

  /**
   * Take over ground height for everything that asks terrain.ts for it — the
   * player, the NPCs, click-to-move, the prop scatter. Without this the world
   * LOOKS terraced and BEHAVES like the old smooth heightfield, so a bank you
   * can see is not a bank you can walk up.
   *
   * `heightAtWorld` reads a Uint8Array and multiplies. It is cheaper than the
   * baked-grid bilinear sample it replaces, so the per-frame paths get faster.
   */
  useEffect(() => {
    setTerrainHeightProvider((x, z) => heightAtWorld(map, x, z));
    return () => setTerrainHeightProvider(null);
  }, [map]);

  return (
    <group>
      <GridTerrain map={map} />
      <GridCliffs map={map} />
      <GrassTufts map={map} />
    </group>
  );
}
