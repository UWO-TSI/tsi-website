"use client";

/**
 * Shared island atmosphere: the applicant-island lighting profile, real-time
 * phase, season and weather layers, and the follow camera. Used by the
 * village (DefaultIslandWorld) and the personal home island so both run on
 * the same light, time, season and weather systems (specs/homes.md §1).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import ContactShadows from "./ContactShadows";
import Puddles from "./Puddles";
import { setPuddles } from "@/lib/game/puddles";
import { CloudShadows, MistBanks, TreeLeaves } from "./AmbienceFX";
import { Fireflies } from "./AmbientLife";
import RainFX from "./RainFX";
import { applyEnvironment, disposeEnvironment } from "@/lib/game/envLight";
import { fireflyNight, type IslandLight } from "@/lib/game/islandLighting";
import { RIM_POSITION, fillForHeading, shadowHalfHeight } from "@/lib/game/lookPreset";
import { SEASON_TREES, type SeasonLook } from "@/lib/game/seasonalLook";
import type { IslandWeather } from "@/lib/game/islandWeather";
import type { IslandPhase } from "@/lib/game/islandTime";
import { setLeafTint, TREE_WIND, WORLD_SNOW } from "@/lib/game/modelMaterials";
import { TERRAIN_SNOW } from "./grid/GridTerrain";
import { WORLD_BEND } from "@/lib/game/curvedWorld";
import { worldTime } from "@/lib/game/worldClock";
import { sheddingTrees, worldWind } from "@/lib/game/worldFx";
import { juiceShake } from "@/lib/game/cameraJuice";
import { treeParts } from "./NatureModels";
import AmbientFauna, { type FaunaProps } from "./AmbientFauna";
import WeatherGround from "./WeatherGround";
import { autoFollow, capture, orbit, ORBIT_DISTANCE, orbitOffset, stepOrbit, turnOffset } from "@/lib/game/orbitCamera";
import { CROWN_REACH, CUT_FLOOR, CUT_RADIUS, CUTOUT, CUTOUT_CROWN, CUTOUT_VIEW, canopyAround, groundBlocks, lineBlocked, type Occluder } from "@/lib/game/occluders";
import { bendViewPoint } from "@/lib/game/worldProjection";
import { orbitKeys, useOrbitInput } from "./useOrbitInput";

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

/**
 * The backlit fill follows the camera (row 253, specs/camera-orbit.md): looking toward the sun the fronts you see are
 * lit by fill alone, so it rises; turned away it settles. Module scope: the react compiler forbids writing through
 * hook values.
 */
function turnFill(light: IslandLight, scene: THREE.Scene, ambient: THREE.AmbientLight | null, hemisphere: THREE.HemisphereLight | null) {
  const k = fillForHeading(light, orbit.view.yaw);
  if (ambient) ambient.intensity = light.ambient * k;
  if (hemisphere) hemisphere.intensity = light.hemisphere * k;
  if (scene.environment) scene.environmentIntensity = light.environment.intensity * k;
}

/** A tree on the map as the scene draws it (NatureTree): its spot and seed. */
export interface TreeSpot { x: number; z: number; seed: number }
const NO_TREES: readonly TreeSpot[] = [];

export function IslandAtmosphere({ phase, light, look, weather, liteMode, castShadows, overview = false, overviewFog = 0, ground, puddles = [], cloudSize, shadowExtent = 26, fireflyAnchors, trees = NO_TREES, fauna }: {
  phase: IslandPhase; light: IslandLight; look: SeasonLook; weather: IslandWeather; liteMode: boolean; castShadows: boolean; overview?: boolean;
  /** Extra overview fog distance: a bigger island puts the overview camera further out. */
  overviewFog?: number;
  ground: (x: number, z: number) => number;
  puddles?: readonly [number, number][]; cloudSize: [number, number]; shadowExtent?: number;
  fireflyAnchors: readonly (readonly [number, number])[];
  /** The scene's trees: the ones that shed this season drop leaves or petals. */
  trees?: readonly TreeSpot[];
  /** The island's ambient life (gulls, butterflies, dragonflies, crabs, leaping fish: AmbientFauna) and its ground for the weather (WeatherGround). */
  fauna?: FaunaProps;
}) {
  const { gl, scene } = useThree();
  useEffect(() => { TERRAIN_SNOW.value = look.snow; WORLD_SNOW.value = look.snow; setLeafTint(look.leaf); }, [look.snow, look.leaf]);
  useEffect(() => () => { TERRAIN_SNOW.value = 0; WORLD_SNOW.value = 0; }, []);
  useEffect(() => {
    applyEnvironment(gl, scene, light.environment);
    return () => disposeEnvironment(scene);
  }, [gl, scene, light]);
  const ambient = useRef<THREE.AmbientLight>(null), hemisphere = useRef<THREE.HemisphereLight>(null);
  useFrame(() => turnFill(light, scene, ambient.current, hemisphere.current));
  const { shadow } = light, shadowHalf = shadowHalfHeight(light.sunPosition, shadowExtent);
  // One world wind from the shared weather: rain slant, leaves and mist agree.
  const wind = useMemo(() => worldWind(weather), [weather]);
  const leafTrees = useMemo(() => {
    const models = SEASON_TREES[look.season];
    return sheddingTrees(trees.map(t => { const [tree] = treeParts(t.seed, models); return { x: t.x, y: ground(t.x, t.z), z: t.z, model: tree.url, scale: tree.scale }; }), look.season);
  }, [trees, ground, look.season]);
  const groundSite = useMemo(() => fauna && { map: fauna.site.map, ground, surface: fauna.surface, top: fauna.top, player: fauna.player }, [fauna, ground]);
  const puddleBlobs = useMemo(() => puddles.map(([x, z], i) => ({ x, z, y: ground(x, z) + 0.01, rx: 0.5 + (i % 3) * 0.18, rz: 0.32 + (i % 2) * 0.12, yaw: 0 })), [puddles, ground]);
  // Footsteps splash in them while it rains (lib/game/puddles.ts), whoever steps.
  useEffect(() => { setPuddles(weather === "rain" ? puddleBlobs : []); return () => setPuddles([]); }, [weather, puddleBlobs]);
  return <>
    {light.skyTop ? <SkyGradient top={light.skyTop} horizon={light.sky} /> : <color attach="background" args={[light.sky]} />}
    <fog attach="fog" args={[light.fogColor, overview ? light.fogNear + 28 + overviewFog : light.fogNear, overview ? light.fogFar + 15 + overviewFog : light.fogFar]} />
    <ambientLight ref={ambient} intensity={light.ambient} color={light.fill} />
    <hemisphereLight ref={hemisphere} args={[light.fill, light.bounce, light.hemisphere]} />
    <directionalLight name="sun" position={light.sunPosition} color={light.sun} intensity={light.sunIntensity} castShadow={castShadows}
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-shadowExtent} shadow-camera-right={shadowExtent}
      shadow-camera-top={shadowHalf} shadow-camera-bottom={-shadowHalf} shadow-camera-near={1} shadow-camera-far={75 + Math.max(0, shadowExtent - 26) * 2}
      onUpdate={key => key.shadow.camera.updateProjectionMatrix()}
      shadow-radius={shadow.radius} shadow-intensity={shadow.intensity} shadow-normalBias={0.02} shadow-bias={-0.0002} />
    {light.rim && <directionalLight position={RIM_POSITION} color={light.rim.color} intensity={light.rim.intensity} />}
    {!liteMode && <CloudShadows phase={phase} size={cloudSize} bounded />}
    {(weather === "rain" || weather === "snow") && <RainFX kind={weather} wind={wind} groundHeight={ground} />}
    <ContactShadows tint={shadow.tint} intensity={shadow.intensity} sunMap={castShadows} />
    {weather === "rain" && puddleBlobs.length > 0 && <Puddles spots={puddleBlobs} />}
    {weather === "fog" && <MistBanks color={light.sky} opacity={liteMode ? 0.22 : 0.34} wind={wind} ground={ground} />}
    {!liteMode && weather !== "rain" && weather !== "snow" && (look.season === "spring" || look.season === "autumn") &&
      <TreeLeaves trees={leafTrees} mode={look.season === "spring" ? "petals" : "leaves"} wind={wind} ground={ground} />}
    <TreeWind strength={liteMode ? 0 : weather === "wind" ? 0.14 : 0.035} />
    {fauna && <AmbientFauna {...fauna} season={look.season} weather={weather} liteMode={liteMode} />}
    {fauna && <WeatherGround site={groundSite!} rain={weather === "rain"} snow={look.snow >= 0.5} puddles={puddleBlobs} />}
    {fireflyNight(light, weather) && <Fireflies anchors={fireflyAnchors} count={liteMode ? 8 : fireflyAnchors.length * 2} groundHeight={ground} />}
  </>;
}

type Overview = { focus: [number, number, number]; offset: [number, number, number]; far?: number };
/** What the rig knows of the scene: the ground (it keeps above it), the player and what can stand in the way of them. */
export interface FollowScene {
  ground: (x: number, z: number) => number; player: React.RefObject<THREE.Vector3>; occluders: readonly Occluder[];
  /** A weapon is out (the ruins): while mouse-look holds the crosshair, the view looks further ahead so it sits past you. */
  aim?: boolean;
}
/** How far ahead of the focus the camera looks: walking, and aiming with the crosshair (the crosshair clears your head and its ground point lands about 3 ahead; further, you would sink behind the combat HUD). */
const LOOK_AHEAD = 1.5, AIM_AHEAD = 2.2;
/** The top of the head over the feet (a character stands 1.36): the cut also follows the line of sight to it. */
const HEAD = 1.3;
/** The least height the camera keeps over the ground under it (a hill or cliff behind you lifts it, never through). */
const CLEARANCE = 0.8;
/**
 * The follow camera (specs/movement.md, rows 250, 251; specs/camera-orbit.md): the shipped framing, ORBIT_DISTANCE ×
 * zoom from a point 0.7 up and 1.5 ahead of the focus the player's avatar writes (a lead along its velocity, the
 * level it stands on), set rigidly on it so it neither lags at top speed nor bobs on hops, plus any shake
 * (cameraJuice). It turns with the orbit (mouse-look, the arrows, two fingers; useOrbitInput): yaw 0 at the default
 * tilt is today's west-facing view, exactly. The zoom prop (a welcome close-up, ?zoom=) times the orbit's own
 * (wheel, Z), and the overview (`far`: its far plane, for a big island; its eye circles the island with the yaw)
 * ease in and out. `scene` keeps the camera above the terrain behind you and fades what stands between it and the
 * player (lib/game/occluders.ts).
 */
export function useFollowCamera(focus: React.RefObject<THREE.Vector3>, zoom: number, overview: Overview | null, scene?: FollowScene) {
  const { camera } = useThree();
  useOrbitInput();
  const rig = useMemo(() => ({ ahead: LOOK_AHEAD, cut: 0, chest: new THREE.Vector3(), head: new THREE.Vector3(), last: new THREE.Vector3(NaN, 0, 0), vx: 0, vz: 0 }), []);
  useEffect(() => () => { CUTOUT.value.w = 0; CUTOUT_CROWN.value.x = 0; }, []);
  const baseFar = useRef<number | null>(null);
  const blend = useRef({ zoom, overview: overview ? 1 : 0, last: overview });
  const look = useMemo(() => new THREE.Vector3(), []);
  const far = useMemo(() => ({ at: new THREE.Vector3(), look: new THREE.Vector3() }), []);
  const shake = useMemo(() => ({ x: 0, y: 0 }), []);
  useFrame((_, delta) => {
    const b = blend.current, dt = Math.min(delta, 0.1), f = focus.current;
    b.last = overview ?? b.last;
    b.zoom = THREE.MathUtils.damp(b.zoom, zoom, 5, dt);
    b.overview = THREE.MathUtils.damp(b.overview, overview ? 1 : 0, 5, dt);
    if (!overview && b.overview < 1e-3) b.overview = 0;
    // A big island's overview needs a deeper far plane; walking keeps the canvas's own.
    if (camera instanceof THREE.PerspectiveCamera) {
      baseFar.current ??= camera.far;
      const plane = Math.max(baseFar.current, b.overview > 0 ? b.last?.far ?? 0 : 0);
      if (camera.far !== plane) { camera.far = plane; camera.updateProjectionMatrix(); }
    }
    juiceShake(dt, shake);
    // Gentle auto-follow (row 282): the player's travel, from where they are drawn (a jump of a teleport or a respawn is no run).
    const p = scene?.player.current;
    if (p && dt > 0) {
      const mx = (p.x - rig.last.x) / dt, mz = (p.z - rig.last.z) / dt, ok = Number.isFinite(mx) && Math.hypot(mx, mz) < 40;
      rig.vx = THREE.MathUtils.damp(rig.vx, ok ? mx : 0, 10, dt); rig.vz = THREE.MathUtils.damp(rig.vz, ok ? mz : 0, 10, dt);
      rig.last.copy(p);
    }
    const free = capture.state !== "cursor" && capture.state !== "menu" && !(scene?.aim && capture.state === "captured");
    autoFollow(dt, rig.vx, rig.vz, free && b.overview === 0);
    const v = stepOrbit(dt, orbitKeys), sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
    rig.ahead = THREE.MathUtils.damp(rig.ahead, scene?.aim && capture.state === "captured" ? AIM_AHEAD : LOOK_AHEAD, 6, dt);
    // The shake is across the screen and up; at yaw 0 that is world x, as before.
    look.set(f.x + sy * rig.ahead + cy * shake.x, f.y + 0.7 + shake.y, f.z + cy * rig.ahead - sy * shake.x);
    const [ox, oy, oz] = orbitOffset(v.yaw, v.pitch, ORBIT_DISTANCE * b.zoom * v.zoom);
    camera.position.set(look.x + ox, look.y + oy, look.z + oz);
    if (scene) camera.position.y = Math.max(camera.position.y, scene.ground(camera.position.x, camera.position.z) + CLEARANCE);
    const o = b.last;
    if (b.overview > 0 && o) {
      const [tx, tz] = turnOffset(o.offset[0], o.offset[2], v.yaw);
      far.at.set(tx + o.focus[0], o.offset[1], tz + o.focus[2]);
      far.look.set(...o.focus);
      far.look.y -= far.at.distanceToSquared(far.look) * WORLD_BEND;
      camera.position.lerp(far.at, b.overview);
      look.lerp(far.look, b.overview);
    }
    camera.lookAt(look);
    camera.updateMatrixWorld();
    // A building, tree or cliff on the line of sight to the player's chest or head eases the cut in; the circle sits where they are drawn.
    if (!p || !(camera instanceof THREE.PerspectiveCamera)) return;
    const c = rig.chest.set(p.x, p.y + 1, p.z), h = rig.head.set(p.x, p.y + HEAD, p.z), list = scene!.occluders;
    const crown = b.overview === 0 && canopyAround(h, list);
    const blocked = b.overview === 0 && (crown || lineBlocked(camera.position, c, list) || lineBlocked(camera.position, h, list) || groundBlocks(camera.position, c, scene!.ground));
    rig.cut = THREE.MathUtils.damp(rig.cut, blocked ? 1 : 0, 8, dt);
    c.applyMatrix4(camera.matrixWorldInverse);
    const depth = -c.z;
    bendViewPoint(c).applyMatrix4(camera.projectionMatrix);
    CUTOUT.value.set(c.x, c.y, CUT_RADIUS / (depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))), rig.cut < 0.01 ? 0 : rig.cut);
    CUTOUT_VIEW.value.set(camera.aspect, depth, p.y + CUT_FLOOR);
    // In a tree's crown the leaves round the head are at the player's own depth: cut those too, above the chest.
    CUTOUT_CROWN.value.set(crown ? depth + CROWN_REACH : 0, p.y + 1);
  }, -3);
}
