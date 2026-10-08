"use client";

/**
 * Weather on the ground (specs/polish/living-village.md deliverable 6): rain splashing on the ground and ringing on
 * puddles, the river and the sea; footprints in snow behind every walker, fading. Both from our painted particle pack
 * (art/fx/build_pack.py): the splashes through a particle system of their own (so a downpour never steals the
 * footsteps' particles), the prints as one instanced decal mesh. World-state rain (lib/game/weatherGround.ts).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MoveParticles, liveWind, packMap, spriteQuad } from "./movement/moveFx";
import { FACE, type ParticlePool, type Recipe } from "@/lib/game/fx/particles";
import { PACK_COLS } from "@/lib/game/fx/pack";
import { worldTime } from "@/lib/game/worldClock";
import { WORLD_SNOW } from "@/lib/game/modelMaterials";
import { Surface, waterHeightAt, worldToCellX, worldToCellZ, type IslandMap } from "@/lib/game/grid";
import { inPuddle, newTrail, printOpacity, rainLandings, stepTrail, type Print, type Trail } from "@/lib/game/weatherGround";
import { walkers } from "@/lib/game/footprintWalkers";
import { GROUND_TOP_ORDER } from "./grid/GridTerrain";

type Ground = (x: number, z: number) => number;
export interface GroundSite {
  map: IslandMap;
  ground: Ground;
  /** The drawn surface (grid Surface): water and boards take no prints. */
  surface?: (x: number, z: number) => number;
  /** The tallest thing at a point (Infinity: a building or trunk, where no drop reaches the ground we see). */
  top?: (x: number, z: number) => number;
  player: React.RefObject<THREE.Vector3>;
}

// ── Rain ───────────────────────────────────────────────────────────────
/** A drop's crown: a few droplets thrown up where it lands. */
const DROP: Recipe = { sprite: "droplets", count: [1, 1], life: [0.3, 0.38], size: [0.6, 0.75], grow: 1, speed: [0.25, 0.6], spread: Math.PI, up: [1.1, 1.8], gravity: 9, drag: 1, wind: 0.1, alpha: 1, face: FACE.billboard };
/** Where it lands, a quick wet ring: clear on hard or bare ground (stone, sand, soil), faint in the grass. */
const DAB: Recipe = { sprite: "ripple", count: [1, 1], life: [0.32, 0.4], size: [0.42, 0.52], grow: 1.5, speed: [0, 0], spread: 0, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 0.55, face: FACE.ground };
const RING: Recipe = { sprite: "ripple", count: [1, 1], life: [0.5, 0.65], size: [0.5, 0.66], grow: 1.6, speed: [0, 0], spread: 0, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 0.5, face: FACE.ground };
const WATER_TINT = 0xe6f4fb, RING_TINT = 0xe4f4fb;
const BARE = new Set<number>([Surface.Stone, Surface.Brick, Surface.Sand, Surface.Soil]);

// One landing context (module scope: the callback is made once, not per frame).
const land = { pool: null as ParticlePool | null, site: null as GroundSite | null, puddles: [] as readonly { x: number; z: number; rx: number; rz: number }[] };
function landDrop(x: number, z: number, seed: number) {
  const { pool, site } = land;
  if (!pool || !site) return;
  const { map } = site, cx = worldToCellX(map, x), cz = worldToCellZ(map, z);
  const s = site.surface ? site.surface(x, z) : Surface.Grass;
  if (s === Surface.River || s === Surface.Void) {
    // Open water: a ring on the surface.
    const y = cx >= 0 && cz >= 0 && cx < map.width && cz < map.depth ? waterHeightAt(map, cx, cz) : -0.078;
    pool.burst(RING, x, y + 0.01, z, y, 0, 0, 1, RING_TINT, seed);
    return;
  }
  if (site.top && site.top(x, z) === Infinity) return;
  const y = site.ground(x, z);
  if (inPuddle(x, z, land.puddles)) pool.burst(RING, x, y + 0.02, z, y, 0, 0, 0.8, RING_TINT, seed);
  else pool.burst(DAB, x, y + 0.02, z, y, 0, 0, 1, RING_TINT, seed ^ 0x27d4eb2f, BARE.has(s) ? 1 : 0.5);
  pool.burst(DROP, x, y, z, y, 0, 0, 1, WATER_TINT, seed ^ 0x5bd1e995);
}

const _cam = new THREE.Vector3(), _dir = new THREE.Vector3();
function RainSplashes({ site, puddles }: { site: GroundSite; puddles: readonly { x: number; z: number; rx: number; rz: number }[] }) {
  const fx = useMemo(() => new MoveParticles(), []);
  useEffect(() => () => fx.dispose(), [fx]);
  const last = useRef(-1);
  useFrame((state, raw) => {
    const t = worldTime();
    state.camera.getWorldPosition(_cam);
    state.camera.getWorldDirection(_dir);
    const k = _dir.y < -0.05 ? Math.min(-_cam.y / _dir.y, 60) : 60;
    land.pool = fx.pool; land.site = site; land.puddles = puddles;
    // A long gap (a hidden tab, the first frame) lands nothing extra: only the last frame's worth.
    rainLandings(last.current < 0 || t - last.current > 0.25 ? t - Math.min(raw, 0.05) : last.current, t, _cam.x + _dir.x * k, _cam.z + _dir.z * k, landDrop);
    last.current = t;
    fx.tick(state.clock.elapsedTime, Math.min(raw, 0.1), state.camera, liveWind());
  });
  return <primitive object={fx.mesh} />;
}

// ── Footprints in snow ─────────────────────────────────────────────────
const MAX_PRINTS = 220;
/** A print about a third of a unit long (the sprite's sole and heel fill most of the cell), shaded the blue of snow in shadow. */
const PRINT_SIZE = 0.46;
const PRINT_TINT = "#6c84a6";

function printMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ name: "SnowPrints", map: packMap(), color: PRINT_TINT, roughness: 1, metalness: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.onBeforeCompile = shader => {
    shader.vertexShader = "attribute vec2 aPrint;\nvarying float vFade;\n" + shader.vertexShader
      .replace("#include <uv_vertex>", `#include <uv_vertex>
  vMapUv.x += aPrint.x / ${PACK_COLS.toFixed(1)};
  vFade = aPrint.y;`);
    // The sprite gives the print its shape (alpha); its colour is the snow's own shade in the dent.
    shader.fragmentShader = "varying float vFade;\n" + shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
  diffuseColor.rgb = diffuse;
  diffuseColor.a *= vFade * 0.85;
  if (diffuseColor.a < 0.004) discard;`);
  };
  m.customProgramCacheKey = () => "snow-prints-v2";
  // Mirrored (left) feet turn their faces over.
  m.side = THREE.DoubleSide;
  return m;
}

/**
 * After every ground layer (GridTerrain groundRenderOrder). The beach and the paths are see-through overlays that do not
 * write depth, so prints drawn before them were painted over: no prints in snow on sand or a path (audit 2026-10 world
 * item 15).
 */
export const PRINT_ORDER = GROUND_TOP_ORDER + 1;

interface PrintSlot { x: number; z: number; y: number; yaw: number; left: boolean; born: number; frame: number }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _print: Print = { x: 0, z: 0, yaw: 0, left: false };

/** Module scope (the react compiler forbids writing through hook values): the prints being written this frame. */
const prints = { slots: [] as PrintSlot[], trails: new Map<string, Trail>(), next: 0, site: null as GroundSite | null, t: 0 };
function stamp(id: string, x: number, z: number) {
  let trail = prints.trails.get(id);
  if (!trail) prints.trails.set(id, trail = newTrail());
  stepTrail(trail, x, z, _print, leavePrint);
}
function leavePrint(p: Print) {
  const site = prints.site!, s = site.surface ? site.surface(p.x, p.z) : Surface.Grass;
  if (s === Surface.Wood || s === Surface.River || s === Surface.Void) return;
  const slot = prints.slots[prints.next];
  prints.next = (prints.next + 1) % prints.slots.length;
  slot.x = p.x; slot.z = p.z; slot.y = site.ground(p.x, p.z); slot.yaw = p.yaw; slot.left = p.left; slot.born = prints.t;
  slot.frame = Math.floor(((p.x * 13.7 + p.z * 7.3) % 8 + 8) % 8);
}
/** Stamp new prints behind the player and every visible resident, and age the old ones. */
function tickPrints(mesh: THREE.InstancedMesh, attr: THREE.InstancedBufferAttribute, slots: PrintSlot[], site: GroundSite, snowy: boolean) {
  const t = worldTime();
  prints.slots = slots; prints.site = site; prints.t = t;
  if (snowy) {
    const pl = site.player.current;
    stamp("player", pl.x, pl.z);
    for (const w of walkers.values()) if (w.visible) stamp(w.id, w.x, w.z);
  }
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i], o = s.born > 0 ? printOpacity(t - s.born) : 0;
    // Toes point the way they walked (the sprite's toes are up the cell, −z once laid flat); the left foot mirrored.
    _m.compose(_p.set(s.x, s.y + 0.012, s.z), _q.setFromEuler(_e.set(0, s.yaw + Math.PI, 0)), _s.set(s.left ? -PRINT_SIZE : PRINT_SIZE, 1, PRINT_SIZE));
    mesh.setMatrixAt(i, _m);
    attr.setXY(i, s.frame, o);
  }
  mesh.instanceMatrix.needsUpdate = true;
  attr.needsUpdate = true;
}

function SnowFootprints({ site }: { site: GroundSite }) {
  const { geometry, attr, material } = useMemo(() => {
    const g = spriteQuad("footprint", 0, 1);
    g.rotateX(-Math.PI / 2);
    const a = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PRINTS * 2), 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aPrint", a);
    return { geometry: g, attr: a, material: printMaterial() };
  }, []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const slots = useRef(Array.from({ length: MAX_PRINTS }, (): PrintSlot => ({ x: 0, z: 0, y: -100, yaw: 0, left: false, born: 0, frame: 0 })));
  useFrame(() => { if (mesh.current) tickPrints(mesh.current, attr, slots.current, site, WORLD_SNOW.value >= 0.5); });
  return <instancedMesh ref={mesh} args={[geometry, material, MAX_PRINTS]} frustumCulled={false} receiveShadow renderOrder={PRINT_ORDER} />;
}

/** Rain on the ground in rain; footprints whenever the ground is snowed over. */
export default function WeatherGround({ site, rain, snow, puddles }: { site: GroundSite; rain: boolean; snow: boolean; puddles: readonly { x: number; z: number; rx: number; rz: number }[] }) {
  return <>
    {rain && <RainSplashes site={site} puddles={puddles} />}
    {snow && <SnowFootprints site={site} />}
  </>;
}
