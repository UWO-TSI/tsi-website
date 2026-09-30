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
import * as THREE from "three";
import {
  heightAtWorld,
  CLIFF_LEVELS,
  heightField,
  sampleGroundHeight,
  rampHeightAt,
  type IslandMap,
} from "@/lib/game/grid";
import { setTerrainHeightProvider } from "../terrain";
import GridTerrain, { type TerrainPalette } from "./GridTerrain";
import GridCliffs from "./GridCliffs";
import GrassTufts from "./GrassTufts";
import { applyGrassNormalStrength, advanceWater, shadeWaterByClouds } from "./terrainMaterials";
import { cloudLayer } from "../AmbienceFX";
import { useTuning } from "@/lib/game/tuning";
import { useFrame } from "@react-three/fiber";
import type { IslandLight } from "@/lib/game/islandLighting";
import { worldTime } from "@/lib/game/worldClock";

/** `field`: the map's height field when the caller already built it (the village builds it once). */
/** `light`: the scene's IslandLight; the water mirrors its key light (sun by day, moon by night) in its colour. */
export default function GridWorld({ map, field: suppliedField, light, palette, windScale }: { map: IslandMap; field?: Float32Array; light: Pick<IslandLight, "water" | "sunPosition" | "sun">; palette?: TerrainPalette; windScale?: number }) {
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
    // Same guard as GridTerrain: inert at CLIFF_LEVELS 1, and the two MUST
    // agree or the player walks on a different surface from the one drawn.
    const field = CLIFF_LEVELS > 1 ? suppliedField ?? heightField(map) : null;
    setTerrainHeightProvider((x, z) =>
      field ? sampleGroundHeight(map, field, x, z) : rampHeightAt(map, x, z) ?? heightAtWorld(map, x, z)
    );
    return () => setTerrainHeightProvider(null);
  }, [map, suppliedField]);

  // The river flows, swells and catches the sun. One uniform block per frame.
  const sunDir = useMemo(() => new THREE.Vector3(...light.sunPosition), [light.sunPosition]);
  const sunColor = useMemo(() => new THREE.Color(light.sun), [light.sun]);
  useFrame(() => {
    advanceWater(worldTime(), light.water, sunDir, sunColor);
    shadeWaterByClouds(cloudLayer.map, cloudLayer.uv);
  });

  return (
    <group>
      <GridTerrain map={map} field={suppliedField} palette={palette} />
      <GridCliffs map={map} />
      <GrassTufts map={map} windScale={windScale} />
    </group>
  );
}
