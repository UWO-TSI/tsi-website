"use client";

/**
 * The temple's candles burn (specs/polish/interiors.md deliverable 4): a painted flame on each wick, the combat pack's
 * fire tongue (lib/game/fx/combatPack.ts) mapped through a candle's colours, and sparks drifting up off them now and
 * then (the pack's light mote), in place of the sphere embers; the candle pools' light flickers with them. One pooled
 * particle system in one draw, nothing allocated per frame; the sparks are seeded from the world clock, so everyone
 * sees the same ones.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FACE, ParticlePool, seedAt, type Recipe } from "@/lib/game/fx/particles";
import { COMBAT_PACK, COMBAT_PACK_URL, type CombatSprite } from "@/lib/game/fx/combatPack";
import { RampTable, sharedRamps, type Ramp } from "@/lib/game/fx/combat";
import { createCombatParticleMaterial, rampMap } from "@/lib/game/fx/fxMaterial";
import { worldTime } from "@/lib/game/worldClock";
import { hash01 } from "@/lib/game/worldFx";

/** A candle's wick: where it stands and the height of its tip. */
export interface Wick { x: number; z: number; top: number }
const CANDLE_RAMP: Ramp = ["#fff8e2", "#ffc45e", "#c9571c"];
/** A flame that never dies: the flipbook loops (fps), it never fades. */
const FLAME: Recipe<CombatSprite> = { sprite: "flame", count: [1, 1], life: [1e9, 1e9], size: [0.17, 0.17], grow: 1, speed: [0, 0], spread: 0, up: [0, 0],
  gravity: 0, drag: 0, wind: 0, fps: 11, alpha: 0.95, face: FACE.standing, fadeIn: 1e12 };
const SPARK: Recipe<CombatSprite> = { sprite: "mote", count: [1, 1], life: [1.1, 1.7], size: [0.1, 0.14], grow: 0.35, speed: [0.01, 0.05], spread: Math.PI,
  up: [0.28, 0.42], gravity: 0, drag: 0.8, wind: 0, lift: 0.32, alpha: 1, face: FACE.billboard, jitter: 0.012, rise: [0.1, 0.14], fadeIn: 14 };
/** A spark leaves a candle about this often (s), and only on some beats. */
const SPARK_BEAT = 0.8, SPARK_CHANCE = 0.62;

let pack: THREE.Texture | null = null;
function packMap() {
  if (!pack) { pack = new THREE.TextureLoader().load(COMBAT_PACK_URL); pack.colorSpace = THREE.NoColorSpace; pack.anisotropy = 4; } // heat is data, not colour
  return pack;
}

class CandleSystem {
  readonly pool = new ParticlePool(48, COMBAT_PACK);
  readonly mesh: THREE.Mesh;
  private readonly attrs: THREE.InstancedBufferAttribute[];
  private readonly geometry = new THREE.InstancedBufferGeometry();
  readonly row: number;
  private readonly beats: Int32Array;
  constructor(private readonly wicks: readonly Wick[]) {
    const ramps = (sharedRamps.table ??= new RampTable());
    this.row = ramps.row(CANDLE_RAMP);
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    for (const n of ["position", "uv"]) this.geometry.setAttribute(n, quad.getAttribute(n));
    this.attrs = [this.pool.a, this.pool.b, this.pool.c, this.pool.d].map((arr, k) => {
      const a = new THREE.InstancedBufferAttribute(arr, 4).setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute(`i${"ABCD"[k]}`, a);
      return a;
    });
    this.geometry.instanceCount = 0;
    this.mesh = new THREE.Mesh(this.geometry, createCombatParticleMaterial(packMap(), rampMap(ramps), true));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3.5;
    this.beats = new Int32Array(wicks.length).fill(-1);
    wicks.forEach((w, i) => this.pool.burst(FLAME, w.x, w.top, w.z, w.top - 0.3, 0, 0, 1, 0xffffff, seedAt(w.x, w.z, 7 + i), 1, this.row));
  }
  step(dt: number, camera: THREE.Camera) {
    const t = worldTime();
    for (let i = 0; i < this.wicks.length; i++) {
      const beat = Math.floor(t / SPARK_BEAT);
      if (beat === this.beats[i]) continue;
      const first = this.beats[i] < 0;
      this.beats[i] = beat;
      if (first || hash01(i * 31 + 5, beat) > SPARK_CHANCE) continue;
      const w = this.wicks[i];
      this.pool.burst(SPARK, w.x, w.top, w.z, w.top - 0.5, 0, 0, 1, 0xffffff, seedAt(w.x, w.z, beat), 1, this.row);
    }
    this.pool.update(dt, 0, 0);
    camera.getWorldPosition(camPos); camera.getWorldDirection(camDir);
    const n = this.pool.write(camPos.x, camPos.y, camPos.z, camDir.x, camDir.y, camDir.z);
    this.geometry.instanceCount = n;
    for (const a of this.attrs) { a.clearUpdateRanges(); a.addUpdateRange(0, n * 4); a.needsUpdate = true; }
  }
  dispose() { this.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}
const camPos = new THREE.Vector3(), camDir = new THREE.Vector3();

/** Module scope (the react compiler forbids writing through hook values): the candle pools breathe with the flames. */
function flicker(lights: (THREE.PointLight | null)[], base: number, t: number) {
  for (let i = 0; i < lights.length; i++) {
    const l = lights[i];
    if (l) l.intensity = base * (0.9 + 0.06 * Math.sin(t * 13.1 + i * 2.3) + 0.04 * Math.sin(t * 7.7 + i * 5.1));
  }
}

export default function CandleFire({ wicks, pools, poolIntensity }: {
  wicks: readonly Wick[];
  /** The candle pools' lights (x, y, z), flickering with the flames. */
  pools: readonly (readonly [number, number, number])[]; poolIntensity: number;
}) {
  const system = useMemo(() => new CandleSystem(wicks), [wicks]);
  useEffect(() => () => system.dispose(), [system]);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  useFrame(({ camera, clock }, raw) => {
    system.step(Math.min(raw, 0.1), camera);
    flicker(lights.current, poolIntensity, clock.elapsedTime);
  });
  return <>
    <primitive object={system.mesh} />
    {pools.map((p, i) => <pointLight key={i} ref={el => { lights.current[i] = el; }} color="#FFCF8A" intensity={poolIntensity} distance={5.5} position={p as [number, number, number]} />)}
  </>;
}
