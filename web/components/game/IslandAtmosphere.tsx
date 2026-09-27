"use client";

/**
 * Shared island atmosphere: the applicant-island lighting profile, real-time
 * phase, season and weather layers, and the follow camera. Used by the
 * village (DefaultIslandWorld) and the personal home island so both run on
 * the same light, time, season and weather systems (specs/homes.md §1).
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import BlobShadows from "./BlobShadows";
import { CloudShadows, MistBanks, TreeLeaves } from "./AmbienceFX";
import { Fireflies } from "./AmbientLife";
import RainFX from "./RainFX";
import { applyEnvironment, disposeEnvironment } from "@/lib/game/envLight";
import { ENV_KEY, fireflyNight, type IslandLight } from "@/lib/game/islandLighting";
import { RIM_POSITION, shadowHalfHeight } from "@/lib/game/lookPreset";
import { SEASON_TREES, type SeasonLook } from "@/lib/game/seasonalLook";
import type { IslandWeather } from "@/lib/game/islandWeather";
import type { IslandPhase } from "@/lib/game/islandTime";
import { setLeafTint, TREE_WIND, WORLD_SNOW } from "@/lib/game/modelMaterials";
import { TERRAIN_SNOW } from "./grid/GridTerrain";
import { WORLD_BEND } from "@/lib/game/curvedWorld";
import { worldTime } from "@/lib/game/worldClock";
import { sheddingTrees, worldWind } from "@/lib/game/worldFx";
import { treeScale } from "./NatureModels";

/** Screen-space vertical sky gradient (a plain 2D background texture): `top` at the top, `horizon` from mid-screen down. */
export function SkyGradient({ top, horizon }: { top: string; horizon: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1; canvas.height = 64;
    const ctx = canvas.getContext("2d")!, gradient = ctx.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, top); gradient.addColorStop(0.55, horizon); gradient.addColorStop(1, horizon);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1, 64);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [top, horizon]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <primitive attach="background" object={texture} />;
}

/** Drives the shared tree sway uniform; eases between calm, breezy and off (Light). */
function TreeWind({ strength }: { strength: number }) {
  useFrame((_, delta) => {
    TREE_WIND.value.x = worldTime();
    TREE_WIND.value.y = THREE.MathUtils.damp(TREE_WIND.value.y, strength, 1.5, delta);
  });
  useEffect(() => () => { TREE_WIND.value.y = 0; }, []);
  return null;
}

/** A tree on the map as the scene draws it (NatureTree): its spot and seed. */
export interface TreeSpot { x: number; z: number; seed: number }
const NO_TREES: readonly TreeSpot[] = [];

export function IslandAtmosphere({ phase, light, look, weather, liteMode, castShadows, overview = false, ground, puddles = [], cloudSize, shadowExtent = 26, fireflyAnchors, trees = NO_TREES }: {
  phase: IslandPhase; light: IslandLight; look: SeasonLook; weather: IslandWeather; liteMode: boolean; castShadows: boolean; overview?: boolean;
  ground: (x: number, z: number) => number;
  puddles?: readonly [number, number][]; cloudSize: [number, number]; shadowExtent?: number;
  fireflyAnchors: readonly (readonly [number, number])[];
  /** The scene's trees: the ones that shed this season drop leaves or petals. */
  trees?: readonly TreeSpot[];
}) {
  const { gl, scene } = useThree();
  useEffect(() => { TERRAIN_SNOW.value = look.snow; WORLD_SNOW.value = look.snow; setLeafTint(look.leaf); }, [look.snow, look.leaf]);
  useEffect(() => () => { TERRAIN_SNOW.value = 0; WORLD_SNOW.value = 0; }, []);
  useEffect(() => {
    applyEnvironment(gl, scene, ENV_KEY[phase], light.environment);
    return () => disposeEnvironment(scene);
  }, [gl, scene, phase, light]);
  const { shadow } = light, shadowHalf = shadowHalfHeight(light.sunPosition, shadowExtent);
  // One world wind from the shared weather: rain slant, leaves and mist agree.
  const wind = useMemo(() => worldWind(weather), [weather]);
  const leafTrees = useMemo(() => {
    const models = SEASON_TREES[look.season];
    return sheddingTrees(trees.map(t => ({ x: t.x, y: ground(t.x, t.z), z: t.z, model: models[t.seed % models.length], scale: treeScale(t.seed) })), look.season);
  }, [trees, ground, look.season]);
  const puddleBlobs = useMemo(() => puddles.map(([x, z], i) => ({ x, z, y: ground(x, z) + 0.01, rx: 0.5 + (i % 3) * 0.18, rz: 0.32 + (i % 2) * 0.12 })), [puddles, ground]);
  return <>
    {light.skyTop ? <SkyGradient top={light.skyTop} horizon={light.sky} /> : <color attach="background" args={[light.sky]} />}
    <fog attach="fog" args={[light.fogColor, overview ? light.fogNear + 28 : light.fogNear, overview ? light.fogFar + 15 : light.fogFar]} />
    <ambientLight intensity={light.ambient} color={light.fill} />
    <hemisphereLight args={[light.fill, light.bounce, light.hemisphere]} />
    <directionalLight position={light.sunPosition} color={light.sun} intensity={light.sunIntensity} castShadow={castShadows}
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-shadowExtent} shadow-camera-right={shadowExtent}
      shadow-camera-top={shadowHalf} shadow-camera-bottom={-shadowHalf} shadow-camera-near={1} shadow-camera-far={75}
      onUpdate={key => key.shadow.camera.updateProjectionMatrix()}
      shadow-radius={shadow.radius} shadow-intensity={shadow.intensity} shadow-normalBias={0.02} shadow-bias={-0.0002} />
    {light.rim && <directionalLight position={RIM_POSITION} color={light.rim.color} intensity={light.rim.intensity} />}
    {!liteMode && <CloudShadows phase={ENV_KEY[phase]} size={cloudSize} bounded />}
    {(weather === "rain" || weather === "snow") && <RainFX kind={weather} wind={wind} groundHeight={ground} />}
    {weather === "rain" && puddleBlobs.length > 0 && <BlobShadows placements={puddleBlobs} opacity={0.5} color="#8ea7b8" />}
    {weather === "fog" && <MistBanks color={light.sky} opacity={liteMode ? 0.22 : 0.34} wind={wind} ground={ground} />}
    {!liteMode && weather !== "rain" && weather !== "snow" && (look.season === "spring" || look.season === "autumn") &&
      <TreeLeaves trees={leafTrees} mode={look.season === "spring" ? "petals" : "leaves"} wind={wind} ground={ground} />}
    <TreeWind strength={liteMode ? 0 : weather === "wind" ? 0.14 : 0.035} />
    {fireflyNight(light, weather) && <Fireflies anchors={fireflyAnchors} count={liteMode ? 8 : fireflyAnchors.length * 2} groundHeight={ground} />}
  </>;
}

/** Applicant camera as shipped: elevated follow with a slight forward lead; optional overview. */
export function useFollowCamera(player: React.RefObject<THREE.Vector3>, zoom: number, overview: { focus: [number, number, number]; offset: [number, number, number] } | null) {
  const { camera } = useThree();
  const focus = useMemo(() => new THREE.Vector3(), []);
  const destination = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    if (overview) {
      focus.set(...overview.focus);
      destination.set(overview.offset[0] + overview.focus[0], overview.offset[1], overview.offset[2] + overview.focus[2]);
    } else {
      focus.set(player.current.x, player.current.y + 0.7, player.current.z + 1.5);
      destination.set(focus.x, focus.y + 7.4 * zoom, focus.z - 10.8 * zoom);
    }
    camera.position.lerp(destination, 1 - Math.exp(-Math.min(delta, 0.1) * 5));
    camera.lookAt(focus.x, focus.y - (overview ? camera.position.distanceToSquared(focus) * WORLD_BEND : 0), focus.z);
    camera.updateMatrixWorld();
  }, -3);
}
