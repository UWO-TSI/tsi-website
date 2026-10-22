"use client";

/**
 * The beach campfire (specs/v1-drop.md §3): the bonfire stack on the sand, lit every real night on the shared world
 * clock. By it, the emote wheel's Sit seats you in a ring facing the fire and a dance joins the stomp ring round it
 * (lib/game/emotePlay.ts); here it burns, and every dancer in the ring makes it bigger and brighter and adds a drum
 * layer (six play the full song, lib/game/campfire.ts).
 *
 * The stack is our own (art/props/build_campfire.py, David 2026-10-14 "do stone ringed"): a ring of river stones, a bark
 * log teepee over an ember bed whose glow (M_Embers' emissive map) eases with the fire's light, dark by day.
 *
 * Cost (specs/perf/budget.md): the stack is one GLB in three primitives; the flames and embers are one pooled particle system in
 * one draw (the combat pack's fire tongue and light mote through a fire ramp, additive), seeded from the world clock
 * so everyone sees the same flicker, nothing allocated per frame; the glow is ONE point light, mounted with the scene
 * and eased (dark by day), never added or removed, so no material recompiles and no light per character. The drums are
 * loop layers in the audio manager (Web Audio, mute-aware), heard within FIRE.drumFar.
 */
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { prepareModel, disposeModelMaterials } from "@/lib/game/modelMaterials";
import { shadowClassFor } from "@/lib/game/shadows";
import { CAMPFIRE_URL } from "@/lib/game/propModels";
import { modelContact, useContactShadow } from "../ContactShadows";
import { FACE, ParticlePool, seedAt, type Recipe } from "@/lib/game/fx/particles";
import type { CombatSprite } from "@/lib/game/fx/combatPack";
import { RampTable, sharedRamps, type Ramp } from "@/lib/game/fx/combat";
import { FIRE_PACK, FIRE_PACK_ROWS, FIRE_PACK_URL, createCombatParticleMaterial, packTexture, rampMap } from "@/lib/game/fx/fxMaterial";
import { DRUM_LAYERS, FIRE, drumDistanceGain, drumLayers, fireLit, fireScale, type Spot } from "@/lib/game/campfire";
import { campfireLive, countPosed } from "@/lib/game/danceField";
import { eventSolids } from "@/lib/game/defaultIsland";
import { worldTime } from "@/lib/game/worldClock";
import { hash01 } from "@/lib/game/worldFx";
import { AudioManager } from "@/lib/game/audio";
import { localAvatar } from "@/lib/net/localAvatar";
import type { IslandPhase } from "@/lib/game/islandTime";

/** The stack's model (1.4 across its stone ring, the teepee 0.85 tall), drawn at its own size. */
const STACK_URL = CAMPFIRE_URL;
/** The ember bed's glow at the fire's full light (its emissive map, eased with the light). */
const EMBER_GLOW = 1.6;
useGLTF.preload(STACK_URL);
/** Half the stack's footprint: you walk round its stone ring (0.8 out), never through. */
const SOLID_HALF = 0.72;
const FIRE_RAMP: Ramp = ["#fff4d6", "#ffaa3c", "#d8441a"];
/** A tongue of flame: licks up out of the stack and tears off (its flipbook plays once over its life). */
const TONGUE: Recipe<CombatSprite> = { sprite: "flame", count: [1, 1], life: [0.55, 0.85], size: [0.8, 1.1], grow: 0.85, speed: [0.02, 0.08], spread: Math.PI,
  up: [0.35, 0.55], gravity: 0, drag: 1.5, wind: 0.15, lift: 0.5, alpha: 0.95, face: FACE.standing, jitter: 0.2, rise: [0.05, 0.15], fadeIn: 8 };
/** An ember: a spark that rises, wanders and fades. */
const EMBER: Recipe<CombatSprite> = { sprite: "mote", count: [1, 1], life: [1.2, 2.0], size: [0.07, 0.1], grow: 0.4, speed: [0.05, 0.25], spread: Math.PI,
  up: [0.9, 1.4], gravity: 0, drag: 0.6, wind: 0.5, lift: 0.9, alpha: 1, face: FACE.billboard, jitter: 0.25, rise: [0.5, 0.8], fadeIn: 12 };
/** A tongue every TONGUE_S, an ember every EMBER_S (bigger fires throw more of both: burst's count scales). */
const TONGUE_S = 0.09, EMBER_S = 0.16;
/** The glow's strength at night with nobody dancing, and how far it reaches. */
const LIGHT = { intensity: 5, distance: 11, decay: 1.7, height: 1.15 } as const;
/** How fast the fire grows and dies down (1/s). */
const EASE = 2.2;


/** The flames and embers, in the fire's own frame (the group stands on the ground under the stack). */
class FireSystem {
  readonly pool = new ParticlePool(64, FIRE_PACK);
  readonly mesh: THREE.Mesh;
  private readonly attrs: THREE.InstancedBufferAttribute[];
  private readonly geometry = new THREE.InstancedBufferGeometry();
  private readonly row: number;
  private tongue = -1;
  private ember = -1;
  constructor() {
    const ramps = (sharedRamps.table ??= new RampTable());
    this.row = ramps.row(FIRE_RAMP);
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    for (const n of ["position", "uv"]) this.geometry.setAttribute(n, quad.getAttribute(n));
    this.attrs = [this.pool.a, this.pool.b, this.pool.c, this.pool.d].map((arr, k) => {
      const a = new THREE.InstancedBufferAttribute(arr, 4).setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute(`i${"ABCD"[k]}`, a);
      return a;
    });
    this.geometry.instanceCount = 0;
    this.mesh = new THREE.Mesh(this.geometry, createCombatParticleMaterial(packTexture(FIRE_PACK_URL), rampMap(ramps), true, 1, FIRE_PACK_ROWS));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3.5;
  }
  /** Burn for `dt` at `size` (1 alone; fireScale's), `lit` or dying down; the camera in the fire's frame. */
  step(dt: number, size: number, lit: boolean, cx: number, cy: number, cz: number, fx: number, fy: number, fz: number) {
    const t = worldTime();
    if (lit) {
      const tk = Math.floor(t / TONGUE_S), ek = Math.floor(t / EMBER_S);
      if (tk !== this.tongue) {
        this.tongue = tk;
        this.pool.burst(TONGUE, 0, 0.3, 0, -0.2, 0, 0, size, 0xffffff, seedAt(0, 0, tk), 1, this.row);
      }
      if (ek !== this.ember) {
        this.ember = ek;
        if (hash01(ek, 7) < 0.75) this.pool.burst(EMBER, 0, 0.4, 0, -0.5, 0, 0, size, 0xffffff, seedAt(1, 1, ek), 1, this.row);
      }
    }
    this.pool.update(dt, 0.25, 0.1);
    const n = this.pool.write(cx, cy, cz, fx, fy, fz);
    this.geometry.instanceCount = n;
    for (const a of this.attrs) { a.clearUpdateRanges(); a.addUpdateRange(0, n * 4); a.needsUpdate = true; }
  }
  dispose() { this.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}

const camPos = new THREE.Vector3(), camDir = new THREE.Vector3();
/** What the fire's frame keeps between frames: its size and light, eased. */
interface Burn { size: number; light: number; dancers: number }

/** The frame (module scope: the react compiler forbids writing through hook values). */
function burn(b: Burn, sys: FireSystem, light: THREE.PointLight | null, embers: THREE.MeshStandardMaterial | null, site: Spot & { y: number }, lit: boolean, you: THREE.Vector3, camera: THREE.Camera, raw: number) {
  const dt = Math.min(raw, 0.1);
  // Dancers in the ring: the remotes holding the stomp near the fire, and you.
  const mine = localAvatar()?.motion.current?.pose === "DanceStomp" && Math.hypot(you.x - site.x, you.z - site.z) < FIRE.joinRadius;
  const dancers = lit ? countPosed("DanceStomp", site.x, site.z, FIRE.joinRadius) + (mine ? 1 : 0) : 0;
  b.dancers = dancers;
  const want = fireScale(dancers), k = 1 - Math.exp(-EASE * dt);
  b.size += (want.size - b.size) * k;
  b.light += ((lit ? want.light : 0) - b.light) * k;
  camera.getWorldPosition(camPos); camera.getWorldDirection(camDir);
  sys.step(dt, b.size, lit, camPos.x - site.x, camPos.y - site.y, camPos.z - site.z, camDir.x, camDir.y, camDir.z);
  if (light) {
    const t = worldTime();
    light.intensity = LIGHT.intensity * b.light * (0.88 + 0.08 * Math.sin(t * 13.1) + 0.04 * Math.sin(t * 7.7));
    light.distance = LIGHT.distance * (0.8 + 0.2 * b.size);
  }
  if (embers) embers.emissiveIntensity = EMBER_GLOW * b.light * (0.85 + 0.15 * Math.sin(worldTime() * 2.3));
  // The drum song: a layer per dancer, faded by how far you are from the fire.
  const near = lit ? drumDistanceGain(Math.hypot(you.x - site.x, you.z - site.z)) : 0, layers = drumLayers(dancers);
  for (let i = 0; i < DRUM_LAYERS.length; i++) AudioManager.setLoop(DRUM_LAYERS[i].src, i < layers ? DRUM_LAYERS[i].gain * near : 0);
}

export default function Campfire({ site, ground, phase, player }: {
  site: Spot;
  ground: (x: number, z: number) => number;
  phase: IslandPhase;
  player: RefObject<THREE.Vector3>;
}) {
  const lit = fireLit(phase);
  const y = ground(site.x, site.z);
  const at = useMemo(() => ({ x: site.x, y, z: site.z }), [site.x, site.z, y]);
  const system = useMemo(() => new FireSystem(), []);
  useEffect(() => () => system.dispose(), [system]);
  const light = useRef<THREE.PointLight>(null);
  const state = useRef<Burn>({ size: 1, light: 0, dancers: 0 });
  // The stack, prepared as GLBProp would (its shadow class and contact), keeping the ember bed's material to light.
  const { scene } = useGLTF(STACK_URL);
  const stack = useMemo(() => {
    const model = prepareModel(scene, STACK_URL, 0);
    let embers: THREE.MeshStandardMaterial | null = null;
    model.traverse(o => { const m = (o as THREE.Mesh).material; if (m instanceof THREE.MeshStandardMaterial && m.name === "M_Embers") embers = m; });
    return { model, embers: embers as THREE.MeshStandardMaterial | null };
  }, [scene]);
  useEffect(() => () => disposeModelMaterials(stack.model), [stack]);
  useContactShadow(stack.model, useMemo(() => modelContact(stack.model, STACK_URL, shadowClassFor(STACK_URL)), [stack]));
  // The stack is solid: you walk round it.
  useEffect(() => {
    const r = { x0: at.x - SOLID_HALF, x1: at.x + SOLID_HALF, z0: at.z - SOLID_HALF, z1: at.z + SOLID_HALF };
    eventSolids.push(r);
    return () => { const i = eventSolids.indexOf(r); if (i >= 0) eventSolids.splice(i, 1); };
  }, [at]);
  // Where it is and whether it burns, for the emote wheel (sit and dance by it).
  useEffect(() => {
    campfireLive.site = { x: at.x, z: at.z };
    return () => { campfireLive.site = null; campfireLive.lit = false; };
  }, [at]);
  useEffect(() => { campfireLive.lit = lit; }, [lit]);
  useEffect(() => () => { for (const l of DRUM_LAYERS) AudioManager.setLoop(l.src, 0); }, []);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    Object.assign(window, { __campfire: { site: at, lit: () => campfireLive.lit, dancers: () => state.current.dancers, size: () => state.current.size, light: () => light.current?.intensity ?? 0, particles: () => system.pool.alive } });
    return () => { delete (window as { __campfire?: unknown }).__campfire; };
  }, [at, system]);
  useFrame(({ camera }, raw) => burn(state.current, system, light.current, stack.embers, at, lit, player.current, camera, raw));
  return <group position={[at.x, at.y, at.z]}>
    <primitive object={stack.model} />
    <primitive object={system.mesh} />
    <pointLight ref={light} color="#ffad5c" intensity={0} distance={LIGHT.distance} decay={LIGHT.decay} position={[0, LIGHT.height, 0]} />
  </group>;
}
