"use client";

import { Suspense, useRef, useState, useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls, Html } from "@react-three/drei";
import { Smile, BookOpen, Map as MapIcon, Settings2, Keyboard } from "lucide-react";
import * as THREE from "three";
import PlayerAvatar from "./PlayerAvatar";
import Building from "./Building";
import River, { sampleRiverPoint, findRiverTForX } from "./River";
import Ocean from "./Ocean";
import TreeShakeFX from "./TreeShakeFX";
import { useTransition } from "./TransitionOverlay";
import FlowerPickFX from "./FlowerPickFX";
import FishCatchFX from "./FishCatchFX";
import { pickFlower, subscribeFlowerPicks, getPickedSnapshot, getPickedServerSnapshot } from "@/lib/game/flowerPicks";
import { getTerrainHeight, valueNoise, BUILDING_FOOTPRINTS } from "./terrain";
import { GLBProp, NatureMushroom, NatureStump } from "./NatureModels";
import InstancedGLB, { type NaturePlacement } from "./InstancedNature";
import AmbientProps from "./AmbientProps";
import BlobShadows from "./BlobShadows";
import ToastHub from "./ToastHub";
import MiniMap from "./MiniMap";
import { AudioManager } from "@/lib/game/audio";
import { WarmupProbe, LoadGateOverlay } from "./LoadGate";
import RainFX from "./RainFX";
import { getTodayWeather, type Weather } from "@/lib/game/weather";
import { coastDist, beachWidthShift, COAST_GLSL } from "@/lib/game/coast";
import { CloudShadows, NightStars, WaterSparkles, LeafGusts, NightWindows, TargetGlow } from "./AmbienceFX";
import AmbientLife from "./AmbientLife";
import AudioController from "./AudioController";
import NPCChatOverlay from "./NPCChatOverlay";
import EmoteMenu from "./EmoteMenu";
import FishingOverlay from "./FishingOverlay";
import CollectionBook from "./CollectionBook";
import ControlsOverlay from "./ControlsOverlay";
import WelcomeOverlay from "./WelcomeOverlay";
import Compass from "./Compass";
import StatsHUD from "./StatsHUD";
import Crosshair from "./Crosshair";
import DebugOverlay, { type DebugSnapshot } from "./DebugOverlay";
import PostFX from "./PostFX";
import ServerListOverlay from "./ServerListOverlay";
import GuestbookOverlay from "@/components/portal/GuestbookOverlay";
import NPC from "./NPC";
import GhostReplay from "./GhostReplay";
import { useUser } from "@/components/portal/UserContext";
import { useActivePalette, useEmoteTypes, useNPCPersonas } from "@/lib/game/contentLoader";
import { getGrassTexture } from "@/lib/game/grassTexture";
import { usePositionHeartbeat } from "@/lib/game/usePositionHeartbeat";
import { useGhostPositions } from "@/lib/game/useGhostPositions";
import { useLiteMode } from "@/lib/game/useLiteMode";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import GraphicsSettingsPanel from "./GraphicsSettings";
import ToolDock from "./ToolDock";
import OverlaySheet, { sheetKeyForHref, type SheetKey } from "./OverlaySheet";
import Critters from "./Critters";
import HQInterior from "./HQInterior";
import ShopInterior from "./ShopInterior";
import OracleInterior from "./OracleInterior";
import type { InteriorStation } from "./interiorShared";
import RoadTiles from "./RoadTiles";
import GrassTufts from "./GrassTufts";
import ToolFlourish from "./ToolFlourish";
import RiverMouths from "./RiverMouths";
import ShoreLife from "./ShoreLife";
import BeachCove, { BEACH_PALM_XZ } from "./BeachCove";
import SeasonalProps from "./SeasonalProps";
import Landmarks from "./Landmarks";
import { getActiveCritters } from "@/lib/game/critterStore";
import { applyEnvironment, disposeEnvironment } from "@/lib/game/envLight";
import { useGhostReplaySetting } from "@/lib/game/useGhostReplaySetting";
// P15: side-effect import kicks off useGLTF.preload for buildings + nature
// at module parse time, so first-render Suspense doesn't flash fallback
// procedural geometry over real GLBs.
import "@/lib/game/glbPreload";
// V1: curved-world chunk patch — must import before any material compiles.
import "@/lib/game/curvedWorld";
import type { EmoteType, NPCPersona, SpawnZone } from "@/lib/game/contentTypes";

/**
 * Game World v2 — Animal Crossing: New Horizons visual style.
 * Implements specs/ux-game-world-v2.md EXACTLY.
 *
 * Palette, camera, lighting, terrain, river, bridge, trees, bushes,
 * flowers, props all sourced from the v2 spec hex values.
 */

// ─── Palette from v2 spec Section 3 ────────────────────────────
const P = {
  skyTop: "#87CEEB", skyBottom: "#B8E4F0",
  // NL bright grade 2026-07-07: grass is the hero color — yellower and a
  // touch more saturated than the old blue-leaning greens.
  grassPrimary: "#84CB47", grassSecondary: "#75BC39", grassHighlight: "#9CDF5F", grassShadow: "#63A82F",
  dirtPath: "#C4A265", dirtPathEdge: "#B39355", stonePath: "#B8B0A0",
  riverSurface: "#5BB8D4", riverDeep: "#3A8FB0", riverEdge: "#7CCCE5", riverbed: "#A08B65",
  pondSurface: "#6DC4D8",
  trunk: "#8B6B4A", barkDetail: "#6B5238",
  foliage: "#4DAF4A", foliageHighlight: "#6BC867", foliageShadow: "#3A8838",
  pine: "#3D7A3D", bush: "#5CB85C", bushFlower: "#FF6B8A",
  flowerRed: "#E85050", flowerPink: "#FF8CB0", flowerYellow: "#FFD166",
  flowerWhite: "#F5F5F5", flowerBlue: "#6BA3D6", flowerPurple: "#9B6BB0", flowerOrange: "#FF9944",
  fence: "#B8935A", stoneFence: "#A8A090", lampPost: "#3D3D3D", lampGlow: "#FFE4B0",
  benchWood: "#B8935A", bridgeWood: "#A07850", bridgeRope: "#C4B090",
  wellStone: "#9B9080", stumpBrown: "#8B6B4A",
  windowGlass: "#B8E4F0", windowFrame: "#FFFFFF", chimney: "#C4A265", doorFrame: "#6B4226",
  // NL bright: fog tinted to horizon sky, not gray-green soup.
  fog: "#CDEBF7",
};

// ─── Building config per v2 spec Section 6 ──────────────────────
const BUILDINGS = [
  // Sizes track the ACNH model visuals (0.1 × source bbox) so labels and
  // E-prompts float at the right height. Position = door plane (model origin).
  { id: "hq", name: "HQ", position: [0, 0, -4] as [number, number, number], size: [6.1, 4.8, 3] as [number, number, number], color: "#FFF5E1", roofColor: "#E87B5A", href: undefined, interior: "hq" as const },
  { id: "shop", name: "Shop", position: [-24, 0, 12] as [number, number, number], size: [6.6, 3.5, 3.6] as [number, number, number], color: "#D4EAD4", roofColor: "#5BA086", href: undefined, interior: "shop" as const },
  { id: "oracle", name: "Oracle Temple", position: [0, 3, 30] as [number, number, number], size: [6.8, 3.9, 3.4] as [number, number, number], color: "#E8DCF0", roofColor: "#7B5EA7", href: undefined, interior: "oracle" as const },
  { id: "house", name: "House", position: [24, 0, 14] as [number, number, number], size: [5, 4.1, 3.1] as [number, number, number], color: "#C8E6C9", roofColor: "#7EB8C9", href: undefined },
  { id: "bounty", name: "Bounty Board", position: [14, 0, 9] as [number, number, number], size: [1.5, 1.8, 0.3] as [number, number, number], color: P.dirtPath, href: "/student/dashboard/bounty" },
  { id: "jobs", name: "Job Board", position: [-15, 0, -13] as [number, number, number], size: [1.5, 1.8, 0.3] as [number, number, number], color: P.dirtPath, href: "/student/dashboard/jobs" },
  { id: "leaderboard", name: "Leaderboard", position: [15, 0, -13] as [number, number, number], size: [1.2, 2.5, 1.2] as [number, number, number], color: P.wellStone, href: "/student/dashboard/leaderboard" },
];

const SPAWN_POSITION: [number, number, number] = [0, 0, -15];

// ─── Time-of-Day (v2 spec Section 8.1) ──────────────────────────
// [hour, skyTop, skyBottom, sunColor, sunIntensity, ambientColor, ambientIntensity]
// Cozy push 2026-07-03: day keys re-graded toward ACNH pastels — saturated
// azure tops, soft mint-cream horizons (the old #B8E4F0 horizon doubled as
// the fog color and read as gray soup), warm golden sun instead of pure
// white, ambient lifted slightly so default-on soft shadows stay gentle.
// Art pass 2026-07-07 (New Leaf bright): the old warm-cream day sun over
// lavender ambient mixed to olive on the ACNH albedos ("muddy"). NL's
// actual daytime read is a near-WHITE sun, clean sky-blue ambient bounce,
// and the saturated grass doing the color work. Tone mapping also moved
// ACES→None (ACES desaturates midtones — a second muddiness source).
const TOD_KEYS: [number, string, string, string, number, string, number][] = [
  [5,  "#FFB878", "#FFDDB8", "#FFD9B0", 0.55, "#C8BCFF", 0.42],
  [7,  "#63C2F7", "#BEE4EE", "#FFF9E8", 0.9,  "#CFE7FF", 0.58],
  [10, "#4FB6F5", "#A9DCF2", "#FFFDF4", 0.95, "#D6ECFF", 0.6],
  [15, "#57B9F0", "#E8EDD8", "#FFF6DE", 0.85, "#DDE3D2", 0.58],
  [17, "#FF9966", "#FFD4A8", "#FFC080", 0.65, "#FFD4A8", 0.42],
  [19, "#FF9966", "#2D2D6B", "#FF8844", 0.3,  "#6B5A8B", 0.3],
  [21, "#1A1A40", "#2D2D6B", "#334466", 0.0,  "#334466", 0.25],
];
const _tc = new THREE.Color();

const _sunPos = new THREE.Vector3();

/**
 * Sun + moon direction from wall-clock hour.
 *
 * R3-3 (P12 + P17 redo): two prior attempts billboard-meshed the disc as
 * scene geometry and lost the frustum / blended into fog. This time the
 * disc lives inside the sky shader so it's always rendered, additive over
 * the gradient, never clipped by camera-far.
 *
 * Northern-hemisphere convention: noon → sun is high in the southern sky;
 * midnight → moon is high. The sun arcs east→south→west, moon arcs the
 * opposite half of the day. Both are unit vectors in world space.
 */
function computeSunMoonDirs(hour: number): { sunDir: THREE.Vector3; moonDir: THREE.Vector3 } {
  // Sun parameter s: 0 at sunrise (6), 0.5 at noon (12), 1 at sunset (18).
  // Outside 6→18 the sun is below the horizon — we still emit a dir but the
  // visibility uniform drops to 0 so the disc doesn't show. Moon is the
  // antipode (180° offset) so when the sun sets the moon rises.
  const s = (hour - 6) / 12; // 6→0, 12→0.5, 18→1
  const azimuthDeg = -90 + s * 180; // east (-90) → south (0) → west (+90)
  // Elevation rides a low 5-13° band (was 0-60°). W18-1: the camera rig is
  // pitched down at the player and only a thin sky sliver above the fog line
  // is ever in frame, so a high sun was invisible every hour of the day. The
  // floor keeps the disc above the fog-terrain silhouette at dawn/dusk; the
  // 13° peak keeps noon inside the visible band. Reads as a stylized
  // low-hanging PS1 sun arcing east → south → west.
  // Camera-pinned dome (2026-07-12): view direction == dome direction now,
  // and the default pose tops out ~3° above the geometric horizon. The old
  // 3-8° band (tuned for the origin-anchored dome) parked the sun just out
  // of frame all day. 1.5-3.5° keeps the sprite's upper half in the visible
  // sliver across the arc.
  const elevationDeg = 1.5 + Math.sin(s * Math.PI) * 2;
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  // World axes: +X east, +Y up, -Z south (because spec puts Oracle Temple at +Z
  // labeled "north" via the compass — see CompassFeed). atan2(fwd.x, fwd.z) +
  // π maps so south sun = +Z. We aim sun toward +Z at az=0.
  const sunDir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  // Moon is the antipode in azimuth + mirrored elevation about the hour
  // 12 offset. Simplest stable form: rotate sun dir 180° around Y and lift it
  // by the night-portion elevation. At hour=0 (midnight), sun is far below
  // the horizon at south; moon is high above the south.
  const ns = (((hour + 12) % 24) - 6) / 12; // moon equivalent of s
  const mAz = (-90 + ns * 180) * Math.PI / 180;
  const mEl = (1.5 + Math.sin(ns * Math.PI) * 2) * Math.PI / 180; // same low band as the sun
  const moonDir = new THREE.Vector3(
    Math.sin(mAz) * Math.cos(mEl),
    Math.sin(mEl),
    Math.cos(mAz) * Math.cos(mEl),
  );
  return { sunDir, moonDir };
}

function TimeOfDayCycle({ weather, todPhase, shadowsOn, playerPosRef }: { weather: Weather; todPhase: "day" | "night" | "dawn" | "dusk"; shadowsOn: boolean; playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
  const { scene } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  // Sky system 2026-07-12 (David-approved): painted equirect panoramas on a
  // CAMERA-PINNED dome (sky never translates → reads infinitely far), all
  // four time-of-day textures bound at once and crossfaded via a vec4
  // weight uniform (mutated with .value.set(), never reassigned — the
  // established compiler-safe pattern). A slightly smaller cloud shell
  // drifts independently for parallax wind. Sun/moon are ACNH sprites now;
  // the old in-shader discs are gone. Placeholder skies are baked from the
  // TOD palette — David's AI art drops into /assets/sky/ as a file swap.
  const skyTextures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const load = (url: string, wrap = false) => {
      const t = loader.load(url);
      t.colorSpace = THREE.SRGBColorSpace;
      if (wrap) t.wrapS = THREE.RepeatWrapping;
      return t;
    };
    // Rain days v1: same four phases, weather picks the texture set.
    // File contract: /assets/sky/sky_{time}_{weather}.webp. Cloudy (v2)
    // reuses the sunny panoramas — the denser, darker cloud shell and
    // dimmed sun carry the overcast read until David's cloudy art lands.
    const texWeather = weather === "cloudy" ? "sunny" : weather;
    return {
      phases: [
        load(`/assets/sky/sky_morning_${texWeather}.webp`),
        load(`/assets/sky/sky_afternoon_${texWeather}.webp`),
        load(`/assets/sky/sky_evening_${texWeather}.webp`),
        load(`/assets/sky/sky_night_${texWeather}.webp`),
      ],
      clouds: load("/assets/sky/clouds.webp", true),
      sun: load("/assets/sky/sun.png"),
      moon: load("/assets/sky/moon.png"),
    };
  }, [weather]);

  const skyMat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      t0: { value: skyTextures.phases[0] },
      t1: { value: skyTextures.phases[1] },
      t2: { value: skyTextures.phases[2] },
      t3: { value: skyTextures.phases[3] },
      weights: { value: new THREE.Vector4(0, 1, 0, 0) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D t0, t1, t2, t3;
      uniform vec4 weights;
      varying vec2 vUv;
      void main(){
        vec3 col = texture2D(t0, vUv).rgb * weights.x
                 + texture2D(t1, vUv).rgb * weights.y
                 + texture2D(t2, vUv).rgb * weights.z
                 + texture2D(t3, vUv).rgb * weights.w;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }), [skyTextures]);

  const cloudMat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, transparent: true,
    uniforms: {
      tex: { value: skyTextures.clouds },
      // x = u-offset (drift), y = opacity, z = brightness tint
      params: { value: new THREE.Vector4(0, 0.85, 1, 0) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D tex;
      uniform vec4 params;
      varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tex, vec2(vUv.x + params.x, vUv.y));
        gl_FragColor = vec4(c.rgb * params.z, c.a * params.y);
      }
    `,
  }), [skyTextures]);

  const skyGroupRef = useRef<THREE.Group>(null);
  const sunSpriteRef = useRef<THREE.Sprite>(null);
  const moonSpriteRef = useRef<THREE.Sprite>(null);
  const { camera: skyCam, gl } = useThree();

  // P3 (2026-07-13): ACNH cozy-reflection pass — PMREM environment baked
  // from the TOD palette, regenerated only on phase flips. Every standard
  // material picks up sky-colored ambience + a warm sun glint.
  useEffect(() => {
    applyEnvironment(gl, scene, todPhase);
  }, [gl, scene, todPhase]);
  // shadow target follows the player; three needs the target in the graph
  useEffect(() => {
    const sun = sunRef.current;
    if (!sun) return;
    scene.add(sun.target);
    return () => { scene.remove(sun.target); };
  }, [scene]);
  useEffect(() => () => disposeEnvironment(scene), [scene]);

  useFrame(() => {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;

    // Find bounding keyframes
    let ai = TOD_KEYS.length - 1, bi = 0;
    for (let i = 0; i < TOD_KEYS.length - 1; i++) {
      if (h >= TOD_KEYS[i][0] && h < TOD_KEYS[i + 1][0]) { ai = i; bi = i + 1; break; }
    }
    const a = TOD_KEYS[ai], b = TOD_KEYS[bi];

    let t: number;
    if (ai < bi) {
      t = (h - a[0]) / (b[0] - a[0]);
    } else {
      // Night→Dawn wrap (21→5)
      const span = (24 - a[0]) + b[0];
      t = (h >= a[0] ? h - a[0] : h + 24 - a[0]) / span;
    }
    t = THREE.MathUtils.clamp(t, 0, 1);

    // Sky crossfade: map the hour onto the four panoramas with 1.5h blend
    // windows (morning 5-10, afternoon 10-17, evening 17-20.5, night rest).
    {
      const EDGES = [5, 10, 17, 20.5]; // segment starts for tex 0..3
      const BLEND = 1.5;
      let wi = 3; // default night
      for (let i = 0; i < 4; i++) {
        const from = EDGES[i];
        const to = EDGES[(i + 1) % 4];
        const inSeg = from < to ? h >= from && h < to : h >= from || h < to;
        if (inSeg) { wi = i; break; }
      }
      const next = (wi + 1) % 4;
      const nextEdge = EDGES[next];
      let until = nextEdge - h;
      if (until < 0) until += 24;
      const blend = until < BLEND ? 1 - until / BLEND : 0;
      const w = [0, 0, 0, 0];
      w[wi] = 1 - blend;
      w[next] = blend;
      skyMat.uniforms.weights.value.set(w[0], w[1], w[2], w[3]);
    }

    // R3-3: sun + moon orbit from wall-clock hour. We pull from the same
    // wall-clock the TOD palette already uses (`h`), so disc position
    // stays locked to the sky tone — at hour 17 (sunset key) the sun
    // sits near the west horizon, just above the orange band.
    const { sunDir, moonDir } = computeSunMoonDirs(h);
    // Visibility: sun only when it's above the horizon, moon only when
    // *it* is. A small smoothstep fade keeps the disc from popping at
    // y=0 (≈ sunrise/sunset edges where TOD_KEYS already lerps the sky).
    // We mutate the Vector4 in place via .set(...) so eslint
    // react-hooks/immutability stays happy (no property reassignment on
    // the uniforms object returned from useMemo).
    const sunVis = THREE.MathUtils.smoothstep(sunDir.y, -0.05, 0.15);
    const moonVis = THREE.MathUtils.smoothstep(moonDir.y, -0.05, 0.15);
    // Weather grades: rain flattens hard, cloudy softens.
    const wDim = weather === "rain" ? 0.5 : weather === "cloudy" ? 0.8 : 1;
    const wBody = weather === "rain" ? 0.08 : weather === "cloudy" ? 0.45 : 1;
    // ACNH sun/moon sprites ride the arc on the pinned dome.
    if (sunSpriteRef.current) {
      sunSpriteRef.current.position.copy(sunDir).multiplyScalar(200);
      (sunSpriteRef.current.material as THREE.SpriteMaterial).opacity = sunVis * wBody;
    }
    if (moonSpriteRef.current) {
      moonSpriteRef.current.position.copy(moonDir).multiplyScalar(200);
      (moonSpriteRef.current.material as THREE.SpriteMaterial).opacity = moonVis * 0.95 * wBody;
    }
    // Pin the whole sky to the camera: it rotates with the view but never
    // translates — the parallax contrast against the sliding world is what
    // sells infinite distance.
    if (skyGroupRef.current) skyGroupRef.current.position.copy(skyCam.position);
    // Cloud shell drift + day/night dimming. Rain: denser, darker, faster.
    {
      const sunI = (a[4] + (b[4] - a[4]) * t) * wDim;
      const prev = cloudMat.uniforms.params.value as THREE.Vector4;
      const drift = weather === "rain" ? 0.00003 : 0.000012;
      const cOpacity = weather === "rain" ? 0.95 : 0.85;
      // wave-26 follow-up: night clouds dimmed (0.45->0.32 floor)
      cloudMat.uniforms.params.value.set(prev.x + drift, cOpacity, (0.32 + sunI * 0.68) * (weather === "rain" ? 0.75 : 1), 0);
    }

    // Sun
    if (sunRef.current) {
      sunRef.current.color.set(a[3]).lerp(_tc.set(b[3]), t);
      sunRef.current.intensity = (a[4] + (b[4] - a[4]) * t) * wDim;
      // Cozy push 2026-07-03: the LIGHT rides a classic high arc (15-60°)
      // even though the visible DISC stays low (W18-1 keeps it in the
      // camera-reachable band). Sharing the low arc made midday light skim
      // from the horizon — flat, gloomy, and shadow streaks across the whole
      // village. Azimuth still tracks the disc so shadows lean the right way.
      const s = (h - 6) / 12;
      const lightEl = ((15 + Math.sin(Math.min(Math.max(s, 0), 1) * Math.PI) * 45) * Math.PI) / 180;
      const lightAz = ((-90 + s * 180) * Math.PI) / 180;
      _sunPos.set(
        Math.sin(lightAz) * Math.cos(lightEl),
        Math.sin(lightEl),
        Math.cos(lightAz) * Math.cos(lightEl)
      ).multiplyScalar(30);
      if (shadowsOn) {
        updateShadowRig(gl, sunRef.current, playerPosRef.current, _sunPos);
      } else {
        sunRef.current.position.copy(_sunPos);
      }
    }
    // Ambient
    if (ambRef.current) {
      ambRef.current.color.set(a[5]).lerp(_tc.set(b[5]), t);
      ambRef.current.intensity = (a[6] + (b[6] - a[6]) * t) * (weather === "rain" ? 0.85 : 1);
    }
    // Hemisphere rides the sun curve (art pass 2026-07-07): it was a
    // static 0.8, which kept night grass daylight-lit under the brighter
    // NL grade. 0.3 floor at night → ~0.82 at noon.
    if (hemiRef.current) {
      const sunI = (a[4] + (b[4] - a[4]) * t) * wDim;
      hemiRef.current.intensity = 0.3 + sunI * 0.55;
    }
    // Fog still follows the TOD horizon palette (the placeholder skies are
    // baked from the same table, so they stay in sync). Rain pulls it
    // toward the overcast gray so the haze matches the rain skies.
    if (scene.fog) {
      const f = (scene.fog as THREE.Fog).color.set(a[2]).lerp(_tc.set(b[2]), t);
      if (weather === "rain") f.lerp(_tc.set("#AAB2BC"), 0.65);
    }
  });

  return (
    <>
      <group ref={skyGroupRef}>
        <mesh scale={[240, 240, 240]} renderOrder={-3}>
          <sphereGeometry args={[1, 32, 24]} />
          <primitive object={skyMat} attach="material" />
        </mesh>
        <mesh scale={[226, 226, 226]} renderOrder={-2}>
          <sphereGeometry args={[1, 32, 24]} />
          <primitive object={cloudMat} attach="material" />
        </mesh>
        <sprite ref={sunSpriteRef} scale={[26, 26, 1]} renderOrder={-1}>
          <spriteMaterial map={skyTextures.sun} color="#FFEDB8" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
        </sprite>
        <sprite ref={moonSpriteRef} scale={[15, 15, 1]} renderOrder={-1}>
          <spriteMaterial map={skyTextures.moon} transparent opacity={0} depthWrite={false} fog={false} />
        </sprite>
      </group>
      <hemisphereLight ref={hemiRef} args={["#EAF6FF", P.grassPrimary, 0.8]} />
      <ambientLight ref={ambRef} intensity={0.5} color="#D6ECFF" />
      {/* P-light v2 (2026-07-13, ACNH lighting deep-dive): one soft PCF
          shadow map from the sun — buildings/trees/landmarks cast onto
          terrain+roads. ACNH shadows are never black: the strong
          ambient/hemi/IBL fill lifts them into warm sky-tinted shade.
          Gated by the shadows setting; blob discs remain the fallback.
          Bounds cover the respaced island (was ±30 pre-2026-07-07). */}
      <directionalLight
        ref={sunRef}
        color="#FFFFFF" intensity={1.0} position={[15, 30, 15]}
        castShadow={shadowsOn}
        shadow-mapSize-width={1024} shadow-mapSize-height={1024}
        shadow-camera-near={5} shadow-camera-far={90}
        shadow-camera-left={-22} shadow-camera-right={22}
        shadow-camera-top={22} shadow-camera-bottom={-22}
        shadow-bias={-0.0004} shadow-normalBias={0.03}
      />
      <directionalLight color="#C0D0FF" intensity={0.15} position={[-12, 18, -8]} />
    </>
  );
}


// ─── Terrain (v2 spec Section 4 — vertex-displaced rolling hills) ─
// The seasonal tint used to be the material's JSX color prop; with the
// wet-band material memoized imperatively, apply it as an effect.
function ApplyGrassTint({ material, tint }: { material: THREE.MeshStandardMaterial; tint: THREE.Color }) {
  useEffect(() => {
    material.color.copy(tint);
  }, [material, tint]);
  return null;
}

function Terrain() {
  const geometry = useMemo(() => {
    const size = 108; // island respace 2026-07-07 (radius 52)
    const segments = 156;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c1 = new THREE.Color(P.grassPrimary);
    const c2 = new THREE.Color(P.grassSecondary);
    const cH = new THREE.Color(P.grassHighlight);
    const cS = new THREE.Color(P.grassShadow);
    const tmp = new THREE.Color();

    // Task 27 (2026-07-12, David: "make game border with ocean… non buggy"):
    // beyond SINK_START the square plane's rim dives below the ocean
    // surface as a sand ring. Organic coast (2026-07-14, David: "not just
    // a circle"): the silhouette follows coastDist — a radial harmonic
    // wobble (lib/game/coast.ts) shared with the ocean foam shader, the
    // beach placements, and the player clamp. Purely cosmetic — logical
    // heights (walk/click) still come from terrain.ts.
    const SINK_START = 49.5;
    const SINK_END = 56;
    const SINK_DEPTH = 2.4;
    const cSand = new THREE.Color("#E2CB93");
    const cSoil = new THREE.Color("#7A5C43");

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = coastDist(x, z);
      const h = getTerrainHeight(x, z);
      let y = h;
      if (dist > SINK_START) {
        const t = Math.min((dist - SINK_START) / (SINK_END - SINK_START), 1);
        const sm = t * t * (3 - 2 * t);
        y = h - sm * SINK_DEPTH;
      }
      pos.setY(i, y);

      // Vertex color: blend greens by height + noise variation.
      // A1 retune: amplitude is now ~0.6, so divide by 0.6 not 3.
      const cn = valueNoise(x * 0.15, z * 0.15);
      const hf = THREE.MathUtils.clamp(h / 0.6, 0, 1);

      if (hf > 0.5) {
        tmp.lerpColors(c1, cH, (hf - 0.5) * 2);
      } else if (cn > 0.6) {
        tmp.copy(cH);
      } else if (cn < 0.3) {
        tmp.copy(c2);
      } else {
        tmp.copy(c1);
      }

      // Beach width varies per angle (iteration 2): es shifts the color
      // bands only — wide sand sweeps on some stretches, grassy banks
      // nearly to the water on others. The waterline stays put.
      const es = dist + beachWidthShift(x, z);
      if (es > 46 && es <= 48.5) {
        tmp.lerp(cS, (es - 46) / 2.5 * 0.4);
      } else if (es > 48.5) {
        // grass → sand across the waterline, sand → wet soil underwater
        const sandT = Math.min((es - 48.5) / 2.2, 1);
        tmp.lerp(cSand, sandT * sandT * (3 - 2 * sandT));
        if (dist > 52.5) {
          tmp.lerp(cSoil, Math.min((dist - 52.5) / 3, 1));
        }
      }

      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  const grassTex = useMemo(() => getGrassTexture(), []);

  // Iteration 3 (organic loop): wet-sand lapping band. The beach darkens
  // in a breathing strip just inside the waterline, phase-matched to the
  // ocean's foam lap so the wash reads as one motion. Injected via the
  // material's own onBeforeCompile (the curved-world bend lives in the
  // global chunk patch, so this slot is free).
  const groundTime = useRef({ value: 0 });
  const groundMat = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: grassTex,
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = groundTime.current;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec2 vGroundXZ;`
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
vGroundXZ = (modelMatrix * vec4(position, 1.0)).xz;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform float uTime;
varying vec2 vGroundXZ;
${COAST_GLSL}`
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
{
  float e = length(vGroundXZ) - coastWobble(vGroundXZ);
  float lap = sin(vGroundXZ.x * 0.9 + vGroundXZ.y * 0.7 + uTime * 1.4) * 0.5;
  float wet = smoothstep(50.1 + lap, 51.2 + lap, e) * (1.0 - smoothstep(51.9, 52.6, e));
  diffuseColor.rgb *= 1.0 - wet * 0.16;
}`
        );
    };
    return mat;
  }, [grassTex]);
  useEffect(() => () => groundMat.dispose(), [groundMat]);
  useFrame((_, delta) => {
    groundTime.current.value += delta;
  });

  // G5 (item 26): seasonal ground tint. The admin palette's `grass` color
  // tints the whole island as a ratio against the base green — the default
  // palette is identity, a winter palette frosts the fields, autumn warms
  // them. Zero-code monthly content (principle #8).
  const { data: seasonalPalette } = useActivePalette();
  const grassTint = useMemo(() => {
    const base = new THREE.Color(P.grassPrimary);
    const target = new THREE.Color(seasonalPalette?.palette?.grass || P.grassPrimary);
    return new THREE.Color(
      Math.min(target.r / Math.max(base.r, 0.001), 1.6),
      Math.min(target.g / Math.max(base.g, 0.001), 1.6),
      Math.min(target.b / Math.max(base.b, 0.001), 1.6)
    );
  }, [seasonalPalette]);

  // P4 memory: dispose terrain geometry on unmount. Grass texture is
  // module-cached (shared across re-mounts) so we don't dispose it.
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <group>
      <mesh geometry={geometry} material={groundMat} receiveShadow />
      <ApplyGrassTint material={groundMat} tint={grassTint} />
      {/* Building slab patches — flat grass discs slightly above terrain so
          buildings sit flush with no visible seam. Sprint A1. */}
      {BUILDING_FOOTPRINTS.map((b, i) => {
        const y = getTerrainHeight(b.x, b.z);
        return (
          <mesh
            key={`slab-${i}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[b.x, y + 0.01, b.z]}
            receiveShadow
          >
            <circleGeometry args={[b.radius, 24]} />
            <meshStandardMaterial
              color={P.grassPrimary}
              roughness={0.92}
              metalness={0}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>
        );
      })}
      {/* Curved alpha-blended paths (sprint A2). PATH_CORRIDORS in terrain.ts
          still flatten these zones to y≈0 — control points stay within the
          ±1.75 halfWidth corridor + 1.5 falloff, so we never leave the flat
          band. See Path.tsx for the spline + soft-edge implementation. */}
      {/* P2 polish 2026-07-13: the painted ribbon paths are gone — real
          ACNH road tiles auto-tiled over the corridors (RoadTiles.tsx).
          Suspense: tile GLBs stream in behind the load gate. */}
      <Suspense fallback={null}>
        <RoadTiles />
        <GrassTufts />
      </Suspense>
    </group>
  );
}

// ─── Bridge (v2 spec Section 5.2) ────────────────────────────────
// Bridge sits where the river spline crosses the N-S path (x=0). We sample
// the spline once at module-load and orient the bridge along the river's
// tangent at that point. The bridge group spans the river width (~3.8) +
// some overhang. Sprint A3.
function Bridge() {
  const { position, rotation } = useMemo(() => {
    const t = findRiverTForX(0);
    const sample = sampleRiverPoint(t);
    // Bridge planks should run perpendicular to the river (i.e. parallel to
    // the path's N-S direction). The bridge's own +Z axis aligns with the
    // path. Rotate around Y so the bridge's local Z = river's normal.
    // Atan2 of the river tangent gives the river's heading; the bridge's
    // heading is perpendicular to that.
    const heading = Math.atan2(sample.tangent.x, sample.tangent.z);
    return {
      position: [sample.position.x, 0.06, sample.position.z] as [number, number, number],
      rotation: [0, heading + Math.PI / 2, 0] as [number, number, number],
    };
  }, []);

  return (
    <group position={position} rotation={rotation}>
      {/* ACNH wooden bridge GLB. Its span runs along local X; the group's
          local Z follows the path, so rotate 90°. Slightly sunk so the
          arched deck center meets the flat path level. */}
      <Suspense fallback={null}>
        <GLBProp url="/assets/acnh/props/bridge-wooden.glb" position={[0, 0.02, 0]} rotation={[0, Math.PI / 2, 0]} />
      </Suspense>
    </group>
  );
}

// (Lighting merged into TimeOfDayCycle above)

// (Tree component replaced by NatureTree from NatureModels.tsx)
// Then perf 2026-06-01: switched to InstancedGLB for ~5x fewer draws.
// ACNH revamp: entries that fell inside the carved river channel moved
// to the banks ([-20,5]→[-20,8.5], [20,5]→[20,7.5]).
const TREE_XZ: [number, number][] = [
  [-9, 20], [9, 20], [-26, 7], [26, 9],
  [-23, -7], [23, -7], [-7, -26], [7, -26],
  [-31, 16], [31, 16], [-13, 31], [15, 31],
  [-31, -12], [31, -13], [-18, -21], [18, 21],
  [-36, -2], [36, 8], [-10, 34], [10, 34],
];

// Tree model assignment by index mod 4 (preserves the old per-seed
// hash so visual output is stable). ACNH revamp 2026-07: hardwood x2 +
// blossom accent + cedar, already world-scale from the pipeline.
const TREE_MODELS = [
  "/assets/acnh/plants/tree-hardwood-a.glb",
  "/assets/acnh/plants/tree-hardwood-b.glb",
  "/assets/acnh/plants/tree-blossom.glb",
  "/assets/acnh/plants/tree-cedar.glb",
];

// P8 shadow split: trees within this radius of the spawn area cast shadows
// (visible in the player's typical view). Trees outside skip the shadow
// pass — saves ~2-3ms/frame on M1 ANGLE without visible loss (the fog at
// 25-55u masks distant shadow loss).
const TREE_SHADOW_RADIUS = 22;

function buildTreePlacements(): { near: NaturePlacement[][]; far: NaturePlacement[][] } {
  const near: NaturePlacement[][] = TREE_MODELS.map(() => []);
  const far: NaturePlacement[][] = TREE_MODELS.map(() => []);
  TREE_XZ.forEach(([x, z], i) => {
    const y = getTerrainHeight(x, z);
    const placement: NaturePlacement = {
      position: [x, y, z],
      rotation: (i * 137.5 * Math.PI) / 180,
      // ACNH models are true-scale (~2.7-4.1u); keep variance subtle.
      scale: 0.85 + (i % 5) * 0.08,
    };
    const bucket = Math.hypot(x, z) <= TREE_SHADOW_RADIUS ? near : far;
    bucket[i % TREE_MODELS.length].push(placement);
  });
  return { near, far };
}

function InstancedTrees() {
  const { near, far } = useMemo(() => buildTreePlacements(), []);
  // Art pass 2026-07-07: the old P18 "wind sway" rotated the WHOLE group
  // about the world origin, so every tree translated on a position-length
  // lever arm (±0.24u at r=27) — David's "trees floating and bopping".
  // Trees are static now, New Leaf style; wind stays implied by the
  // drifting-leaf particles in AmbientLife.
  return (
    <Suspense fallback={null}>
      <group>
        {TREE_MODELS.map((url, i) => (
          <InstancedGLB key={`near-${url}`} url={url} placements={near[i]} />
        ))}
        {TREE_MODELS.map((url, i) => (
          <InstancedGLB key={`far-${url}`} url={url} placements={far[i]} />
        ))}
      </group>
    </Suspense>
  );
}

// ─── Blob shadow placements (art pass 2026-07-07) ────────────────
// Everything static that needs grounding gets a soft disc. Prop coords
// that live in AmbientProps are mirrored here — keep in sync (both move
// together in the phase-C respace anyway).
function buildBlobPlacements(): import("./BlobShadows").BlobPlacement[] {
  const out: import("./BlobShadows").BlobPlacement[] = [];
  const add = (x: number, z: number, rx: number, rz = rx) =>
    out.push({ x, y: getTerrainHeight(x, z), z, rx, rz });

  TREE_XZ.forEach(([x, z]) => add(x, z, 0.9));
  BEACH_PALM_XZ.forEach(([x, z]) => add(x, z, 0.8));
  BUSH_XZ.forEach(([x, z]) => add(x, z, 0.55));
  for (const b of BUILDINGS) {
    if (b.size[2] < 1) add(b.position[0], b.position[2], 0.55, 0.35); // boards
    else add(b.position[0], b.position[2] + b.size[2] / 2, b.size[0] * 0.58, b.size[2] * 0.75);
  }
  add(-30, -18, 1.7, 2.7); // ambient house (red, rotated 90°)
  add(30, -19, 1.7, 2.7);  // ambient house (yellow)
  [[-3, -16], [3, -16], [-3.2, 13], [3.2, 13]].forEach(([x, z]) => add(x, z, 0.85, 0.5)); // benches
  LAMP_XZ.forEach(([x, z]) => add(x, z, 0.32));
  [[2.5, -7], [-21.5, 12], [2.5, 27], [1.5, -13.5]].forEach(([x, z]) => add(x, z, 0.32)); // door lanterns
  [[-2, 26.5], [2, 26.5]].forEach(([x, z]) => add(x, z, 0.38)); // stone lanterns
  add(3.2, 12.5, 0.4); // park clock
  add(-5, -14, 1.5);   // fountain
  add(4, -13.5, 0.85); // campfire
  [[-20, -16], [22, -24], [-26, 19]].forEach(([x, z]) => add(x, z, 0.35)); // stumps
  return out;
}

// ─── Bushes (v2 spec Section 7.2) ───────────────────────────────
// ACNH revamp: river-channel entries moved to banks
// ([-13,6]→[-17,1], [-22,3]→[-22,7.5], [22,3]→[22,7]).
const BUSH_XZ: [number, number][] = [
  [-6, -3], [6, -3], [-19, -2], [16, 7],
  [-4, -9], [4, -9], [-20, -4], [20, -4],
  [-9, 15], [9, 15], [0, -22], [-24, 16],
  [24, 18], [-8, -18], [8, -18], [-13, 18],
  [13, 18], [-28, 10], [28, 12], [0, 14],
];
const BUSH_MODELS = [
  "/assets/acnh/plants/bush-azalea.glb",
  "/assets/acnh/plants/bush-hydrangea.glb",
  "/assets/acnh/plants/bush-holly.glb",
];

// Bushes are short — they barely cast useful shadows even up close.
// Disable shadow casting entirely (~1.5ms/frame win on M1).
function buildBushPlacements(): NaturePlacement[][] {
  const groups: NaturePlacement[][] = BUSH_MODELS.map(() => []);
  BUSH_XZ.forEach(([x, z], i) => {
    groups[i % BUSH_MODELS.length].push({
      position: [x, getTerrainHeight(x, z), z],
      rotation: i * 1.3,
      scale: 0.9 + (i % 3) * 0.15,
    });
  });
  return groups;
}

function Bushes() {
  const groups = useMemo(() => buildBushPlacements(), []);
  return (
    <Suspense fallback={null}>
      {BUSH_MODELS.map((url, i) => (
        <InstancedGLB key={url} url={url} placements={groups[i]} castShadow={false} />
      ))}
    </Suspense>
  );
}

// ─── Flowers (v2 spec Section 7.3) ──────────────────────────────
// ACNH revamp: river-channel entries moved to banks
// ([4,6]→[7,6.8], [-11,5]→[-9,10.5], [13,4]→[16,-2]).
const FLOWER_XZ: [number, number][] = [
  [-5, -4], [8, 8], [-9, 13], [13, -5],
  [-3, 16], [7, -15], [-12, 12], [19, -3],
  [3, 20], [-7, -13], [10, 17], [-17, -8],
];
// ACNH flower species (bloom stage). The (seed + j) % length spread
// keeps clusters mixed regardless of list length.
const FLOWER_MODELS = [
  "/assets/acnh/plants/flower-cosmos.glb",
  "/assets/acnh/plants/flower-lily.glb",
  "/assets/acnh/plants/flower-hyacinth.glb",
  "/assets/acnh/plants/flower-mum.glb",
  "/assets/acnh/plants/flower-rose.glb",
  "/assets/acnh/plants/flower-tulip.glb",
  "/assets/acnh/plants/flower-pansy.glb",
  "/assets/acnh/plants/flower-windflower.glb",
];

function buildFlowerPlacements(picked: readonly number[]): NaturePlacement[][] {
  const groups: NaturePlacement[][] = FLOWER_MODELS.map(() => []);
  const pickedSet = new Set(picked);
  FLOWER_XZ.forEach(([x, z], seed) => {
    if (pickedSet.has(seed)) return; // G4: hidden until respawn
    const y = getTerrainHeight(x, z);
    // Each "cluster" was 3 sub-flowers — preserve that.
    for (let j = 0; j < 3; j++) {
      const model = (seed + j) % FLOWER_MODELS.length;
      groups[model].push({
        position: [x + (j - 1) * 0.4, y, z + (((j * 7 + seed) % 3) - 1) * 0.3],
        rotation: j * 2.1,
        scale: 0.8,
      });
    }
  });
  return groups;
}

function Flowers() {
  const picked = useSyncExternalStore(
    subscribeFlowerPicks,
    getPickedSnapshot,
    getPickedServerSnapshot,
  );
  const groups = useMemo(() => buildFlowerPlacements(picked), [picked]);
  return (
    <Suspense fallback={null}>
      {FLOWER_MODELS.map((url, i) => (
        <InstancedGLB key={url} url={url} placements={groups[i]} castShadow={false} />
      ))}
    </Suspense>
  );
}

// Butterflies migrated to AmbientLife.tsx (sprint A6 — day-only group with
// procedural wing-flap meshes + fireflies/leaves/birds for full ambient life).

// ─── Time-of-day phase helper (sprint A6) ───────────────────────
// TimeOfDayCycle reads wall-clock directly each frame; we mirror that here at
// a coarser interval so AmbientLife can swap day/night creatures without
// refactoring the cycle itself.
function hourToPhase(h: number): "day" | "night" | "dawn" | "dusk" {
  if (h >= 5 && h < 7) return "dawn";
  if (h >= 7 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

// Shared phase hook — used by Scene (for AmbientLife) and the outer GameWorld
// shell (for the DOM-mounted AudioController). 60s tick matches A6.
function useTodPhase(): "day" | "night" | "dawn" | "dusk" {
  const [phase, setPhase] = useState<"day" | "night" | "dawn" | "dusk">(() =>
    hourToPhase(new Date().getHours()),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setPhase(hourToPhase(new Date().getHours()));
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return phase;
}

// ─── Chimney Smoke (v2 spec Section 10 — slow upward drift) ─────
const SMOKE_COUNT = 20;
function ChimneySmoke() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SMOKE_COUNT * 3), 3));
    return g;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const pos = ref.current.geometry.attributes.position;
    const baseY = getTerrainHeight(0, -4) + 5.2;
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const age = (t * 0.3 + i / SMOKE_COUNT) % 1;
      pos.setXYZ(
        i,
        1.5 + Math.sin(t * 0.2 + i) * age * 0.5,
        baseY + age * 3,
        -5 + Math.cos(t * 0.15 + i * 0.7) * age * 0.3,
      );
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#D0C8C0" size={0.2} transparent opacity={0.3} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ─── Dust motes (P23) — pollen drifting near the player ─────────
// Small Points cloud parented to a Group that follows the player every
// frame. Per-vertex sine offsets give the motes lazy independent drift.
// 30 points is small enough to keep this under 0.1ms even on M1, and
// the sprite is a built-in PointsMaterial round dot — no texture load.
const DUST_COUNT = 30;
function DustMotes({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
  const groupRef = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(DUST_COUNT * 3);
    const phases = new Float32Array(DUST_COUNT);
    // Deterministic LCG so dust positions are stable across mounts and the
    // useMemo factory is pure (no Math.random / impure side effects).
    let s = 0xb16b00b5;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    for (let i = 0; i < DUST_COUNT; i++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * 4 + 1.5;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = rand() * 2.5 + 0.3;
      positions[i * 3 + 2] = Math.sin(a) * r;
      phases[i] = rand() * Math.PI * 2;
    }
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("dustPhase", new THREE.BufferAttribute(phases, 1));
    return g;
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const p = playerPosRef.current;
    groupRef.current.position.set(p.x, p.y, p.z);
    const t = state.clock.elapsedTime;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const phases = geo.attributes.dustPhase as THREE.BufferAttribute;
    for (let i = 0; i < DUST_COUNT; i++) {
      const phase = phases.getX(i);
      const baseX = pos.getX(i);
      const baseY = pos.getY(i);
      const baseZ = pos.getZ(i);
      // Bob along Y between original and +0.8 over a slow period.
      const newY = baseY * 0.97 + ((Math.sin(t * 0.4 + phase) * 0.4) + 1.4) * 0.03;
      // Small XZ jitter so they don't feel locked.
      pos.setXYZ(
        i,
        baseX + Math.sin(t * 0.7 + phase) * 0.005,
        newY,
        baseZ + Math.cos(t * 0.6 + phase * 1.3) * 0.005,
      );
    }
    // Three.js requires this mutation to flag the attribute for re-upload;
    // it's the sanctioned API and shouldn't be wrapped in a setter.
    // eslint-disable-next-line react-hooks/immutability
    pos.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <points geometry={geo}>
        <pointsMaterial
          color="#FFF5D0"
          size={0.12}
          transparent
          opacity={0.55}
          sizeAttenuation
          depthWrite={false}
          fog={false}
        />
      </points>
    </group>
  );
}

// ─── Signposts (P30) — central path junction wayfinding ─────────
// A signpost cluster near the spawn (z=-12, x=0) so the first thing a
// new player sees is a clear set of arrows: HQ ahead, Shop / Bounty to
// either side, Oracle past HQ. Reads like AC's wooden trail markers.
//
// Each arm is a thin slab rotated to point at its destination. The
// label text uses an Html overlay because rendering text via a 3D
// material would mean shipping a font asset for a single use.
const SIGN_TARGETS: { label: string; x: number; z: number }[] = [
  { label: "HQ", x: 0, z: -4 },
  { label: "Oracle", x: 0, z: 22 },
  { label: "Shop", x: -14, z: 8 },
  { label: "House", x: 14, z: 10 },
];

const SIGNPOST_POS = { x: 0, z: -12 };
function Signpost() {
  const { x, z } = SIGNPOST_POS;
  const y = useMemo(() => getTerrainHeight(x, z), [x, z]);
  return (
    <group position={[x, y, z]}>
      {/* Post */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 2.4, 8]} />
        <meshStandardMaterial color="#8B6B4A" roughness={0.9} metalness={0} />
      </mesh>
      {/* Arms — one per target, rotated to point at it */}
      {SIGN_TARGETS.map((t, i) => {
        const dx = t.x - x;
        const dz = t.z - z;
        const heading = Math.atan2(dx, dz);
        const armY = 1.6 + (SIGN_TARGETS.length - 1 - i) * 0.32;
        return (
          <group key={t.label} position={[0, armY, 0]} rotation={[0, heading, 0]}>
            {/* Slab pointing forward (toward +z in its local frame) */}
            <mesh position={[0, 0, 0.45]} castShadow>
              <boxGeometry args={[0.7, 0.22, 0.9]} />
              <meshStandardMaterial color="#C4A265" roughness={0.85} metalness={0} />
            </mesh>
            {/* Arrow tip */}
            <mesh position={[0, 0, 0.95]} castShadow>
              <coneGeometry args={[0.22, 0.32, 4]} />
              <meshStandardMaterial color="#C4A265" roughness={0.85} metalness={0} />
            </mesh>
            <Html zIndexRange={[40, 0]}
              position={[0, 0, 0.45]}
              center
              distanceFactor={9}
              style={{ pointerEvents: "none" }}
            >
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#3D2817",
                  whiteSpace: "nowrap",
                  userSelect: "none",
                }}
              >
                {t.label}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ─── Lamp posts (P19) — pair-flank HQ + Shop entrances ──────────
// Each lamp = dark post + amber globe top. Globe emissive ramps with
// time of day so they "turn on" through dusk and read as warm anchors
// at night. Six instances total (3 pairs), drawn via standard meshes
// rather than Instances — count is too low to bother instancing.
const LAMP_POSITIONS: [number, number, number, number][] = [
  // [x, z, doorFacingDir(z-offset), unused]
  // HQ at (0, 0, -4), door faces +Z. Lamps flank at ±2 X, +Z forward.
  [-2.5, -1.0, 1, 0],
  [2.5, -1.0, 1, 0],
  // Shop at (-14, 0, 8), door faces +Z. Lamps at ±2 X relative to shop.
  [-16, 10.5, 1, 0],
  [-12, 10.5, 1, 0],
  // House at (14, 0, 10), door faces +Z.
  [12, 12.5, 1, 0],
  [16, 12.5, 1, 0],
];

// P27: small moths orbiting each lit lamp. Three per lamp, each with a
// stable phase so they don't sync into a single ring. Position computed
// per-frame from lamp center + circular orbit + bobbing y.
function LampMoths({ center }: { center: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  const refs = useRef<(THREE.Mesh | null)[]>([null, null, null]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < 3; i++) {
      const m = refs.current[i];
      if (!m) continue;
      const phase = (i / 3) * Math.PI * 2;
      const a = t * 1.4 + phase;
      m.position.set(
        center[0] + Math.cos(a) * 0.45,
        center[1] + 1.85 + Math.sin(t * 2.3 + phase) * 0.08,
        center[2] + Math.sin(a) * 0.45,
      );
    }
    void groupRef.current;
  });
  return (
    <group ref={groupRef}>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.04, 6, 4]} />
          <meshBasicMaterial color="#FFF5D0" fog={false} />
        </mesh>
      ))}
    </group>
  );
}

function LampPosts({ phase }: { phase: "day" | "night" | "dawn" | "dusk" }) {
  const onAtNight = phase === "night" || phase === "dusk" || phase === "dawn";
  const emissive = onAtNight ? 2.2 : 0;
  return (
    <group>
      {LAMP_POSITIONS.map(([x, z], i) => {
        const y = getTerrainHeight(x, z);
        return (
          <group key={i} position={[x, y, z]}>
            {/* Post */}
            <mesh position={[0, 0.8, 0]} castShadow>
              <cylinderGeometry args={[0.07, 0.09, 1.6, 8]} />
              <meshStandardMaterial color="#3D3D3D" roughness={0.9} metalness={0.2} />
            </mesh>
            {/* Arm to globe */}
            <mesh position={[0, 1.6, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 0.18, 6]} />
              <meshStandardMaterial color="#3D3D3D" roughness={0.9} metalness={0.2} />
            </mesh>
            {/* Globe */}
            <mesh position={[0, 1.85, 0]} castShadow>
              <sphereGeometry args={[0.18, 14, 10]} />
              <meshStandardMaterial
                color="#FFE4B0"
                emissive="#FFB060"
                emissiveIntensity={emissive}
                roughness={0.55}
                metalness={0}
              />
            </mesh>
            {/* W7: warmer, wider night pool (0.6→0.95, distance 4→5.5). Halo
                sprite dropped — a textureless sprite renders as a hard square,
                not a glow; the brighter point light carries the cozy pool. */}
            {onAtNight && (
              <pointLight
                position={[0, 1.85, 0]}
                color="#FFC078"
                intensity={0.95}
                distance={5.5}
                decay={2}
              />
            )}
            {onAtNight && <LampMoths center={[0, 0, 0]} />}
          </group>
        );
      })}
    </group>
  );
}

// ─── Props (v2 spec Section 9) — all placed at terrain height ───
function yAt(x: number, z: number): [number, number, number] {
  return [x, getTerrainHeight(x, z), z];
}
const LAMP_XZ: [number, number][] = [[1.8, -9], [-1.8, -16], [-1.8, 6.5], [1.8, 17], [-1.8, 24], [-11, 12.2], [11, 12.2]];
function Props() {
  return (
    <group>
      {/* Benches — warm wood benches by the HQ approach, white park benches
          at the north plaza. Sit anchors stay at the same XZ (BENCHES list
          in the interact sweep mirrors these coords). */}
      {[[-3, -16], [3, -16], [-3.2, 13], [3.2, 13]].map(([x, z], i) => (
        <group key={`bench-${i}`} position={yAt(x, z)}>
          <Suspense fallback={null}>
            <GLBProp url={z < 0 ? "/assets/acnh/props/bench-wood.glb" : "/assets/acnh/props/bench-park.glb"} />
          </Suspense>
        </group>
      ))}
      {/* Lampposts — ACNH round streetlamps, instanced (one draw per
          sub-mesh for all 5); point lights stay per-lamp. */}
      <Suspense fallback={null}>
        <InstancedGLB
          url="/assets/acnh/props/streetlamp.glb"
          placements={LAMP_XZ.map(([x, z]) => ({ position: yAt(x, z) }))}
        />
      </Suspense>
      {LAMP_XZ.map(([x, z], i) => {
        const [, y] = yAt(x, z);
        return <pointLight key={`lamp-light-${i}`} color={P.lampGlow} intensity={0.35} distance={6} position={[x, y + 2.4, z]} />;
      })}
      {/* (HQ approach fence rows removed in the 2026-07-07 declutter —
          seen end-on from the south camera they read as beaded poles and
          crowded the door. Perimeter fences live in AmbientProps.) */}
      {/* (Well removed in the 2026-07-07 declutter — the fountain owns the
          water-feature slot and the HQ courtyard needed air.) */}
      {/* Log stumps (Kenney Nature Kit) */}
      {[[-20, -16], [22, -24], [-26, 19]].map(([x, z], i) => (
        <NatureStump key={`stump-${i}`} position={yAt(x, z)} />
      ))}
      {/* Mushrooms under trees (Kenney Nature Kit) */}
      {[[-9.5, 19.5], [9.5, 19.5], [-26.5, 6], [26.5, 8.5], [-7.5, -25.5]].map(([x, z], i) => (
        <NatureMushroom key={`mush-${i}`} position={yAt(x, z)} seed={i} />
      ))}
      {/* Ambient houses (ACNH wave V) — pure scenery flanking the south
          green, facing the village center. Footprints in terrain.ts. */}
      <Suspense fallback={null}>
        <group position={yAt(-30, -18)} rotation={[0, Math.PI / 2, 0]}>
          <GLBProp url="/assets/acnh/buildings/house-chalet-red.glb" scale={0.1} />
        </group>
        <group position={yAt(30, -19)} rotation={[0, -Math.PI / 2, 0]}>
          <GLBProp url="/assets/acnh/buildings/house-chalet-yellow.glb" scale={0.1} />
        </group>
        {/* (Distant-island backdrop pieces tried here rendered as floating
            streaks — their pivots assume the ACNH sea ring. Cut; the ocean
            + fog horizon reads fine without them.) */}
      </Suspense>
      {/* Banners near HQ */}
      {[[3.5, -7], [-3.5, -7]].map(([x, z], i) => (
        <group key={`banner-${i}`} position={yAt(x, z)}>
          <mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.04, 0.04, 3.2, 8]} /><meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} /></mesh>
          <mesh position={[0, 2.8, 0]}><planeGeometry args={[0.7, 1]} /><meshStandardMaterial color="#4A6FA5" roughness={0.8} metalness={0} side={THREE.DoubleSide} /></mesh>
        </group>
      ))}
    </group>
  );
}

// ─── NPC spawn anchors (D5) ─────────────────────────────────────
// Approximate centers per spawn_zone enum. When >1 NPC shares a zone we
// offset along +x so they don't visually overlap.
const NPC_SPAWN_POSITIONS: Record<SpawnZone, [number, number, number]> = {
  courtyard: [-2, 0, -2],
  shop: [-21, 0, 10],
  temple: [0, 0, 26],
  // roaming pulled off the river bank (respace 2026-07-07)
  roaming: [7, 0, -6],
};

// Daily village life v1 (2026-07-12): at night the villagers drift to the
// warm spots — lamp pools, the HQ doorstep, the fountain bench — instead of
// standing in the daytime plaza. NPC.tsx eases the base change (slow glide)
// so a phase flip reads as a stroll, not a teleport. Dawn keeps the night
// spots (early risers haven't left home yet); dusk starts the migration.
const NPC_SPAWN_POSITIONS_NIGHT: Record<SpawnZone, [number, number, number]> = {
  courtyard: [1.8, 0, -6.2],   // HQ doorstep lamp
  shop: [-22.5, 0, 12.5],      // under the shop awning
  temple: [0, 0, 27.5],        // closer to the temple braziers
  roaming: [3.4, 0, -15.6],    // fountain bench
};

// Generic filler NPCs — design principle #2: world must never feel empty.
// No persona_prompt / canned_dialogue: clicking shows a brief tooltip, not
// the chat overlay. Synthetic ids prefixed `filler-` for traceability.
const FILLER_NPCS: NPCPersona[] = [
  {
    id: "filler-wanderer-1",
    slug: "wanderer-1",
    display_name: "Wanderer",
    sprite_url: "/assets/characters/npc/wanderer-1.png",
    spawn_zone: "courtyard",
    is_permanent: false,
    persona_prompt: null,
    canned_dialogue: [],
    active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "filler-visitor-1",
    slug: "visitor-1",
    display_name: "Visitor",
    sprite_url: "/assets/characters/npc/visitor-1.png",
    spawn_zone: "courtyard",
    is_permanent: false,
    persona_prompt: null,
    canned_dialogue: [],
    active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "filler-stranger-1",
    slug: "stranger-1",
    display_name: "Stranger",
    sprite_url: "/assets/characters/npc/stranger-1.png",
    spawn_zone: "courtyard",
    is_permanent: false,
    persona_prompt: null,
    canned_dialogue: [],
    active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    // Beach Cove loop: someone is always at the cove — the world's new
    // destination shouldn't stand empty (principle #2). Reuses the
    // visitor sheet; opposite end of the island from its twin.
    id: "filler-beachgoer-1",
    slug: "beachgoer-1",
    display_name: "Beachgoer",
    sprite_url: "/assets/characters/npc/visitor-1.png",
    spawn_zone: "courtyard",
    is_permanent: false,
    persona_prompt: null,
    canned_dialogue: [],
    active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
];

const FILLER_POSITIONS: [number, number, number][] = [
  [3, 0, -4],
  [-4, 0, -5],
  [2, 0, -8],
  [16.6, 0, 45.2], // the cove camp
];

// ─── Scene ──────────────────────────────────────────────────────
/**
 * DebugTracker (F1.4) — invisible R3F component that samples FPS + scene
 * stats each frame and writes them to a snapshot ref. DebugOverlay reads
 * the ref on a 4Hz interval, so this stays cheap.
 */
// P-light v2 perf (measured: island-wide 2048 map cost 21fps): the shadow
// frustum follows the player (tight 44u box = crisp + fewer casters) and
// the depth pass re-renders at 30Hz — the sun moves too slowly to notice.
let _shadowFrameFlip = false;
function updateShadowRig(gl: THREE.WebGLRenderer, sun: THREE.DirectionalLight, playerPos: THREE.Vector3, sunWorld: THREE.Vector3) {
  sun.position.set(playerPos.x + sunWorld.x, sunWorld.y, playerPos.z + sunWorld.z);
  sun.target.position.set(playerPos.x, 0, playerPos.z);
  sun.target.updateMatrixWorld();
  // R3F sets shadow-camera-* props but never calls updateProjectionMatrix —
  // without this the ortho frustum stays at its construction defaults and
  // the map renders a tiny box nowhere near the view (classic gotcha).
  sun.shadow.camera.updateProjectionMatrix();
  gl.shadowMap.autoUpdate = false;
  _shadowFrameFlip = !_shadowFrameFlip;
  if (_shadowFrameFlip) gl.shadowMap.needsUpdate = true;
}

// gl.info with autoReset ON gets cleared by EVERY internal render pass
// (the PostFX composer's final quad left "Draws 1" in the overlay).
// Manual mode: we read totals once per frame, then reset ourselves.
// Module fn = compiler-sanctioned imperative three mutation.
function captureRenderStats(gl: THREE.WebGLRenderer): { calls: number; triangles: number; geometries: number; textures: number; frameMs: number } {
  gl.info.autoReset = false;
  const stats = {
    calls: gl.info.render.calls,
    triangles: gl.info.render.triangles,
    geometries: gl.info.memory.geometries,
    textures: gl.info.memory.textures,
    frameMs: 0,
  };
  gl.info.reset();
  return stats;
}

function DebugTracker({
  snapshotRef,
  playerPosRef,
  phase,
  ghosts,
  npcs,
}: {
  snapshotRef: React.MutableRefObject<DebugSnapshot | null>;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  phase: "day" | "night" | "dawn" | "dusk";
  ghosts: number;
  npcs: number;
}) {
  const fpsAccum = useRef({ frames: 0, time: 0, fps: 60 });
  const { gl } = useThree();

  useFrame((_, delta) => {
    const acc = fpsAccum.current;
    acc.frames += 1;
    acc.time += delta;
    if (acc.time >= 0.5) {
      acc.fps = Math.round(acc.frames / acc.time);
      acc.frames = 0;
      acc.time = 0;
    }
    const pos = playerPosRef.current;
    // Stats read = last frame's full totals (manual reset mode — see
    // captureRenderStats). frameMs = smoothed CPU frame delta.
    const stats = captureRenderStats(gl);
    snapshotRef.current = {
      fps: acc.fps,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      phase,
      ghosts,
      npcs,
      frameMs: Math.round(delta * 10000) / 10,
      geometries: stats.geometries,
      textures: stats.textures,
      drawCalls: stats.calls,
      triangles: stats.triangles,
    };
  });
  return null;
}

// P32: small DOM badge showing the current time-of-day phase. Lives
// next to the corner buttons so the player can read the world clock
// at a glance without opening any panel.
const TOD_LABEL: Record<"day" | "night" | "dawn" | "dusk", { text: string; bg: string; fg: string }> = {
  dawn: { text: "Dawn", bg: "#FFB68C", fg: "#5A3A26" },
  day: { text: "Day", bg: "#FFE6A6", fg: "#5A4A2A" },
  dusk: { text: "Dusk", bg: "#C29ACB", fg: "#3A2A4A" },
  night: { text: "Night", bg: "#2D3360", fg: "#E6E6FF" },
};
function TodBadge({ phase }: { phase: "day" | "night" | "dawn" | "dusk" }) {
  const cfg = TOD_LABEL[phase];
  return (
    <div
      style={{
        position: "absolute",
        // Sit just below the audio-enable toast (which lives top-right
        // at ~y=12). 48px down avoids the overlap.
        top: 56,
        right: 12,
        padding: "4px 12px",
        background: cfg.bg,
        color: cfg.fg,
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'IBM Plex Mono', monospace",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
        zIndex: 30,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {cfg.text}
    </div>
  );
}

// P16: pump the camera's azimuth angle (radians) into a shared ref so the
// DOM Compass HUD outside the Canvas can render without React rerenders.
// Camera in this scene is positioned by CameraControls — we read its
// world-space forward vector and convert to azimuth.
function CompassFeed({ azimuthRef }: { azimuthRef: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  const fwd = useRef(new THREE.Vector3());
  useFrame(() => {
    camera.getWorldDirection(fwd.current);
    // atan2(x, z) puts 0 at +Z (south in our world) and grows CCW. We
    // want 0 at -Z (north) growing CW so it matches a real compass. So
    // flip sign and add π.
    azimuthRef.current = Math.atan2(fwd.current.x, fwd.current.z) + Math.PI;
  });
  return null;
}

function Scene({
  playerName,
  introReady,
  weather,
  spawn,
  playerLevel,
  fogColor,
  todPhase,
  onNPCClick,
  activeEmote,
  playerPosRef,
  onNearestInteractable,
  debugSnapshotRef,
  ambientDensity,
  blobShadows,
  azimuthRef,
}: {
  playerName: string;
  introReady: boolean;
  weather: Weather;
  spawn?: [number, number, number];
  playerLevel: number;
  fogColor: string;
  todPhase: "day" | "night" | "dawn" | "dusk";
  onNPCClick: (npc: NPCPersona) => void;
  activeEmote: EmoteType | null;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onNearestInteractable: (n: { kind: "npc" | "building" | "tree" | "bench" | "flower" | "fishing" | "critter" | "station"; id: string; name: string; href?: string; npc?: NPCPersona; treePos?: [number, number]; seat?: [number, number]; flowerIdx?: number; flowerPos?: [number, number]; spot?: [number, number]; critterSlot?: number; interiorId?: string; stationAction?: string } | null) => void;
  debugSnapshotRef: React.MutableRefObject<DebugSnapshot | null>;
  ambientDensity: number;
  blobShadows: boolean;
  azimuthRef: React.MutableRefObject<number>;
}) {
  const cameraRef = useRef<CameraControls>(null);
  const blobPlacements = useMemo(() => buildBlobPlacements(), []);

  // G5 (item 16): first-visit flythrough — a 6s sweep from over the sea
  // down to the spawn plaza. Any key/click skips. `?nointro` for tests.
  useEffect(() => {
    const cc = cameraRef.current;
    if (!cc || typeof window === "undefined") return;
    // Task 26: don't burn the flythrough behind the loading gate — this
    // effect re-runs when the gate finishes and only then starts the sweep.
    if (!introReady) return;
    if (window.location.search.includes("nointro")) return;
    try {
      if (localStorage.getItem("tsi.intro.v1")) return;
      localStorage.setItem("tsi.intro.v1", "1");
    } catch {
      return;
    }
    const prevSmooth = cc.smoothTime;
    let done = false;
    cc.setLookAt(-38, 34, -100, 0, 2, 8, false);
    cc.smoothTime = 2.6;
    void cc.setLookAt(0, 19.5, -35, 0, 1.5, -15, true);
    const finish = () => {
      if (done) return;
      done = true;
      cc.smoothTime = prevSmooth;
      window.removeEventListener("keydown", skip, true);
      window.removeEventListener("pointerdown", skip, true);
    };
    const skip = () => {
      cc.smoothTime = 0.4;
      void cc.setLookAt(0, 19.5, -35, 0, 1.5, -15, true);
      window.setTimeout(finish, 450);
    };
    const t = window.setTimeout(finish, 6500);
    window.addEventListener("keydown", skip, true);
    window.addEventListener("pointerdown", skip, true);
    return () => {
      window.clearTimeout(t);
      finish();
    };
  }, [introReady]);
  // G2: world-space anchor for the E-target ground glow.
  const glowTargetRef = useRef<[number, number, number] | null>(null);
  const [playerPos, setPlayerPos] = useState<THREE.Vector3>(new THREE.Vector3(...SPAWN_POSITION));
  const { data: personas } = useNPCPersonas({ permanentOnly: true });

  // E4: heartbeat current position to player_positions every 30s.
  // playerPosRef is a Vector3; the hook only reads .x and .z so it duck-types.
  usePositionHeartbeat(playerPosRef as unknown as React.RefObject<{ x: number; z: number } | null>);
  // E5: ghost-replay of other recent members (last 24h, max 10).
  const { ghosts } = useGhostPositions();
  // E9: settings toggle — members can disable ghost ambience.
  const [ghostsEnabled] = useGhostReplaySetting();
  // G4 follow-up: lite mode disables PostFX + ambient particles + ghosts +
  // clouds. Auto-detects ≤4GB devices on first visit. Settings override.
  const [liteMode] = useLiteMode();

  // Position each permanent NPC by spawn_zone, offsetting duplicates so they
  // don't overlap. Stable: ordering follows the personas array.
  const placedPersonas = useMemo(() => {
    const zoneCount: Partial<Record<SpawnZone, number>> = {};
    const table = todPhase === "night" || todPhase === "dawn" ? NPC_SPAWN_POSITIONS_NIGHT : NPC_SPAWN_POSITIONS;
    return personas.map((p) => {
      const base = table[p.spawn_zone] ?? table.courtyard;
      const idx = zoneCount[p.spawn_zone] ?? 0;
      zoneCount[p.spawn_zone] = idx + 1;
      const pos: [number, number, number] = [base[0] + idx * 1.5, base[1], base[2]];
      return { persona: p, position: pos };
    });
  }, [personas, todPhase]);

  const handleFillerClick = useCallback((name: string) => {
    // G3: unified toast pipeline.
    window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: `${name}: ...just passing through.` } }));
  }, []);

  // G1 camera feel: the target leads ~1.2u in the travel direction and the
  // FOV widens a touch at sprint speed. Both damped so nothing snaps.
  const camFeelRef = useRef({ lastX: 0, lastZ: 0, lastT: 0, leadX: 0, leadZ: 0, fov: 48 });
  const handlePlayerMove = useCallback((position: THREE.Vector3) => {
    setPlayerPos(position);
    playerPosRef.current.copy(position);
    const cf = camFeelRef.current;
    const now = performance.now();
    const dt = Math.min((now - cf.lastT) / 1000, 0.1) || 0.016;
    const vx = (position.x - cf.lastX) / dt;
    const vz = (position.z - cf.lastZ) / dt;
    cf.lastX = position.x; cf.lastZ = position.z; cf.lastT = now;
    const speed = Math.hypot(vx, vz);
    const lead = speed > 1 ? 1.2 : 0;
    const inv = speed > 0.001 ? 1 / speed : 0;
    cf.leadX = THREE.MathUtils.damp(cf.leadX, vx * inv * lead, 3, dt);
    cf.leadZ = THREE.MathUtils.damp(cf.leadZ, vz * inv * lead, 3, dt);
    cameraRef.current?.moveTo(position.x + cf.leadX, position.y + 1.5, position.z + cf.leadZ, true);
    // (Sprint FOV widen lives in PlayerAvatar's useFrame — the compiler
    // allows camera mutation there but not in this DOM-side callback.)

    // F1.2: compute nearest interactable for crosshair + E-interact. Cheap
    // O(npc + building) sweep every move tick. INTERACT_RADIUS = 3.5 units.
    const INTERACT_RADIUS = 3.5;
    let bestDist = INTERACT_RADIUS;
    let best: { kind: "npc" | "building" | "tree" | "bench" | "flower" | "fishing" | "critter" | "station"; id: string; name: string; href?: string; npc?: NPCPersona; treePos?: [number, number]; seat?: [number, number]; flowerIdx?: number; flowerPos?: [number, number]; spot?: [number, number]; critterSlot?: number; interiorId?: string; stationAction?: string } | null = null;
    for (const { persona, position: p } of placedPersonas) {
      const dx = p[0] - position.x;
      const dz = p[2] - position.z;
      const d = Math.hypot(dx, dz);
      if (d < bestDist) {
        bestDist = d;
        best = { kind: "npc", id: persona.id, name: persona.display_name, npc: persona };
      }
    }
    for (const b of BUILDINGS) {
      // Buildings with an href open sheets/routes; ones with an interior
      // (interiors-lite 2026-07-13) enter the room. Others are decor.
      const interiorId = (b as { interior?: string }).interior;
      if (!b.href && !interiorId) continue;
      const dx = b.position[0] - position.x;
      const dz = b.position[2] - position.z;
      const d = Math.hypot(dx, dz);
      if (d < bestDist) {
        bestDist = d;
        best = { kind: "building", id: b.id, name: b.name, href: b.href, interiorId };
      }
    }
    // G5: fishing spots on the riverbank (radius 2.4). Beach Cove loop:
    // plus two saltwater casts — the wood deck edge and the cove sand.
    // ACNH revamp: spots hug the carved channel banks (~1.2u off center).
    const FISHING_SPOTS: [number, number][] = [[-12, 6.2], [-3, 2.6], [5, 5.4], [16, 3.6], [18.3, 43.6], [13.4, 48]];
    for (let i = 0; i < FISHING_SPOTS.length; i++) {
      const [sx, sz] = FISHING_SPOTS[i];
      const d = Math.hypot(sx - position.x, sz - position.z);
      if (d < Math.min(bestDist, 2.4)) {
        bestDist = d;
        best = { kind: "fishing", id: `fish-${i}`, name: "Cast line", spot: [sx, sz] };
      }
    }
    // G4: flowers — pick target (radius 2.0). Skip already-picked clusters.
    const pickedNow = getPickedSnapshot();
    for (let i = 0; i < FLOWER_XZ.length; i++) {
      if (pickedNow.includes(i)) continue;
      const [fx2, fz2] = FLOWER_XZ[i];
      const d = Math.hypot(fx2 - position.x, fz2 - position.z);
      if (d < Math.min(bestDist, 2.0)) {
        bestDist = d;
        best = { kind: "flower", id: `flower-${i}`, name: "Pick flower", flowerIdx: i, flowerPos: [fx2, fz2] };
      }
    }
    // Critters pillar v1: live insects from the critter store (radius 2.2).
    for (const c of getActiveCritters()) {
      const d = Math.hypot(c.x - position.x, c.z - position.z);
      if (d < Math.min(bestDist, 2.2)) {
        bestDist = d;
        best = { kind: "critter", id: `critter-${c.slot}`, name: "Catch it!", critterSlot: c.slot };
      }
    }
    // G3: benches — sit target. Coords mirror Props()' bench array.
    const BENCHES: [number, number][] = [[-3, -16], [3, -16], [-3.2, 13], [3.2, 13]];
    for (let i = 0; i < BENCHES.length; i++) {
      const [bx, bz] = BENCHES[i];
      const d = Math.hypot(bx - position.x, bz - position.z);
      if (d < Math.min(bestDist, 2.2)) {
        bestDist = d;
        best = { kind: "bench", id: `bench-${i}`, name: "Sit", seat: [bx, bz] };
      }
    }
    // G1: trees — tighter radius (2.6) so NPCs/buildings win when both are
    // near. Name renders in the E-prompt as "Shake tree".
    for (let i = 0; i < TREE_XZ.length; i++) {
      const [tx, tz] = TREE_XZ[i];
      const d = Math.hypot(tx - position.x, tz - position.z);
      if (d < Math.min(bestDist, 2.6)) {
        bestDist = d;
        best = { kind: "tree", id: `tree-${i}`, name: "Shake tree", treePos: [tx, tz] };
      }
    }
    {
      // G2 target glow anchor: resolve `best` to a ground point.
      let gp: [number, number, number] | null = null;
      if (best) {
        const xz = best.treePos ?? best.seat ?? best.flowerPos ?? best.spot ?? null;
        if (xz) gp = [xz[0], getTerrainHeight(xz[0], xz[1]), xz[1]];
        else if (best.kind === "building") {
          const b = BUILDINGS.find((bb) => bb.id === best.id);
          if (b) gp = [b.position[0], getTerrainHeight(b.position[0], b.position[2]), b.position[2]];
        } else if (best.kind === "npc") {
          const pp = placedPersonas.find((q) => q.persona.id === best.id);
          if (pp) gp = [pp.position[0], getTerrainHeight(pp.position[0], pp.position[2]), pp.position[2]];
        }
      }
      glowTargetRef.current = gp;
    }
    onNearestInteractable(best);
  }, [playerPosRef, placedPersonas, onNearestInteractable]);

  // Sprint F1.1: rebind mouse buttons via the imperative API. drei's JSX
  // wrapper doesn't always thread the `mouseButtons` object cleanly, so set
  // them once the controls instance is mounted.
  //  - left = NONE  → click-to-move ground raycast can fire without rotating
  //  - right = ROTATE → right-click drag yaws/pitches the camera
  //  - wheel = DOLLY → scroll zooms in/out within minDistance/maxDistance
  //  - middle = NONE
  useEffect(() => {
    const cc = cameraRef.current;
    if (!cc) return;
    // camera-controls ACTION enum: NONE=0, ROTATE=1, DOLLY=16
    cc.mouseButtons.left = 0;
    cc.mouseButtons.middle = 0;
    cc.mouseButtons.right = 1;
    cc.mouseButtons.wheel = 16;
  }, []);

  // Sprint F1.1: arrow-key camera rotation as no-mouse fallback. Tracks
  // held state via a ref so the rotation rate is consistent per frame.
  // Guarded against typing in inputs.
  const arrowKeysRef = useRef({ left: false, right: false, up: false, down: false });
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping()) return;
      if (e.key === "ArrowLeft") arrowKeysRef.current.left = true;
      else if (e.key === "ArrowRight") arrowKeysRef.current.right = true;
      else if (e.key === "ArrowUp") arrowKeysRef.current.up = true;
      else if (e.key === "ArrowDown") arrowKeysRef.current.down = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") arrowKeysRef.current.left = false;
      else if (e.key === "ArrowRight") arrowKeysRef.current.right = false;
      else if (e.key === "ArrowUp") arrowKeysRef.current.up = false;
      else if (e.key === "ArrowDown") arrowKeysRef.current.down = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useFrame(() => {
    const cc = cameraRef.current;
    if (!cc) return;
    const k = arrowKeysRef.current;
    let dAz = 0;
    let dPol = 0;
    if (k.left) dAz -= 0.02;
    if (k.right) dAz += 0.02;
    if (k.up) dPol -= 0.015;
    if (k.down) dPol += 0.015;
    if (dAz !== 0 || dPol !== 0) {
      cc.rotate(dAz, dPol, true);
    }
  });

  return (
    <>
      {/* Sprint F1.1: camera-relative WASD + right-click drag + scroll zoom +
          arrow-key fallback. Polar gated to ±20-30° around horizontal so the
          AC framing is preserved while allowing a peek up/down. */}
      {/* 2026-07-08 camera ask: steeper default look-down (42° max, was
          30°) and a hard floor at the horizon — polar can no longer pass
          90°, so the camera physically cannot dive under the terrain
          (at 90° it sits at target height, 1.5u over the player, above
          every hill on the island). */}
      <CameraControls
        ref={cameraRef}
        minPolarAngle={Math.PI / 2 - (42 * Math.PI) / 180}
        maxPolarAngle={Math.PI / 2}
        minDistance={12}
        maxDistance={34}
        dollySpeed={1.0}
        truckSpeed={0}
        smoothTime={0.18}
        draggingSmoothTime={0.05}
        azimuthRotateSpeed={1.0}
        polarRotateSpeed={0.6}
        makeDefault
      />

      <TimeOfDayCycle weather={weather} todPhase={todPhase} shadowsOn={blobShadows} playerPosRef={playerPosRef} />
      {weather === "rain" && !liteMode && <RainFX playerPosRef={playerPosRef} />}
      <Critters todPhase={todPhase} playerPosRef={playerPosRef} flowerAnchors={FLOWER_XZ} treeAnchors={TREE_XZ} />
      <ToolFlourish playerPosRef={playerPosRef} />
      <DebugTracker
        snapshotRef={debugSnapshotRef}
        playerPosRef={playerPosRef}
        phase={todPhase}
        ghosts={ghosts.length}
        npcs={placedPersonas.length + FILLER_NPCS.length}
      />
      <CompassFeed azimuthRef={azimuthRef} />
      {/* Fog brought in to 25→55 so the island edge fades cleanly into
          the sky color (ISLAND_RADIUS is 40, so old 50→100 fog barely
          kicked in inside the playable zone). Reads as soft atmospheric
          haze, masks the world's hard boundary. */}
      {/* Cozy push 2026-07-03: was 25-55, which washed half the village gray
          (David: fog doesn't look good). Now a far soft haze — the village
          (±30u) stays crisp, the island edge still fades out. */}
      <fog attach="fog" args={[fogColor, 55, 100]} /> {/* far 120->100 (2026-07-13): distant props dissolve into atmosphere sooner */}

      <Terrain />
      {/* P-light v2: with the shadow map on, the static discs retire —
          buildings/trees get real shadows; discs remain the low-perf
          fallback when the setting is off. */}
      {!blobShadows && <BlobShadows placements={blobPlacements} />}
      <Ocean phase={todPhase} />
      <RiverMouths />
      <ShoreLife />
      <BeachCove />
      <SeasonalProps />
      <Landmarks />
      <River phase={todPhase} />
      <TreeShakeFX playerPosRef={playerPosRef} />
      <FlowerPickFX />
      <FishCatchFX playerPosRef={playerPosRef} />
      <Bridge />
      {/* G2 ambience set (2026-07-07) */}
      <TargetGlow targetRef={glowTargetRef} />
      <NightStars phase={todPhase} />
      <NightWindows phase={todPhase} />
      {!liteMode && <CloudShadows phase={todPhase} />}
      {!liteMode && <WaterSparkles />}
      {!liteMode && <LeafGusts />}

      <InstancedTrees />
      <Bushes />
      <Flowers />
      {/* P13: when the user has shadows off (or default-off via deviceMemory
          autodetect), soften ambient density too so the whole scene reads
          as consistently light-touch. liteMode unmounts AmbientLife entirely. */}
      {!liteMode && (
        <AmbientLife phase={todPhase} density={ambientDensity} />
      )}
      <ChimneySmoke />

      {/* (Volumetric drei clouds removed 2026-07-08 — they churned during
          camera movement and cost billboard re-sorts; David is importing a
          static sky background instead. The AmbienceFX ground cloud-shadow
          layer stays — separate system, nearly free.) */}
      <Suspense fallback={null}>
        <Props />
        <AmbientProps />
        <LampPosts phase={todPhase} />
        <Signpost />
        {!liteMode && <DustMotes playerPosRef={playerPosRef} />}
      </Suspense>

      {BUILDINGS.map((b) => {
        const y = getTerrainHeight(b.position[0], b.position[2]);
        return <Building key={b.id} id={b.id} name={b.name} position={[b.position[0], y, b.position[2]]} size={b.size} color={b.color} roofColor={b.roofColor} href={b.href} playerPosition={playerPos} />;
      })}

      {/* Permanent NPCs from content pipeline. Click → chat overlay. */}
      {placedPersonas.map(({ persona, position }) => (
        <NPC
          key={persona.id}
          persona={persona}
          position={position}
          playerPosition={playerPos}
          onClick={() => onNPCClick(persona)}
        />
      ))}

      {/* Filler NPCs (design principle #2). Click → brief tooltip, no chat. */}
      {FILLER_NPCS.map((filler, i) => (
        <NPC
          key={filler.id}
          persona={filler}
          position={FILLER_POSITIONS[i]}
          onClick={() => handleFillerClick(filler.display_name)}
        />
      ))}

      {/* E5: Ghost-replay of other recent members. Capped at 10. E9: gated
          on the per-user settings toggle (default ON). */}
      {ghostsEnabled && !liteMode && ghosts.slice(0, 10).map((g) => (
        <GhostReplay key={g.user_id} ghost={g} />
      ))}

      <PlayerAvatar spawnPosition={spawn ?? SPAWN_POSITION} onMove={handlePlayerMove} playerName={playerName} playerLevel={playerLevel} activeEmote={activeEmote} />

    </>
  );
}

// ─── Canvas (v2 spec Section 2) ─────────────────────────────────
export default function GameWorld() {
  const { profile } = useUser();
  const { data: activePalette } = useActivePalette();
  const playerName = profile?.display_name || "Player";
  const playerLevel = profile?.level ?? 1;

  // Sky + fog read from the active seasonal palette; everything else still
  // uses the hardcoded P table for this sprint. Time-of-day cycle continues to
  // animate sky from TOD_KEYS on top — palette controls only the initial /
  // fallback color and the fog tone before TOD overwrites it.
  const skyBase = activePalette.palette.sky || P.skyBottom;
  const fogColor = activePalette.palette.fog || P.fog;
  const todPhase = useTodPhase();
  // G4 follow-up: lite mode (auto-detected on first visit if device has
  // ≤4GB RAM). Disables PostFX + ambient particles + ghosts + clouds.
  const [liteMode] = useLiteMode();
  // G4/G5: full per-device graphics settings (subset of which is liteMode
  // — left in place for backwards-compat with anything reading the older
  // hook). New components read via useGraphicsSettings.
  const [graphicsSettings] = useGraphicsSettings();
  const [graphicsOpen, setGraphicsOpen] = useState(false);

  // Active NPC chat target. D5 wires sprite clicks → setActiveNPC inside Scene.
  const [activeNPC, setActiveNPC] = useState<NPCPersona | null>(null);

  // Sprint E2 + E3: emote menu state + active emote bubble on the avatar.
  const [emoteMenuOpen, setEmoteMenuOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  // F1.4: F3 debug overlay (Minecraft tradition). Snapshot updated in Scene.
  const [debugOpen, setDebugOpen] = useState(false);
  const debugSnapshotRef = useRef<DebugSnapshot | null>(null);
  // F1.4: F2 screenshot mode — hide all DOM overlays to get a clean shot.
  const [screenshotMode, setScreenshotMode] = useState(false);
  // F1.4: emote types for 1-5 quick-fire slots.
  const { data: emoteTypes } = useEmoteTypes();
  // Ref-bridge so the keydown effect (declared before handleEmotePick) can
  // call the latest version without listing it as a dep.
  const emotePickRef = useRef<((emote: EmoteType) => void) | null>(null);
  // Sprint E6: guestbook wall overlay state.
  const [guestbookOpen, setGuestbookOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  // Sprint F1.3: hold-Tab server-list overlay state.
  const [tabHeld, setTabHeld] = useState(false);
  // G3: HUD auto-fade after 5s of no pointer/key activity; M-key minimap.
  const [hudDim, setHudDim] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  // Task 26 loading gate: overlay holds until assets resolve + warmup frames
  // render (shader compile happens behind it), then fades. gateDone unmounts.
  const [worldReady, setWorldReady] = useState(false);
  const [gateDone, setGateDone] = useState(false);
  // Item 14: feature pages as sheets over the living world (Canvas never
  // unmounts). null = no sheet open. ?sheet=jobs etc. opens one on load —
  // the QA hook in the ?nointro / ?rain family.
  // Interiors-lite (2026-07-13): which room the player is inside. The
  // exterior Scene unmounts while inside (assets stay cached via useGLTF)
  // and remounts on exit with the player just outside the HQ door.
  const [interior, setInterior] = useState<null | "hq" | "shop" | "oracle">(null);
  const interiorRef = useRef<null | "hq" | "shop" | "oracle">(null);
  useEffect(() => { interiorRef.current = interior; }, [interior]);
  const [worldSpawn, setWorldSpawn] = useState<[number, number, number] | undefined>(undefined);
  const [sheet, setSheet] = useState<SheetKey | null>(() => {
    if (typeof window === "undefined") return null;
    const m = window.location.search.match(/sheet=(shop|bounty|jobs|leaderboard|oracle)/);
    return m ? (m[1] as SheetKey) : null;
  });
  const sheetRef = useRef<SheetKey | null>(null);
  useEffect(() => { sheetRef.current = sheet; }, [sheet]);
  // Rain days v1: seeded daily weather with URL overrides (?rain / ?sunny),
  // resolved once via lazy initializer (GameWorld is ssr:false so window is
  // available on first render).
  const [weather] = useState<Weather>(getTodayWeather);
  const [activeEmote, setActiveEmote] = useState<EmoteType | null>(null);
  const emoteClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(...SPAWN_POSITION));
  // P16: shared ref pumped by CompassFeed inside Canvas; consumed by the
  // DOM Compass HUD on the outside. radians, 0 = north, growing clockwise.
  const azimuthRef = useRef<number>(0);

  // Building E-navigation (ACNH revamp): the central sweep is the sole
  // arbiter — Building.tsx's own keydown listener was removed because it
  // double-fired against this one when interact ranges overlapped.
  const router = useRouter();
  const { triggerTransition, isTransitioning } = useTransition();

  // F1.2: nearest interactable for crosshair + E-interact. Updated by Scene
  // on each player move via onNearestInteractable. Kept here so Crosshair
  // (DOM, outside Canvas) can read it.
  const [nearest, setNearest] = useState<{ kind: "npc" | "building" | "tree" | "bench" | "flower" | "fishing" | "critter" | "station"; id: string; name: string; href?: string; npc?: NPCPersona; treePos?: [number, number]; seat?: [number, number]; flowerIdx?: number; flowerPos?: [number, number]; spot?: [number, number]; critterSlot?: number; interiorId?: string; stationAction?: string } | null>(null);
  const nearestRef = useRef<typeof nearest>(null);
  useEffect(() => { nearestRef.current = nearest; }, [nearest]);

  // G key toggles the emote menu (was E pre-F1.4 — remapped per David's
  // sprint F1 ask so E becomes the universal interact key later). F1 toggles
  // the controls overlay so members can discover the new bindings. Skip when
  // the user is typing in an input / textarea / contentEditable so we don't
  // hijack chat or form fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      // Item 14: while a sheet is up, game hotkeys stand down (the sheet's
      // own capture-phase listener handles Escape).
      if (sheetRef.current) return;

      if (e.key === "e" || e.key === "E") {
        // F1.2: universal interact key. Triggers the current nearest interactable.
        if (activeNPC) return; // don't hijack while chatting
        const n = nearestRef.current;
        if (!n) return;
        // Interiors-lite: inside a room only station interactions are valid
        // (a stale exterior `nearest` could otherwise re-trigger entry).
        if (interiorRef.current && n.kind !== "station") return;
        e.preventDefault();
        if (n.kind === "npc" && n.npc) {
          setActiveNPC(n.npc);
        } else if (n.kind === "fishing" && n.spot) {
          // G5: start fishing — the overlay owns the cast/wait/bite machine.
          window.dispatchEvent(
            new CustomEvent("tsi:fish-start", { detail: { x: n.spot[0], z: n.spot[1] } })
          );
        } else if (n.kind === "flower" && n.flowerIdx !== undefined && n.flowerPos) {
          // G4: pick — hide the cluster (store) + FX/collect via event.
          if (pickFlower(n.flowerIdx)) {
            window.dispatchEvent(
              new CustomEvent("tsi:flower-pick", { detail: { x: n.flowerPos[0], z: n.flowerPos[1], idx: n.flowerIdx } })
            );
          }
        } else if (n.kind === "bench" && n.seat) {
          // G3: toggle sit at this bench. PlayerAvatar owns the pose + the
          // movement freeze; decoupled via a window event.
          window.dispatchEvent(
            new CustomEvent("tsi:sit", { detail: { x: n.seat[0], z: n.seat[1] } })
          );
        } else if (n.kind === "tree" && n.treePos) {
          // G1: tree shake — FX layer (TreeShakeFX inside the Canvas) owns
          // the burst + drop; decoupled via a window event so the handler
          // stays outside the R3F tree.
          window.dispatchEvent(
            new CustomEvent("tsi:tree-shake", {
              detail: {
                x: n.treePos[0],
                z: n.treePos[1],
                // Species mirrors TREE_MODELS assignment (index mod 4) so
                // the FX layer can drop the right thing (petals off the
                // blossom, acorns off the cedar).
                species: Number(n.id.split("-")[1] ?? 0) % TREE_MODELS.length,
              },
            })
          );
        } else if (n.kind === "critter" && n.critterSlot !== undefined) {
          // Critters pillar: the catch beat — Critters.tsx owns the arc
          // anim + toast + collection POST.
          window.dispatchEvent(
            new CustomEvent("tsi:critter-catch", { detail: { slot: n.critterSlot } })
          );
        } else if (n.kind === "station" && n.stationAction) {
          // Interiors-lite: stations resolve to sheets / exit / admin lock.
          const action = n.stationAction;
          if (action.startsWith("sheet:")) {
            AudioManager.playSFX("confirm");
            setSheet(action.slice(6) as SheetKey);
          } else if (action === "exit") {
            triggerTransition(() => {
              // just outside each building's door (spec §7.2)
              const spawns: Record<string, [number, number, number]> = {
                hq: [0, 0, -7], shop: [-24, 0, 9], oracle: [0, 0, 26.5],
              };
              setWorldSpawn(spawns[interiorRef.current ?? "hq"]);
              setInterior(null);
              setNearest(null);
            });
            AudioManager.playSFX("exit");
          } else if (action === "admin") {
            window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: "The Admin Room is locked. (T1-T3 access, coming soon)" } }));
          }
        } else if (n.kind === "building" && n.interiorId) {
          // Interiors-lite: enter the room behind the standard fade.
          if (isTransitioning) return;
          triggerTransition(() => {
            setInterior(n.interiorId as "hq" | "shop" | "oracle");
            setNearest(null);
          });
          AudioManager.playSFX("exit");
        } else if (n.kind === "building" && n.href) {
          // Item 14: mapped targets open as sheets over the world — the
          // Canvas keeps running and close is instant. Unmapped hrefs keep
          // the old route navigation (boards straight, buildings faded).
          const key = sheetKeyForHref(n.href);
          if (key) {
            AudioManager.playSFX("confirm");
            setSheet(key);
            return;
          }
          if (isTransitioning) return;
          const cfg = BUILDINGS.find((b) => b.id === n.id);
          const href = n.href;
          if (cfg && cfg.size[2] < 1) router.push(href);
          else triggerTransition(() => router.push(href));
        }
        return;
      }

      if (e.key === "g" || e.key === "G") {
        if (activeNPC) return; // don't pop emote menu while chatting with an NPC
        e.preventDefault();
        setEmoteMenuOpen((o) => !o);
      } else if (e.key === "F1") {
        e.preventDefault();
        setControlsOpen((o) => !o);
      } else if (e.key === "F3") {
        e.preventDefault();
        setDebugOpen((o) => !o);
      } else if (e.key === "F2") {
        // F1.4: screenshot mode — toggle all DOM overlays off so members can
        // grab a clean shot of the world. Press F2 again or ESC to restore.
        e.preventDefault();
        setScreenshotMode((s) => !s);
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setMapOpen((o) => !o);
      } else if (e.key >= "1" && e.key <= "5") {
        // F1.4: 1-5 quick-fire emote slots. Slot N → emoteTypes[N-1].
        if (activeNPC) return;
        const slot = Number(e.key) - 1;
        const emote = emoteTypes[slot];
        if (!emote) return;
        e.preventDefault();
        emotePickRef.current?.(emote);
      } else if (e.key === "Escape") {
        // ESC closes any open in-game overlay (precedence: chat > guestbook
        // > emote menu > server list > controls > debug > screenshot)
        if (activeNPC) { setActiveNPC(null); e.preventDefault(); }
        else if (guestbookOpen) { setGuestbookOpen(false); e.preventDefault(); }
        else if (emoteMenuOpen) { setEmoteMenuOpen(false); e.preventDefault(); }
        else if (controlsOpen) { setControlsOpen(false); e.preventDefault(); }
        else if (debugOpen) { setDebugOpen(false); e.preventDefault(); }
        else if (screenshotMode) { setScreenshotMode(false); e.preventDefault(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeNPC, emoteTypes, guestbookOpen, emoteMenuOpen, controlsOpen, debugOpen, screenshotMode, router, triggerTransition, isTransitioning]);

  useEffect(() => {
    return () => {
      if (emoteClearTimerRef.current) clearTimeout(emoteClearTimerRef.current);
    };
  }, []);

  // G3 (item 10): dim the corner HUD when the player is just vibing —
  // any pointer move or key press brings it back.
  useEffect(() => {
    let timer: number | undefined;
    const wake = () => {
      setHudDim((d) => (d ? false : d));
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHudDim(true), 5000);
    };
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  // Sprint F1.3: hold Tab → show server list overlay; release → hide.
  // Guarded against typing in inputs so Tab still navigates forms.
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };
    const down = (e: KeyboardEvent) => {
      if (e.key === "Tab" && !isTyping()) {
        e.preventDefault();
        setTabHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Tab") setTabHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const handleEmotePick = useCallback((emote: EmoteType) => {
    setActiveEmote(emote);
    if (emoteClearTimerRef.current) clearTimeout(emoteClearTimerRef.current);
    emoteClearTimerRef.current = setTimeout(() => {
      setActiveEmote(null);
      emoteClearTimerRef.current = null;
    }, 3500);

    const pos = playerPosRef.current;
    void fetch("/api/emotes/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emote_type_id: emote.id,
        world_x: pos.x,
        world_z: pos.z,
      }),
    }).catch(() => {
      // Silent — emote played client-side even if log fails.
    });
  }, []);
  // Keep the ref pointed at the latest handler for the keydown effect.
  // Writing the ref in a layout effect (instead of during render) avoids
  // the React "no side-effects during render" lint rule. The keydown
  // listener registered on mount calls `emotePickRef.current?.(emote)`
  // so it will always see the up-to-date handler.
  useEffect(() => {
    emotePickRef.current = handleEmotePick;
  }, [handleEmotePick]);

  // Art pass 2026-07-07: shadow maps are gone for good — the New Leaf
  // look grounds everything on blob discs (BlobShadows), which the 3DS
  // games used precisely because it's nearly free. The old PCF-soft pass
  // cost ~7 FPS on M1. graphicsSettings.shadows now gates the blob layer
  // (and doubles as the ambient-density proxy it already was).
  //
  // Pixelated render target (Time on Frog Island reference): render at
  // 0.66 CSS-pixel ratio and let the browser upscale with nearest — the
  // chunky-pixel look IS the optimization (~40-60% fewer fragments than
  // dpr 1-2). DOM UI stays crisp on top. Toggle in Graphics settings.
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100vh",
        background: skyBase,
        position: "relative",
        // G3 (item 18): soft round cursor; a warm ring when E has a target.
        cursor: nearest
          ? 'url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27><circle cx=%2712%27 cy=%2712%27 r=%277%27 fill=%27none%27 stroke=%27%23FFDD87%27 stroke-width=%273%27/><circle cx=%2712%27 cy=%2712%27 r=%272%27 fill=%27%23FFDD87%27/></svg>") 12 12, pointer'
          : 'url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2720%27 height=%2720%27><circle cx=%2710%27 cy=%2710%27 r=%275%27 fill=%27%23FFFFFF%27 fill-opacity=%270.9%27 stroke=%27%233D3A2E%27 stroke-width=%272%27/></svg>") 10 10, auto',
      }}
    >
      <Canvas
        gl={{ antialias: false, powerPreference: "high-performance" }}
        dpr={graphicsSettings.pixelated ? 0.66 : [1, 2]}
        camera={{ fov: 48, near: 0.1, far: 300, position: [0, 19, -24] }}
        shadows="soft" /* P-light v2 2026-07-13: PCFSoft maps; the sun only casts when the shadows setting is on */
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.domElement.style.imageRendering = "pixelated";
        }}
      >
        <WarmupProbe onReady={() => setWorldReady(true)} />
        {interior !== null && (() => {
          const Room = interior === "hq" ? HQInterior : interior === "shop" ? ShopInterior : OracleInterior;
          return (
            <Room
              frozen={sheet !== null || isTransitioning}
              playerPosRef={playerPosRef}
              onNearestStation={(st: InteriorStation | null) =>
                setNearest(st ? { kind: "station", id: `station-${st.id}`, name: st.name, stationAction: st.action } : null)
              }
            />
          );
        })()}
        {interior === null && (
        <Suspense fallback={null}>
          <Scene
            playerName={playerName}
            introReady={gateDone}
            weather={weather}
            spawn={worldSpawn}
            playerLevel={playerLevel}
            fogColor={fogColor}
            todPhase={todPhase}
            onNPCClick={setActiveNPC}
            onNearestInteractable={setNearest}
            debugSnapshotRef={debugSnapshotRef}
            activeEmote={activeEmote}
            playerPosRef={playerPosRef}
            ambientDensity={graphicsSettings.shadows ? 1 : 0.7}
            blobShadows={graphicsSettings.shadows}
            azimuthRef={azimuthRef}
          />
          {/* G4 — bloom + vignette. Inside Suspense so it doesn't block
              first paint. Bloom respects the graphics setting; vignette
              always-on (cheap). Lite mode disables the whole pipeline. */}
          <PostFX
            enabled={!liteMode}
            bloom={graphicsSettings.bloom}
            bloomIntensity={todPhase === "dusk" ? 0.75 : todPhase === "night" ? 0.45 : todPhase === "dawn" ? 0.4 : 0.18}
          />
        </Suspense>
        )}
      </Canvas>
      {!gateDone && <LoadGateOverlay ready={worldReady} onGone={() => setGateDone(true)} />}
      {/* F1.4: screenshot mode hides ALL DOM overlays. DebugOverlay also
          stays hidden so the shot is clean. F2 restores. ESC also restores. */}
      <div style={{ display: screenshotMode ? "none" : "contents" }}>
        <AudioController phase={todPhase} />
        <NPCChatOverlay npc={activeNPC} onClose={() => setActiveNPC(null)} />
        <EmoteMenu
          open={emoteMenuOpen}
          onClose={() => setEmoteMenuOpen(false)}
          onPick={handleEmotePick}
        />
        <FishingOverlay />
        <CollectionBook open={collectionOpen} onClose={() => setCollectionOpen(false)} />

        <GuestbookOverlay
          open={guestbookOpen}
          onClose={() => setGuestbookOpen(false)}
        />
        <ServerListOverlay visible={tabHeld} />
        <ControlsOverlay visible={controlsOpen} onClose={() => setControlsOpen(false)} />
        <WelcomeOverlay />
        <GraphicsSettingsPanel open={graphicsOpen} onClose={() => setGraphicsOpen(false)} />
        <OverlaySheet sheet={sheet} onClose={() => setSheet(null)} />
        <Crosshair active={nearest !== null} hint={nearest?.name ?? null} />
        {!interior && <Compass azimuthRef={azimuthRef} />}
        {!interior && <TodBadge phase={todPhase} />}
        <StatsHUD />
        <DebugOverlay visible={debugOpen} snapshotRef={debugSnapshotRef} />
      </div>
      {/* F1.4: tiny restore hint in screenshot mode so users know how to exit. */}
      {screenshotMode && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 80,
            padding: "4px 12px",
            fontSize: 10,
            color: "rgba(255,255,255,0.55)",
            background: "rgba(0,0,0,0.4)",
            borderRadius: 4,
            fontFamily: "'IBM Plex Mono', monospace",
            letterSpacing: "0.05em",
            pointerEvents: "none",
          }}
        >
          F2 / ESC to restore UI
        </div>
      )}
      {/* Item 12: the toolbelt dock — one bottom-center bar replaces the
          four buttons that had accreted along the bottom-right (Emote /
          Guestbook / Collection / Graphics), plus Map and Controls get
          clickable homes for mouse-only players. Hidden in screenshot mode;
          rides the same HUD auto-dim. */}
      {!screenshotMode && (
      <div
        style={{ opacity: hudDim ? 0.22 : 1, transition: "opacity 0.7s ease" }}
        onClickCapture={() => AudioManager.playSFX("click")}
      >
        <ToolDock
          items={[
            { id: "emote", icon: <Smile size={17} />, label: "Emote", hotkey: "G", onClick: () => setEmoteMenuOpen((o) => !o) },
            { id: "map", icon: <MapIcon size={17} />, label: "Map", hotkey: "M", onClick: () => setMapOpen((o) => !o) },
            { id: "collection", icon: <span style={{ fontSize: 16 }}>🧺</span>, label: "Items", onClick: () => setCollectionOpen((o) => !o) },
            { id: "guestbook", icon: <BookOpen size={17} />, label: "Wall", onClick: () => setGuestbookOpen((o) => !o) },
            { id: "controls", icon: <Keyboard size={17} />, label: "Keys", hotkey: "F1", onClick: () => setControlsOpen((o) => !o) },
            { id: "graphics", icon: <Settings2 size={17} />, label: "Video", onClick: () => setGraphicsOpen(true) },
          ]}
        />
      </div>
      )}
      <ToastHub />
      {mapOpen && !screenshotMode && !interior && <MiniMap playerPosRef={playerPosRef} />}
    </div>
  );
}
