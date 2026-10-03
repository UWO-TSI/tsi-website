"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import GridWorld from "@/components/game/grid/GridWorld";
import GridOcean from "@/components/game/grid/GridOcean";
import PostFX from "@/components/game/PostFX";
import SunShadows from "@/components/game/SunShadows";
import { IslandAtmosphere } from "@/components/game/IslandAtmosphere";
import { sceneryOf } from "@/components/game/NatureModels";
import { InstancedModels } from "@/components/game/InstancedNature";
import { village, objectsOf, type Village } from "@/lib/game/villageMap";
import { villageIsland, villageScale, type VillageIsland } from "@/lib/game/defaultIsland";
import { villageWater } from "@/lib/game/fishingSpots";
import { ISLAND_TERRAIN, islandLightAt, withSeason, withWeather } from "@/lib/game/islandLighting";
import { seasonLook } from "@/lib/game/seasonalLook";
import { CURRENT, lookFx } from "@/lib/game/lookPreset";
import { useIslandConditions } from "@/lib/game/useIslandConditions";
import { parseTimeOverride } from "@/lib/game/islandTime";

/**
 * The title screen's backdrop: the real island, live, from eye level (David, 2026-10-03: "cinematic shot of game
 * graphics, slight movement of grass or wind on trees in a first person perspective of the game in the pixel style").
 * The game's own parts, read-only: terrain with its wind-blown grass, the sea, the trees and props from the shipped map,
 * the atmosphere (real sun, sky, clouds, weather and falling leaves on the world clock) and the grade, rendered at half
 * resolution with crisp pixels like the game's pixel finish. No player, no HUD, no buildings: a quiet nature shot.
 * The camera drifts slowly along a short path. Tuning (works on previews too): `?shot=x,z,yawDeg,eye,pitchDeg,fov` frames
 * another shot, `?time=dawn|day|evening|night` holds a phase, `?px=0.5` sets the pixel scale.
 */

export type Shot = { x: number; z: number; yaw: number; eye: number; pitch: number; fov: number };

const DRIFT_SECONDS = 48;
const DRIFT_DISTANCE = 1.6;

/** Default framing: a meadow a few steps in from the western shore, looking out to sea (the game's camera faces west, +z). */
export function defaultShot(v: Village, island: VillageIsland): Shot {
  const { cx, cz, maxZ } = v.bounds;
  let shore = cz;
  for (let z = maxZ; z > cz; z -= 0.25) {
    if (!island.wet(cx, z) && island.standable(cx, z)) { shore = z; break; }
  }
  return { x: cx, z: shore - 6, yaw: 0, eye: 1.35, pitch: -3, fov: 52 };
}

function parseShot(value: string | null): Partial<Shot> {
  const n = (value ?? "").split(",").map(Number);
  const [x, z, yaw, eye, pitch, fov] = n;
  return n.length >= 2 && n.every(Number.isFinite)
    ? { x, z, ...(yaw !== undefined && { yaw }), ...(eye !== undefined && { eye }), ...(pitch !== undefined && { pitch }), ...(fov !== undefined && { fov }) } : {};
}

function CinematicCamera({ shot, ground }: { shot: Shot; ground: (x: number, z: number) => number }) {
  const camera = useThree(s => s.camera);
  const still = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const at = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // A slow ping-pong dolly across the view, eased at both ends, with a faint breathing sway.
    const phase = still ? 0.5 : 0.5 - 0.5 * Math.cos((t / DRIFT_SECONDS) * Math.PI * 2);
    const yaw = THREE.MathUtils.degToRad(shot.yaw), pitch = THREE.MathUtils.degToRad(shot.pitch);
    const side = (phase - 0.5) * DRIFT_DISTANCE;
    const x = shot.x + Math.cos(yaw) * side, z = shot.z - Math.sin(yaw) * side;
    const sway = still ? 0 : Math.sin(t * 0.45) * 0.015;
    at.current.set(x, ground(x, z) + shot.eye + sway, z);
    look.current.set(x + Math.sin(yaw) * 10, at.current.y + Math.tan(pitch) * 10, z + Math.cos(yaw) * 10);
    camera.position.copy(at.current);
    camera.lookAt(look.current);
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== shot.fov) { camera.fov = shot.fov; camera.updateProjectionMatrix(); }
  });
  return null;
}

function Scene() {
  const v = village();
  const island = villageIsland(v);
  const scale = useMemo(() => villageScale(v), [v]);
  const conditions = useIslandConditions();
  const { phase, weather, season, blend, sun, setForcedPhase } = conditions;
  useEffect(() => { setForcedPhase(parseTimeOverride(new URLSearchParams(window.location.search).get("time"))); }, [setForcedPhase]);
  const seasonKey = JSON.stringify(season.weights);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value: the blend object is rebuilt every render.
  const look = useMemo(() => seasonLook(season, {}), [seasonKey]);
  const light = useMemo(() => withWeather(withSeason(islandLightAt(CURRENT, blend, sun), look), weather), [blend, look, weather, sun]);
  const scenery = useMemo(() => sceneryOf(v, island.ground, look.season), [v, island, look.season]);
  const terrain = useMemo(() => ({ ...ISLAND_TERRAIN, grass: look.grass }), [look.grass]);
  const shot = useMemo(() => ({ ...defaultShot(v, island), ...parseShot(new URLSearchParams(window.location.search).get("shot")) }), [v, island]);
  const viewer = useRef(new THREE.Vector3(shot.x, 0, shot.z));
  const trees = useMemo(() => objectsOf("tree", v).map(o => ({ x: o.x, z: o.z, seed: o.seed ?? 0 })), [v]);
  const fauna = useMemo(() => ({
    site: { map: v.map, flowers: objectsOf("flower", v).map(o => [o.x, o.z] as [number, number]), water: villageWater(v).classify },
    ground: island.ground, standable: island.standable, surface: island.surface, top: island.top, gulls: [], player: viewer,
  }), [v, island]);
  return (
    <>
      <CinematicCamera shot={shot} ground={island.ground} />
      <IslandAtmosphere phase={phase} light={light} look={look} weather={weather} liteMode={false} castShadows ground={island.ground}
        puddles={objectsOf("puddle", v).map(o => [o.x, o.z] as [number, number])} cloudSize={scale.cloudSize} shadowExtent={scale.shadowExtent}
        fireflyAnchors={objectsOf("bush", v).map(o => [o.x, o.z] as [number, number])} trees={trees} fauna={fauna} />
      <GridWorld map={island.map} field={v.field} light={light} palette={terrain} windScale={weather === "wind" ? 2.2 : 1.4} />
      <GridOcean map={island.map} lite={false} radius={scale.glintRadius} />
      <InstancedModels items={scenery} />
      <PostFX antialias={false} grade={light.grade} fx={lookFx(CURRENT, true)} />
      <SunShadows />
    </>
  );
}

/** The live backdrop. `onReady` fires after the first frames have drawn, so the page can fade it in. */
const PIXEL_SCALE = 0.4;

export default function TitleScene({ onReady }: { onReady?: () => void }) {
  const [px] = useState(() => {
    const v = Number(new URLSearchParams(window.location.search).get("px"));
    return v >= 0.2 && v <= 1 ? v : PIXEL_SCALE;
  });
  return (
    <Canvas aria-hidden tabIndex={-1} style={{ imageRendering: "pixelated" }} dpr={px} gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 52, near: 0.05, far: 140 }} shadows="percentage"
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
      <Suspense fallback={null}>
        <Scene />
        <Ready onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}

function Ready({ onReady }: { onReady?: () => void }) {
  const frames = useRef(0);
  const done = useRef(false);
  useFrame(() => {
    if (done.current || ++frames.current < 20) return;
    done.current = true;
    onReady?.();
  });
  useEffect(() => () => { done.current = true; }, []);
  return null;
}
