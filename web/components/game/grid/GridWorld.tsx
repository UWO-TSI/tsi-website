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

import { useMemo } from "react";
import islandMapDoc from "@/data/island-map.json";
import { parseIslandMap, type IslandMap, type PlacedProp } from "@/lib/game/grid";
import GridTerrain from "./GridTerrain";
import GridCliffs from "./GridCliffs";

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
  return (
    <group>
      <GridTerrain map={map} />
      <GridCliffs map={map} />
    </group>
  );
}
