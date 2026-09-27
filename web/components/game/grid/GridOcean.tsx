"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { type IslandMap, WATER_DROP, LEVEL_STEP, cellToWorldX, cellToWorldZ, isRiver, levelAt, surfaceAt } from "@/lib/game/grid";
import { WATER_SWELL } from "@/lib/game/waterShader";
import { terrainMaterial, waterSurfaceUniforms } from "./terrainMaterials";

/**
 * Continue the grid's water outside its editable rectangle to the horizon, with its glint sprites
 * (`lite`: half of them; `skip`: water under a deck, where a sparkle would show through the planks).
 */
export default function GridOcean({ map, lite = false, skip }: { map: IslandMap; lite?: boolean; skip?: (x: number, z: number) => boolean }) {
  const material = useMemo(() => terrainMaterial("mRiver")!, []);
  const minX = map.originX - 0.5, minZ = map.originZ - 0.5;
  const maxX = minX + map.width, maxZ = minZ + map.depth;
  const reach = 300;
  const rectangles = [
    [(minX - reach) / 2, (minZ + maxZ) / 2, minX + reach, map.depth],
    [(maxX + reach) / 2, (minZ + maxZ) / 2, reach - maxX, map.depth],
    [0, (minZ - reach) / 2, reach * 2, minZ + reach],
    [0, (maxZ + reach) / 2, reach * 2, reach - maxZ],
  ];
  return <group>{rectangles.map(([x, z, width, depth], i) => (
    <mesh key={i} position={[x, -WATER_DROP, z]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[width, depth, 20, 20]} />
    </mesh>
  ))}<WaterGlints map={map} lite={lite} skip={skip} /></group>;
}

/**
 * Where the glint sprites sit: two per water cell inside the map (river,
 * pond, the sea ring) and one per ~5 units² of open sea outside it, out to
 * `radius` (the fog). xyz + a 0-1 seed per point, seeded so a reload sparkles
 * in the same places, shuffled so any prefix is an even spread (Light draws half).
 */
export function glintPoints(map: IslandMap, skip?: (x: number, z: number) => boolean, radius = 90, seed = 7): Float32Array {
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  let pts: number[][] = [];
  for (let cz = 0; cz < map.depth; cz++) {
    for (let cx = 0; cx < map.width; cx++) {
      if (!isRiver(surfaceAt(map, cx, cz))) continue;
      for (let k = 0; k < 2; k++) pts.push([cellToWorldX(map, cx) + (rnd() - 0.5) * 0.8, levelAt(map, cx, cz) * LEVEL_STEP - WATER_DROP, cellToWorldZ(map, cz) + (rnd() - 0.5) * 0.8, rnd()]);
    }
  }
  const minX = map.originX - 0.5, minZ = map.originZ - 0.5, maxX = minX + map.width, maxZ = minZ + map.depth;
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  for (let i = Math.round(Math.PI * radius * radius / 5); i > 0; i--) {
    const a = rnd() * Math.PI * 2, r = radius * Math.sqrt(rnd()), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (x < minX || x > maxX || z < minZ || z > maxZ) pts.push([x, -WATER_DROP, z, rnd()]);
  }
  if (skip) pts = pts.filter(([x, , z]) => !skip(x, z));
  for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
  return new Float32Array(pts.flat());
}

/** The dump's sea-sparkle sprite (the July sea glints, Ocean.tsx), used as each sparkle's soft mask. */
const GLINT_URL = "/assets/acnh/textures/sea-glint.png";

/**
 * Sparkles on the wave crests (row 237, specs/look-development.md §6): the
 * July sea-glint sprites, grown from two ring clouds over the old sea into one
 * cloud over every water surface. Each sprite rides the water's swell and
 * flashes on its own clock, only near a crest, brightest along the glint path
 * (the same folded sun and glint strength as the water shader, so phase and
 * weather scale both). HDR white-gold, so bloom catches them on High.
 */
function WaterGlints({ map, lite, skip }: { map: IslandMap; lite: boolean; skip?: (x: number, z: number) => boolean }) {
  const [geometry, material] = useMemo(() => {
    const pts = glintPoints(map, skip), n = pts.length / 4;
    const position = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { position.set(pts.subarray(i * 4, i * 4 + 3), i * 3); seed[i] = pts[i * 4 + 3]; }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setDrawRange(0, lite ? Math.floor(n / 2) : n);
    const map_ = new THREE.TextureLoader().load(GLINT_URL);
    map_.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.PointsMaterial({ map: map_, size: 0.5, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    m.onBeforeCompile = (shader) => {
      const u = waterSurfaceUniforms();
      Object.assign(shader.uniforms, { uTime: u.uTime, uWaveHeight: u.uWaveHeight, uWaveScale: u.uWaveScale, uWaveSpeed: u.uWaveSpeed, uSunDir: u.uSunDir, uSunColor: u.uSunColor, uSunGlint: u.uSunGlint });
      shader.vertexShader = "attribute float aSeed;\nuniform vec3 uSunDir;\nuniform float uSunGlint;\nvarying float vGlint;\n" + WATER_SWELL + shader.vertexShader
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          vec3 glintAt = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vec2 swellGrad;
          float swell = waterSwell(glintAt.xz, swellGrad);
          transformed.y += swell;
          vec3 glintV = normalize(cameraPosition - glintAt);
          float glintPath = pow(max(dot(reflect(-glintV, normalize(vec3(-swellGrad.x, 1.0, -swellGrad.y))), normalize(uSunDir)), 0.0), 10.0);
          float crest = smoothstep(-0.5, 0.5, swell / max(uWaveHeight, 1e-4));
          // Own clock per sprite: a quick flash, a slower fade, then dark most of the cycle.
          float cycle = fract(uTime * (0.3 + 0.4 * aSeed) + aSeed * 13.0);
          float flash = smoothstep(0.0, 0.03, cycle) * (1.0 - smoothstep(0.03, 0.3, cycle));
          vGlint = flash * crest * (0.25 + glintPath) * uSunGlint;`)
        .replace("#include <logdepthbuf_vertex>", `
          gl_PointSize *= 0.6 + 0.6 * min(glintPath * 2.0, 1.0);
          gl_PointSize = vGlint < 0.01 ? 0.0 : max(gl_PointSize, 3.0);
          // Nudged toward the camera so the water just in front cannot clip the core; a pier deck above still hides it.
          gl_Position = projectionMatrix * vec4(mvPosition.xyz + normalize(-mvPosition.xyz) * 0.12, 1.0);
          #include <logdepthbuf_vertex>`);
      shader.fragmentShader = "uniform vec3 uSunColor;\nvarying float vGlint;\n" + shader.fragmentShader
        .replace("#include <map_particle_fragment>", `#include <map_particle_fragment>
          // Four-point star: a hot core and two thin flares.
          vec2 q = gl_PointCoord * 2.0 - 1.0;
          float star = exp(-dot(q, q) * 16.0) + 0.6 * (exp(-abs(q.x) * 16.0 - abs(q.y) * 2.8) + exp(-abs(q.y) * 16.0 - abs(q.x) * 2.8));
          diffuseColor.rgb = uSunColor * vGlint * star * 1.2;`);
    };
    return [g, m];
  }, [map, lite, skip]);
  useEffect(() => () => { geometry.dispose(); material.map?.dispose(); material.dispose(); }, [geometry, material]);
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
