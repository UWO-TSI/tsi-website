"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
// The game's atmospheric haze and aerial desaturation on the shared fog chunk (side effect, before materials compile).
import "@/lib/game/aerialFog";
import GridWorld from "@/components/game/grid/GridWorld";
import GridOcean from "@/components/game/grid/GridOcean";
import PostFX from "@/components/game/PostFX";
import SunShadows from "@/components/game/SunShadows";
import { IslandAtmosphere } from "@/components/game/IslandAtmosphere";
import { sceneryOf } from "@/components/game/NatureModels";
import { InstancedModels } from "@/components/game/InstancedNature";
import Residents from "@/components/game/NPC";
import TitleVillage from "./TitleVillage";
import { preloadGame } from "./preloadGame";
import { stagedShot, type Shot } from "./shots";
import { shippedVillage, objectsOf } from "@/lib/game/villageMap";
import { villageIsland, villageScale } from "@/lib/game/defaultIsland";
import { villageWater } from "@/lib/game/fishingSpots";
import { ISLAND_TERRAIN, islandLightAt, withSeason, withWeather } from "@/lib/game/islandLighting";
import { seasonLook } from "@/lib/game/seasonalLook";
import { CURRENT, lookFx } from "@/lib/game/lookPreset";
import { useIslandConditions } from "@/lib/game/useIslandConditions";
import { parseTimeOverride } from "@/lib/game/islandTime";
import { DEFAULT_NPC_PERSONAS } from "@/data/content-defaults";

/**
 * The title screen's backdrop: the real island, live, staged (David, 2026-10-10: "a staged shot with good camera
 * angle... that adjusts and changes based on time and season", superseding the 2026-10-03 empty nature shot).
 * The game's own parts, read-only: terrain with its wind-blown grass, the sea, the trees and props from the shipped
 * map, the village buildings with their windows on the clock, the residents walking their real routines, and the
 * atmosphere (real sun, sky, clouds, weather and falling leaves on the world clock), rendered at half resolution
 * with crisp pixels like the game's pixel finish. No player, no HUD. The framing comes from the staged shots table
 * (`shots.ts`), picked by the live phase and season; the camera drifts slowly across it. Tuning (works on previews
 * too): `?shot=x,z,yawDeg,eye,pitchDeg,fov` frames another shot, `?time=dawn|day|evening|night` holds a phase,
 * `?px=0.5` sets the pixel scale.
 */

const DRIFT_SECONDS = 56;
const DRIFT_DISTANCE = 1.2;
/** The title's depth of field (specs/v1-drop.md §8b): the foreground grass and the far trees soft, the village sharp. */
const TITLE_DOF = { enabled: true, blur: 0.24, taper: 0.32, offset: -0.03 };

function parseShot(value: string | null): Partial<Shot> {
  const n = (value ?? "").split(",").map(Number);
  const [x, z, yaw, eye, pitch, fov] = n;
  return n.length >= 2 && n.every(Number.isFinite)
    ? { x, z, ...(yaw !== undefined && { yaw }), ...(eye !== undefined && { eye }), ...(pitch !== undefined && { pitch }), ...(fov !== undefined && { fov }) } : {};
}

const _at = new THREE.Vector3(), _look = new THREE.Vector3();
/**
 * Gentle camera life: a slow ping-pong dolly across the view, eased at both ends, with a faint handheld breath in the
 * aim (a fraction of a degree, under a tenth of a hertz). Held still under reduced motion. Module scope: the camera
 * from a hook is never written in a component.
 */
function aim(camera: THREE.Camera, shot: Shot, t: number, still: boolean, ground: (x: number, z: number) => number) {
  const phase = still ? 0.5 : 0.5 - 0.5 * Math.cos((t / DRIFT_SECONDS) * Math.PI * 2);
  const breath = still ? 0 : 1;
  const yaw = THREE.MathUtils.degToRad(shot.yaw + breath * (0.28 * Math.sin(t * 0.37) + 0.12 * Math.sin(t * 0.83 + 1.3)));
  const pitch = THREE.MathUtils.degToRad(shot.pitch + breath * 0.16 * Math.sin(t * 0.29 + 0.6));
  const side = (phase - 0.5) * (shot.drift ?? DRIFT_DISTANCE);
  const x = shot.x + Math.cos(yaw) * side, z = shot.z - Math.sin(yaw) * side;
  _at.set(x, ground(x, z) + shot.eye + breath * Math.sin(t * 0.45) * 0.012, z);
  _look.set(x + Math.sin(yaw) * 10, _at.y + Math.tan(pitch) * 10, z + Math.cos(yaw) * 10);
  camera.position.copy(_at);
  camera.lookAt(_look);
  if (camera instanceof THREE.PerspectiveCamera && camera.fov !== shot.fov) { camera.fov = shot.fov; camera.updateProjectionMatrix(); }
}

function CinematicCamera({ shot, ground }: { shot: Shot; ground: (x: number, z: number) => number }) {
  const still = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  useFrame(({ camera, clock }) => aim(camera, shot, clock.elapsedTime, still, ground));
  return null;
}

function Scene() {
  // The village file, even once the member island has loaded the new world (lib/game/world/active.ts).
  const v = shippedVillage();
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
  const grassClear = useMemo(() => (x: number, z: number) => island.top(x, z) <= island.ground(x, z) + 0.01, [island]);
  const shot = useMemo(() => ({ ...stagedShot(phase, look.season, v, island), ...parseShot(new URLSearchParams(window.location.search).get("shot")) }),
    [v, island, phase, look.season]);
  const viewer = useRef(new THREE.Vector3(shot.x, 0, shot.z));
  // Residents never notice the title camera: the "player" stands far off the map, so no nameplates, no greetings.
  const nobody = useRef(new THREE.Vector3(500, 0, 500));
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
      <GridWorld map={island.map} field={v.field} light={light} palette={terrain} windScale={weather === "wind" ? 2.2 : 1.4} clear={grassClear} waves ownGround />
      <GridOcean map={island.map} lite={false} radius={scale.glintRadius} waves ownGround />
      <InstancedModels items={scenery} />
      {/* Own boundaries: the base world draws (and the page fades in) while the buildings and residents stream in. */}
      <Suspense fallback={null}>
        <TitleVillage v={v} island={island} light={light} />
      </Suspense>
      <Suspense fallback={null}>
        <Residents personas={DEFAULT_NPC_PERSONAS} phase={phase} ceremony={false} player={nobody} island={island} v={v} />
      </Suspense>
      <PostFX antialias={false} grade={light.grade} fx={{ ...lookFx(CURRENT, true), tiltShift: TITLE_DOF }} />
      <SunShadows />
    </>
  );
}

/** The live backdrop. `onReady` fires after the first frames have drawn, so the page can fade it in; then the game prefetches. */
// 0.65 (was 0.4): the cinematic pass needs the quilt, the tufts and the sky's
// clouds to survive the downsample; the finish still reads as crisp pixels.
const PIXEL_SCALE = 0.65;

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
    preloadGame(); // the title has drawn: the island's files load behind it
  });
  useEffect(() => () => { done.current = true; }, []);
  return null;
}
