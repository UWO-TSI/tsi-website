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

import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  Surface,
  heightAtWorld,
  CLIFF_LEVELS,
  heightField,
  sampleGroundHeight,
  rampHeightAt,
  type IslandMap,
  GRASS_COLOR,
} from "@/lib/game/grid";
import { setTerrainHeightProvider } from "../terrain";
import GridTerrain, { CLIFF_FRINGE, TERRAIN_WET, useTerrainMaterials, type TerrainPalette } from "./GridTerrain";
import GridCliffs from "./GridCliffs";
import GrassField from "./GrassField";
import GrassTufts from "./GrassTufts";
import CliffBoulders from "./CliffBoulders";
import { applyGrassNormalStrength, advanceWater, drawFoamRings, shadeWaterByClouds } from "./terrainMaterials";
import { FOAM_RING_SLOTS } from "@/lib/game/foamRings";
import { fxOn } from "@/lib/game/perf/fxBench";
import { cloudLayer } from "../AmbienceFX";
import { useTuning } from "@/lib/game/tuning";
import { useFrame } from "@react-three/fiber";
import type { IslandLight } from "@/lib/game/islandLighting";
import type { ShoreSdf } from "@/lib/game/grid";
import type { WorldTerrain } from "@/lib/game/world/terrain";
import { bakeWaveCalm, shoreFieldOf } from "@/lib/game/seabed";
import SmoothTerrain from "../world/SmoothTerrain";
import { worldTime } from "@/lib/game/worldClock";

/**
 * Which grass a world draws: the blade field (GrassField) only where the world names its obstacles (`clear`: the
 * village, the v2 world, the title), so no blade grows through a building it can't see; every other world (the
 * applicant island, live for recruits, the ruins, the home island) keeps the flowing tufts it drew on main, and no
 * cliff-foot boulders.
 */
export function grassLayer(clear: ((x: number, z: number) => boolean) | undefined): "field" | "tufts" {
  return clear ? "field" : "tufts";
}

/** The grass without a palette (the bench islands): the grid's own green. */
const GRASS_HEX = `#${new THREE.Color(GRASS_COLOR).getHexString()}`;

type GridWorldProps = {
  map: IslandMap; field?: Float32Array; light: Pick<IslandLight, "water" | "sunPosition" | "sun" | "wet" | "sky" | "skyTop">; palette?: TerrainPalette; windScale?: number; lite?: boolean;
  clear?: (x: number, z: number) => boolean;
  /** The smooth world's heightfield (specs/world-editor.md): drawn and walked in place of the cells. Only the v2 world from the editor's files has one. */
  terrain?: WorldTerrain;
};

/** Which ground GridWorld draws: the smooth heightfield when the world has one, else the cells (every other world, as on main). */
export function worldGround(props: Pick<GridWorldProps, "terrain">): "heightfield" | "cells" {
  return props.terrain ? "heightfield" : "cells";
}

/** `field`: the map's height field when the caller already built it (the village builds it once). */
/** `light`: the scene's IslandLight; the water mirrors its key light (sun by day, moon by night) in its colour. */
/** `lite`: Lite's thinner grass and cheaper water (fewer foam rings drawn). `clear`: false where a solid stands, so no blades grow through it (keep it stable). */
export default function GridWorld(props: GridWorldProps) {
  return worldGround(props) === "heightfield" ? <SmoothWorld {...props} terrain={props.terrain!} /> : <CellWorld {...props} />;
}

/** The smooth world: the heightfield, its water and its grass (components/game/world/SmoothTerrain.tsx), the water's frame as the cells have it. */
function SmoothWorld({ map, light, palette, windScale, lite = false, clear, terrain }: GridWorldProps & { terrain: WorldTerrain }) {
  useEffect(() => { TERRAIN_WET.value = light.wet ?? 0; }, [light.wet]);
  useEffect(() => () => { TERRAIN_WET.value = 0; }, []);
  useWaterFrame(light, lite);
  // The village registered its water for the derived cell map (lib/game/world/village.ts): the same field the fish read,
  // and the waves' calm over it (its rivers and its wharf's berth).
  const shore = useMemo(() => { const f = shoreFieldOf(map) as ShoreSdf & { depth?: Float32Array }; return { ...f, calm: bakeWaveCalm(f, map) }; }, [map]);
  return <SmoothTerrain terrain={terrain} shore={shore} grass={palette?.grass} windScale={windScale} lite={lite} clear={clear} />;
}

/** The water's waves run (Lite fewer trains), it catches the sun; the foam rings round what stands in it. One uniform block per frame. */
export function useWaterFrame(light: GridWorldProps["light"], lite: boolean) {
  const sunDir = useMemo(() => new THREE.Vector3(...light.sunPosition), [light.sunPosition]);
  const sunColor = useMemo(() => new THREE.Color(light.sun), [light.sun]);
  const sky = useMemo(() => ({ zenith: new THREE.Color(light.skyTop ?? light.sky), horizon: new THREE.Color(light.sky) }), [light.sky, light.skyTop]);
  useFrame(({ camera }) => {
    advanceWater(worldTime(), light.water, sunDir, sunColor, sky, lite);
    shadeWaterByClouds(cloudLayer.map, cloudLayer.uv);
    drawFoamRings(camera, lite ? FOAM_RING_SLOTS.lite : FOAM_RING_SLOTS.high, fxOn("foamRings"));
  });
}

/** The cell world (every world but the smooth one), exactly as it was. */
function CellWorld({ map, field: suppliedField, light, palette, windScale, lite = false, clear }: GridWorldProps) {
  const t = useTuning();
  const materials = useTerrainMaterials(palette);
  // The ground's wetness is the light's (it eases with the weather); dry when the scene goes.
  useEffect(() => { TERRAIN_WET.value = light.wet ?? 0; }, [light.wet]);
  useEffect(() => () => { TERRAIN_WET.value = 0; }, []);

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

  // The water's waves run (Lite fewer trains) and it catches the sun. One uniform block per frame.
  const sunDir = useMemo(() => new THREE.Vector3(...light.sunPosition), [light.sunPosition]);
  const sunColor = useMemo(() => new THREE.Color(light.sun), [light.sun]);
  const sky = useMemo(() => ({ zenith: new THREE.Color(light.skyTop ?? light.sky), horizon: new THREE.Color(light.sky) }), [light.sky, light.skyTop]);
  useFrame(({ camera }) => {
    advanceWater(worldTime(), light.water, sunDir, sunColor, sky, lite);
    shadeWaterByClouds(cloudLayer.map, cloudLayer.uv);
    drawFoamRings(camera, lite ? FOAM_RING_SLOTS.lite : FOAM_RING_SLOTS.high, fxOn("foamRings"));
  });

  return (
    <group>
      <GridTerrain map={map} field={suppliedField} materials={materials} />
      <GridCliffs map={map} grass={materials.get(Surface.Grass)} drape={materials.get(CLIFF_FRINGE)} />
      {/* The cliff-foot boulders go with the field: only a world that names its obstacles (they have no collision of their own).
          Their own boundary: the ground draws while their models stream in. */}
      {grassLayer(clear) === "field" && <Suspense fallback={null}><CliffBoulders map={map} field={suppliedField} /></Suspense>}
      {grassLayer(clear) === "field"
        ? <GrassField map={map} field={suppliedField} color={palette?.grass ?? GRASS_HEX} windScale={windScale} lite={lite} clear={clear} />
        : <GrassTufts map={map} windScale={windScale} />}
    </group>
  );
}
