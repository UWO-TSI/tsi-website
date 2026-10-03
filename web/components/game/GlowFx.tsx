"use client";

/**
 * Glints and glows from our painted pack (art/fx/build_pack.py), additive and unlit so they read by night as by day:
 * a rare find's twinkle, a craft's finishing sparkle, a specimen settling into its museum case, the guided glide's
 * target. The movement particles (useMoveParticles) are lit like the world's surfaces, right for dust and leaves and
 * wrong for light. One pool and one instanced draw per scene, shared by whatever throws into it (like the movement
 * particles), stepped on the shared wind; nothing allocated per frame.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ParticlePool } from "@/lib/game/fx/particles";
import { PICK_FRAME, PLACE_NORMAL, PLACE_VERTEX, VERTEX_PARS, liveWind, packMap } from "./movement/moveFx";

const CAPACITY = 160;
let material: THREE.MeshBasicMaterial | null = null;
function glowMaterial(): THREE.MeshBasicMaterial {
  if (material) return material;
  const m = new THREE.MeshBasicMaterial({ name: "GlowParticles", map: packMap(), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
  m.onBeforeCompile = shader => {
    shader.vertexShader = VERTEX_PARS + shader.vertexShader
      .replace("#include <uv_vertex>", `#include <uv_vertex>\n${PICK_FRAME}`)
      .replace("#include <begin_vertex>", `${PLACE_NORMAL}\n${PLACE_VERTEX}`);
    shader.fragmentShader = "varying vec4 vTint;\nvarying float vAbove;\n" + shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
  diffuseColor *= vTint;
  diffuseColor.a *= smoothstep(0.0, 0.08, vAbove);
  if (diffuseColor.a < 0.003) discard;`);
  };
  m.customProgramCacheKey = () => "glow-particles-v1";
  return (material = m);
}

const camPos = new THREE.Vector3(), camDir = new THREE.Vector3();
/** One additive pool drawn as one instanced quad mesh, sorted back to front. */
export class GlowParticles {
  readonly pool = new ParticlePool(CAPACITY);
  readonly mesh: THREE.Mesh;
  private readonly geometry = new THREE.InstancedBufferGeometry();
  private readonly attrs: THREE.InstancedBufferAttribute[];
  private stamp = -1;
  constructor() {
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    for (const name of ["position", "normal", "uv"]) this.geometry.setAttribute(name, quad.getAttribute(name));
    this.attrs = [this.pool.a, this.pool.b, this.pool.c, this.pool.d].map((array, k) => {
      const attr = new THREE.InstancedBufferAttribute(array, 4).setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute(`i${"ABCD"[k]}`, attr);
      return attr;
    });
    this.geometry.instanceCount = 0;
    this.mesh = new THREE.Mesh(this.geometry, glowMaterial());
    this.mesh.name = "GlowParticles";
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3.7;
  }
  /** Step and draw, once per frame (the first caller wins). */
  tick(stamp: number, dt: number, camera: THREE.Camera, wind: { x: number; z: number }) {
    if (stamp === this.stamp) return;
    this.stamp = stamp;
    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camDir);
    this.pool.update(dt, wind.x, wind.z);
    const n = this.pool.write(camPos.x, camPos.y, camPos.z, camDir.x, camDir.y, camDir.z);
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0;
    if (!n) return;
    for (const a of this.attrs) { a.clearUpdateRanges(); a.addUpdateRange(0, n * 4); a.needsUpdate = true; }
  }
  clear() { this.pool.clear(); }
  dispose() { this.geometry.dispose(); }
}

const SHARED = new WeakMap<THREE.Object3D, { fx: GlowParticles; users: number }>();
/** The scene's glow particles: one system however many things throw into it. */
export function useGlowParticles(): GlowParticles {
  const scene = useThree(s => s.scene);
  const fx = useMemo(() => {
    let e = SHARED.get(scene);
    if (!e) SHARED.set(scene, e = { fx: new GlowParticles(), users: 0 });
    return e.fx;
  }, [scene]);
  useEffect(() => {
    const e = SHARED.get(scene)!;
    if (e.users++ === 0) scene.add(e.fx.mesh);
    return () => { if (--e.users === 0) { scene.remove(e.fx.mesh); e.fx.clear(); e.fx.dispose(); SHARED.delete(scene); } };
  }, [scene]);
  useFrame((state, delta) => fx.tick(state.clock.elapsedTime, Math.min(delta, 0.1), state.camera, liveWind()));
  return fx;
}
