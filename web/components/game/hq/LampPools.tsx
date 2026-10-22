"use client";

/**
 * The lamps' warm pools, the track spots' washes and the aquarium's blue on the floor (lib/game/hqLight.ts): soft
 * additive patches, one mesh and one draw for a floor's worth, no lights. `gain` follows the time of day (the lamps
 * are always on; by day the windows' light takes over: lib/game/interiorLight.ts `lamps`). The quads go through
 * three's shared project_vertex, so the curved world bends them with the room.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { poolQuad, type Pool } from "@/lib/game/hqLight";

/** Module scope (the react compiler forbids writing through hook values). */
function setGain(m: THREE.ShaderMaterial, gain: number) { m.uniforms.uGain.value = gain; }

export default function LampPools({ pools, gain }: { pools: readonly Pool[]; gain: number }) {
  const geometry = useMemo(() => {
    const n = pools.length, pos = new Float32Array(n * 12), uv = new Float32Array(n * 8), col = new Float32Array(n * 12), index: number[] = [];
    const c = new THREE.Color();
    pools.forEach((p, i) => {
      c.set(p.color).multiplyScalar(p.strength);
      const q = poolQuad(p);
      q.corners.forEach((v, j) => { pos.set(v, (i * 4 + j) * 3); col.set([c.r, c.g, c.b], (i * 4 + j) * 3); uv.set(q.uvs[j], (i * 4 + j) * 2); });
      index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setAttribute("aCol", new THREE.BufferAttribute(col, 3));
    g.setIndex(index);
    return g;
  }, [pools]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    name: "HqLampPools",
    uniforms: { uGain: { value: 1 } },
    vertexShader: /* glsl */ `
attribute vec3 aCol;
varying vec2 vUv;
varying vec3 vCol;
void main() {
  vUv = uv;
  vCol = aCol;
  vec3 transformed = position;
  #include <project_vertex>
}`,
    fragmentShader: /* glsl */ `
uniform float uGain;
varying vec2 vUv;
varying vec3 vCol;
void main() {
  // A soft, long fade (David, 2026-10-22: "lightsings should fade a little lighter").
  float a = 1.0 - smoothstep(0.0, 1.0, length(vUv));
  gl_FragColor = vec4(vCol * a * (0.4 + 0.6 * a) * uGain, 1.0);
  #include <colorspace_fragment>
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), []);
  useEffect(() => setGain(material, gain), [material, gain]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />;
}
