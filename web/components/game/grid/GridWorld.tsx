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

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import islandMapDoc from "@/data/island-map.json";
import {
  parseIslandMap,
  heightAtWorld,
  heightField,
  sampleHeightField,
  rampHeightAt,
  type IslandMap,
  type PlacedProp,
} from "@/lib/game/grid";
import { setTerrainHeightProvider } from "../terrain";
import GridTerrain from "./GridTerrain";
import GridCliffs from "./GridCliffs";
import GrassTufts from "./GrassTufts";
import { applyGrassNormalStrength, advanceWater } from "./terrainMaterials";
import { useTuning, tune as tuneNow } from "@/lib/game/tuning";
import { useFrame } from "@react-three/fiber";

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

/**
 * Stepped terrain, for comparison.
 *
 * David, 2026-07-29, asked to see both: hard ACNH-style steps versus the smooth
 * height field. Smooth is the default because it is what he described wanting;
 * `?stepped=1` restores the old flat-quad-plus-skirt behaviour on the same map,
 * so the two can be judged against identical terrain.
 *
 * Read once from the URL for the same reason isGridEnabled is -- see its note.
 */
let steppedFlag: boolean | null = null;
export function isSteppedTerrain(): boolean {
  if (steppedFlag === null) {
    steppedFlag =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("stepped") === "1";
  }
  return steppedFlag;
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
    // The SAME field the mesh uses, or the player walks on a surface that is
    // not the one being drawn.
    const field = isSteppedTerrain() ? null : heightField(map);
    /**
     * Ramps are checked FIRST, because they are the one place the ground is not
     * flat and the height field cannot help: its blur treats a full-cliff
     * difference as a barrier, which at CLIFF_LEVELS 1 is every level change, so
     * a ramp cell reads as its own flat level. Walking one would be walking
     * through the slope.
     */
    setTerrainHeightProvider((x, z) => {
      const r = rampHeightAt(map, x, z);
      if (r !== null) return r;
      return field ? sampleHeightField(map, field, x, z) : heightAtWorld(map, x, z);
    });
    return () => setTerrainHeightProvider(null);
  }, [map]);

  // The river flows, swells and catches the sun. One uniform block per frame.
  // The key light is found by traversal rather than duplicated from GameWorld's
  // sun maths — one source of truth, and it stays correct if that arc changes.
  const sunDir = useRef(new THREE.Vector3(0, 1, 0));
  useFrame((state) => {
    let key: THREE.DirectionalLight | null = null;
    state.scene.traverse((o) => {
      const l = o as THREE.DirectionalLight;
      if (!key && l.isDirectionalLight && l.intensity > 0.5) key = l;
    });
    if (key) sunDir.current.copy((key as THREE.DirectionalLight).position);
    advanceWater(state.clock.elapsedTime, tuneNow().water, sunDir.current);
  });

  return (
    <group>
      <GridTerrain map={map} />
      <GridCliffs map={map} />
      <GrassTufts map={map} />
    </group>
  );
}
