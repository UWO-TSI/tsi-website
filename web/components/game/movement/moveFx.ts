/**
 * The movement kit's juice (specs/movement.md, specs/movement-feel.md; look
 * spec §7.1): the particle system that draws our painted pack, the FOV, and
 * the touch stick. PlayerAvatar throws particles from each sim step's events
 * and foot contacts, on the avatar that moved (lib/game/movement/juice.ts).
 */
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CharacterMotion, ClipName } from "@/lib/game/character/clips";
import { footprint, footstep, groundUnder } from "@/lib/game/movement/juice";
import { WORLD_SNOW } from "@/lib/game/modelMaterials";
import { juiceFovOffset } from "@/lib/game/cameraJuice";
import { PACK, PACK_COLS, PACK_ROWS, PACK_URL, type SpriteName } from "@/lib/game/fx/pack";
import { ParticlePool } from "@/lib/game/fx/particles";
import { liveIslandWeather } from "@/lib/game/islandWeather";
import type { MoveEvent } from "@/lib/game/movement/sim";
import { worldWind, type WorldWind } from "@/lib/game/worldFx";
import { WATER_SWELL } from "@/lib/game/waterShader";
import { waterSurfaceUniforms } from "../grid/terrainMaterials";
import type { IslandWeather } from "@/lib/game/islandWeather";

/** Feel values on the renderer's side, tuned next to the sim's in /lab/move. */
export const MOVE_JUICE = {
  camLead: 0.1, // seconds of velocity the camera looks ahead by (capped at 1.5u)
  fovKick: 2.5, // degrees wider at top speed
  dashKick: 2, // degrees the FOV punches out on a dash
  squash: 1, // squash and stretch amount
  // Each effect's amount (0 turns it off): /lab/move's Juice panel.
  footsteps: 1, // flecks, grains and puffs at each foot contact
  takeoff: 1, // dust kicked back at a jump
  landing: 1, // motes, the dust ring, the heavy burst
  dashBurst: 1, // the dash's burst of dust (a puff of air in the air)
  streaks: 1, // soft speed streaks through a dash and at top speed
  afterimage: 1, // the dash's faint afterimages
  cooldown: 1, // wind at the heels while the dash recharges
  anticipation: 1, // the jump's crouch before the spring
  camDip: 1, // the camera's dip on a heavy landing
  // The slide (specs/movement-slide.md)
  slideTrail: 1, // dust off the heels, the ground's spray (flecks, sand) and scuffs
  slideBurst: 1, // the spray of a dash- or land-slide, the pop of a slide-jump
  slideKick: 1.5, // degrees the FOV punches out as a slide starts
  slideDrop: 0.18, // how far the camera's focus drops while sliding (world units)
  // Milestone 2 (specs/movement-feel.md)
  prints: 1, // footprints on sand, wet sand and snow
  skid: 1, // the skid's kick, scuffs, trail and push-off
  mantle: 1, // the puffs under the hands, grains off the lip, the step up
  glide: 1, // leaf bits and the air push on opening, wind ribbons at speed, the set-down
  splash: 1, // droplets and ripples, sized by the drop
  roll: 1, // the roll's tumbles, trail and pop-up
};
export type MoveJuice = typeof MOVE_JUICE;
/** The follow camera's field of view at a walk (the Canvases' camera); speed and dashes widen it from here. */
export const BASE_FOV = 48;

/** Touch intent (screen space: x right, z up the screen) and presses waiting for the sim; TouchControls writes it, the avatar reads it. `crouch`: the Slide button held. */
export interface StickInput { x: number; z: number; jump: boolean; jumpPressed: boolean; dashPressed: boolean; crouch: boolean }
export const touchStick: StickInput = { x: 0, z: 0, jump: false, jumpPressed: false, dashPressed: false, crouch: false };

/**
 * What the HUD reads. `momentum`: speed over a walk carried by tech ("kept": in the air, sliding, dashing or in the
 * grace after a landing) or bleeding back on plain ground ("bleeding"); "" at a run or slower.
 */
export interface MoveTelemetry { x: number; y: number; z: number; speed: number; mode: string; hops: number; dashReady: boolean; long: boolean; momentum: "" | "kept" | "bleeding"; slideJump: boolean }
/** The HUD's momentum status for a sim state (David's momentum model, specs/movement-slide.md). */
export function momentumOf(s: { mode: string; dashT: number; keep: number; bleed: boolean }, speed: number, walkSpeed: number, sprintSpeed: number): MoveTelemetry["momentum"] {
  if (s.bleed) return "bleeding";
  const tech = s.mode === "slide" || s.mode === "air" || s.mode === "glide" || s.dashT > 0 || s.keep > 0;
  return (tech && speed > walkSpeed + 0.05) || speed > sprintSpeed + 0.05 ? "kept" : "";
}
export const TAKEOFF = new Set<MoveEvent["kind"]>(["jump", "hop", "long", "dashjump"]);
/** Particles a scene's system holds at once (all avatars and the ruins' puffs together), and footprints apart from them. */
const FX_CAPACITY = 384, PRINT_CAPACITY = 160;

// ── The movement particles: our painted pack, one instanced draw per scene ──
let packTexture: THREE.Texture | null = null;
/** The pack atlas (art/fx/build_pack.py), loaded once and shared. */
export function packMap(): THREE.Texture {
  if (!packTexture) {
    packTexture = new THREE.TextureLoader().load(PACK_URL);
    packTexture.colorSpace = THREE.SRGBColorSpace;
    packTexture.anisotropy = 4;
  }
  return packTexture;
}

/** Ground fade (world units): a puff standing on the ground fades out into it instead of being cut by it. */
const SOFT = 0.14;
/** The particle quad's shader chunks, shared with zone 1's mob effects (components/game/combat/MobFx.tsx). */
export const VERTEX_PARS = `attribute vec4 iA;
attribute vec4 iB;
attribute vec4 iC;
attribute vec4 iD;
varying vec4 vTint;
varying float vAbove;
`;
/**
 * Every particle is a quad placed in the vertex shader from its instance data (particles.ts): facing the camera
 * (centred, or standing on its bottom edge), flat on the ground, or a streak along its axis turned to the camera.
 * Its normal leans up and toward the eye, so the sun and the sky light it like the world round it.
 */
export const PLACE_NORMAL = `vec3 pCentre = iA.xyz;
vec3 toCam = normalize(cameraPosition - pCentre);
vec3 axX = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
vec3 axY = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
vec3 objectNormal = normalize(vec3(0.0, 0.55, 0.0) + toCam * 0.45);
float face = iD.w;
bool onGround = (face > 0.5 && face < 1.5) || face > 3.5; // flat: on the ground, or on the water
if (onGround) { axX = vec3(1.0, 0.0, 0.0); axY = vec3(0.0, 0.0, -1.0); objectNormal = vec3(0.0, 1.0, 0.0); }
else if (face > 1.5 && face < 2.5) { axX = normalize(iD.xyz); axY = normalize(cross(toCam, axX)); }
`;
export const PLACE_VERTEX = `float pc = cos(iB.z), ps = sin(iB.z);
vec2 lp = position.xy * iB.xy;
if (face > 2.5 && face < 3.5) lp.y += 0.3 * iB.y; // standing: the painted ground line (0.2 up the cell) on the point
vec3 transformed = pCentre + axX * (lp.x * pc - lp.y * ps) + axY * (lp.x * ps + lp.y * pc);
vAbove = onGround ? 10.0 : transformed.y - iA.w;
vTint = iC;
`;
/** The pack cell a particle shows (its row and frame from the instance data), shared with the glow layer (GlowFx). */
export const PICK_FRAME = `{
  float pRow = floor((iB.w + 0.5) / ${PACK_COLS.toFixed(1)});
  float pCol = iB.w - pRow * ${PACK_COLS.toFixed(1)};
  vMapUv = vec2((pCol + uv.x) / ${PACK_COLS.toFixed(1)}, 1.0 - (pRow + 1.0 - uv.y) / ${PACK_ROWS.toFixed(1)});
}`;

let particleMaterial: THREE.MeshStandardMaterial | null = null;
/** Matte and lit like the world's own surfaces (it gets the sun, the sky, the environment and the look grade). */
function moveParticleMaterial(): THREE.MeshStandardMaterial {
  if (particleMaterial) return particleMaterial;
  const m = new THREE.MeshStandardMaterial({ name: "MoveParticles", map: packMap(), roughness: 1, metalness: 0, transparent: true, depthWrite: false });
  m.onBeforeCompile = shader => {
    // On the water (FACE.water) a particle rides the swell the water draws: the same function, the same live uniforms.
    const u = waterSurfaceUniforms();
    Object.assign(shader.uniforms, { uTime: u.uTime, uWaveHeight: u.uWaveHeight, uWaveScale: u.uWaveScale, uWaveSpeed: u.uWaveSpeed });
    shader.vertexShader = VERTEX_PARS + WATER_SWELL + shader.vertexShader
      .replace("#include <uv_vertex>", `#include <uv_vertex>\n${PICK_FRAME}`)
      .replace("#include <beginnormal_vertex>", PLACE_NORMAL)
      .replace("#include <begin_vertex>", `${PLACE_VERTEX}\nif (face > 3.5) { vec2 swellSlope; transformed.y += waterSwell(transformed.xz, swellSlope); }`);
    shader.fragmentShader = "varying vec4 vTint;\nvarying float vAbove;\n" + shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
  diffuseColor *= vTint;
  diffuseColor.a *= smoothstep(0.0, ${SOFT.toFixed(2)}, vAbove);
  if (diffuseColor.a < 0.003) discard;`);
  };
  m.customProgramCacheKey = () => "move-particles-v2";
  return (particleMaterial = m);
}

const camPos = new THREE.Vector3(), camDir = new THREE.Vector3();
/** One pool drawn as one instanced quad mesh in our pack, sorted back to front. */
class PoolMesh {
  readonly mesh: THREE.Mesh;
  private readonly geometry = new THREE.InstancedBufferGeometry();
  private readonly attrs: THREE.InstancedBufferAttribute[];
  /** Drawn once (empty) with the scene, so its shader compiles at load, not as the first puff hitches a frame. */
  private warm = false;
  constructor(readonly pool: ParticlePool, label: string, renderOrder: number) {
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    for (const name of ["position", "normal", "uv"]) this.geometry.setAttribute(name, quad.getAttribute(name));
    this.attrs = [this.pool.a, this.pool.b, this.pool.c, this.pool.d].map((array, k) => {
      const attr = new THREE.InstancedBufferAttribute(array, 4).setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute(`i${"ABCD"[k]}`, attr);
      return attr;
    });
    this.geometry.instanceCount = 0;
    this.mesh = new THREE.Mesh(this.geometry, moveParticleMaterial());
    this.mesh.name = label;
    this.mesh.frustumCulled = false; // placed in the shader; the pool is small
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = renderOrder;
    this.mesh.onAfterRender = () => { this.warm = true; };
  }
  step(dt: number, wind: { x: number; z: number }) {
    this.pool.update(dt, wind.x, wind.z);
    const n = this.pool.write(camPos.x, camPos.y, camPos.z, camDir.x, camDir.y, camDir.z);
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0 || !this.warm;
    if (!n) return;
    for (const a of this.attrs) { a.clearUpdateRanges(); a.addUpdateRange(0, n * 4); a.needsUpdate = true; }
  }
  dispose() { this.geometry.dispose(); }
}
/**
 * The movement particle system (specs/movement-feel.md deliverable 2): a ParticlePool drawn as one instanced quad
 * mesh, sorted back to front, in our pack, and a second for the footprints (a decal pool, drawn under the effects),
 * so a burst of dust never pushes out a print. Shared by everything in a scene that throws particles (useMoveParticles).
 */
export class MoveParticles {
  readonly pool = new ParticlePool(FX_CAPACITY);
  readonly prints = new ParticlePool(PRINT_CAPACITY);
  // Over the terrain's painted sand and soil layers (transparent, render orders 2 and 3), under ambience sprites (4).
  private readonly layers = [new PoolMesh(this.prints, "MovePrints", 3.5), new PoolMesh(this.pool, "MoveParticles", 3.6)];
  readonly meshes = this.layers.map(l => l.mesh);
  /** The effects layer alone, for a system of its own that never throws prints (the rain's splashes, WeatherGround). */
  readonly mesh = this.meshes[1];
  private stamp = -1;
  /** Step and draw, once per frame: the first caller's `dt` wins (the avatar's slow motion and pauses), the rest are skipped. */
  tick(stamp: number, dt: number, camera: THREE.Camera, wind: { x: number; z: number }) {
    if (stamp === this.stamp) return;
    this.stamp = stamp;
    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camDir);
    for (const l of this.layers) l.step(dt, wind);
  }
  clear() { this.pool.clear(); this.prints.clear(); }
  dispose() { for (const l of this.layers) l.dispose(); }
}

let windOf: IslandWeather | null = null, wind: WorldWind = worldWind("clear");
/** The shared world wind for the live weather (one object per weather change, none per frame). */
export function liveWind(): WorldWind {
  const w = liveIslandWeather();
  if (w !== windOf) { windOf = w; wind = worldWind(w); }
  return wind;
}

const SHARED = new WeakMap<THREE.Object3D, { fx: MoveParticles; users: number }>();
/** The scene's movement particles: one system per scene however many avatars (and the ruins) throw into it. */
export function useMoveParticles(): MoveParticles {
  const scene = useThree(s => s.scene);
  const fx = useMemo(() => {
    let e = SHARED.get(scene);
    if (!e) SHARED.set(scene, e = { fx: new MoveParticles(), users: 0 });
    return e.fx;
  }, [scene]);
  useEffect(() => {
    const e = SHARED.get(scene)!;
    if (e.users++ === 0) scene.add(...e.fx.meshes);
    return () => { if (--e.users === 0) { scene.remove(...e.fx.meshes); e.fx.clear(); e.fx.dispose(); } };
  }, [scene]);
  // Steps at real time unless an avatar already stepped it this frame (its slow motion and dev pauses win).
  useFrame((state, delta) => fx.tick(state.clock.elapsedTime, Math.min(delta, 0.1), state.camera, liveWind()));
  return fx;
}

/** How much of the player's footstep dust a resident's steps throw (no sound: a crowd of them would clatter). */
export const RESIDENT_STEPS = 0.6;
/** The ground a resident walks: the drawn surface and the water (for wet sand). */
export interface StepWorld { surface: (x: number, z: number) => number; wet: (x: number, z: number) => boolean }
const stepAt = new THREE.Vector3();
/**
 * Footstep dust for a character the player doesn't drive (residents, the dev crowd; look spec §7.1: effects draw on
 * every avatar that moves): each foot contact its Character counts throws the ground's puff, flecks or grains from
 * that foot, quieter than the player's and silent, a ripple on a rain day, and a print on sand and snow.
 */
export function useStepDust(motion: RefObject<CharacterMotion>, anchor: RefObject<THREE.Object3D | null>, world?: StepWorld, amount = RESIDENT_STEPS) {
  const particles = useMoveParticles();
  const seen = useRef<number | null>(null);
  useFrame(() => {
    const m = motion.current, a = anchor.current;
    if (!m || !a || m.steps === undefined || m.steps === seen.current) return;
    const first = seen.current === null;
    seen.current = m.steps;
    if (first || m.speed < 0.3 || amount <= 0) return;
    a.getWorldPosition(stepAt);
    const side = m.foot === 0 ? 0.1 : -0.1, yaw = m.yaw, px = stepAt.x + Math.cos(yaw) * side + Math.sin(yaw) * 0.05, pz = stepAt.z - Math.sin(yaw) * side + Math.cos(yaw) * 0.05;
    const g = groundUnder(world?.surface(px, pz), WORLD_SNOW.value, world?.wet ?? (() => false), px, pz);
    footstep(particles.pool, g, px, stepAt.y, pz, Math.sin(yaw) * m.speed, Math.cos(yaw) * m.speed, liveIslandWeather() === "rain", amount);
    footprint(particles.prints, g, px, stepAt.y, pz, yaw, amount);
  });
}

/** A flat quad showing one frame of a pack sprite (the combat target marker): its UVs pick the cell. */
export function spriteQuad(sprite: SpriteName, frame = 0, size = 1): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(size, size), uv = g.getAttribute("uv") as THREE.BufferAttribute, row = PACK[sprite].row;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (frame + uv.getX(i)) / PACK_COLS, 1 - (row + 1 - uv.getY(i)) / PACK_ROWS);
  return g;
}

// Module scope: three objects from hooks are frozen to the react compiler inside component code.
export function applyFov(camera: THREE.Camera, target: number, dt: number) {
  const cam = camera as THREE.PerspectiveCamera;
  if (!cam.isPerspectiveCamera) return;
  const fov = THREE.MathUtils.damp(cam.fov, target - juiceFovOffset(dt), 6, dt);
  if (Math.abs(fov - cam.fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
}
export function screenOf([x, y, z]: [number, number, number], camera: THREE.Camera, canvas: HTMLCanvasElement) {
  const v = new THREE.Vector3(x, y + 0.7, z).project(camera), r = canvas.getBoundingClientRect();
  return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
}

/** One-shot clip per event (the character plays it once over locomotion). */
export const EVENT_CLIP: Partial<Record<MoveEvent["kind"], ClipName>> = { jump: "Jump", hop: "Jump", long: "Jump", dashjump: "Jump", roll: "Roll", mantle: "Mantle", dash: "Dash", recover: "LandHeavy",
  // The slide (specs/movement-slide.md): a drop from the run; a sharper, lower one out of a dash or a landing; the spring out. Its exits are by state (PlayerAvatar).
  slide: "SlideIn", dashslide: "SlideInDash", landslide: "SlideInDash", slidejump: "SlideJump" };
