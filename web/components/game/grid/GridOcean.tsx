"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { type IslandMap, WATER_DROP, LEVEL_STEP, cellToWorldX, cellToWorldZ, isRiver, levelAt, surfaceAt } from "@/lib/game/grid";
import { WATER_CHOP, WATER_CLOUDS, WATER_OPTICS, WATER_SWELL, facetTilt } from "@/lib/game/waterShader";
import { WATER_RIPPLE, terrainMaterial, waterSurfaceUniforms } from "./terrainMaterials";

/**
 * Continue the grid's water outside its editable rectangle to the horizon, with its glint sprites
 * (`lite`: half of them; `skip`: water under a deck, where a sparkle would show through the planks;
 * `radius`: how far from the map's centre they reach, which grows with the map).
 */
export default function GridOcean({ map, lite = false, skip, radius }: { map: IslandMap; lite?: boolean; skip?: (x: number, z: number) => boolean; radius?: number }) {
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
  ))}<WaterGlints map={map} lite={lite} skip={skip} radius={radius} /></group>;
}

/** At most this many glints inside the map: a big painted sea thins its two-per-cell. */
export const GLINT_CELL_POINTS = 12000;

/**
 * Where the glint sprites sit: two per water cell inside the map (river,
 * pond, the sea ring; fewer once that passes GLINT_CELL_POINTS) and one per
 * ~5 units² of open sea outside it, out to `radius` (the fog). xyz per point,
 * seeded so every client has the same points, shuffled so any prefix is an
 * even spread (Light draws half).
 */
export function glintPoints(map: IslandMap, skip?: (x: number, z: number) => boolean, radius = 90, seed = 7): Float32Array {
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  let pts: number[][] = [];
  let cells = 0;
  for (let i = 0; i < map.surfaces.length; i++) if (isRiver(map.surfaces[i])) cells++;
  const keep = Math.min(1, GLINT_CELL_POINTS / (2 * cells));
  for (let cz = 0; cz < map.depth; cz++) {
    for (let cx = 0; cx < map.width; cx++) {
      if (!isRiver(surfaceAt(map, cx, cz))) continue;
      for (let k = 0; k < 2; k++) if (keep === 1 || rnd() < keep) pts.push([cellToWorldX(map, cx) + (rnd() - 0.5) * 0.8, levelAt(map, cx, cz) * LEVEL_STEP - WATER_DROP, cellToWorldZ(map, cz) + (rnd() - 0.5) * 0.8]);
    }
  }
  const minX = map.originX - 0.5, minZ = map.originZ - 0.5, maxX = minX + map.width, maxZ = minZ + map.depth;
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  for (let i = Math.round(Math.PI * radius * radius / 5); i > 0; i--) {
    const a = rnd() * Math.PI * 2, r = radius * Math.sqrt(rnd()), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (x < minX || x > maxX || z < minZ || z > maxZ) pts.push([x, -WATER_DROP, z]);
  }
  if (skip) pts = pts.filter(([x, , z]) => !skip(x, z));
  for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
  return new Float32Array(pts.flat());
}

/** The dump's sea-sparkle sprite (the July sea glints, Ocean.tsx), used as each sparkle's soft mask. */
const GLINT_URL = "/assets/acnh/textures/sea-glint.png";

/**
 * Sparkles (row 238, specs/look-development.md §7.4): each sprite is one
 * ripple too small to draw, at a fixed world point riding the swell. Its
 * normal is the water's own (swell + ripple texture, as the surface draws it)
 * plus a fixed tilt of its own (`facetTilt`) and the short fast waves passing
 * it (`chopSlope`), both spread by the water's roughness, and it flashes only
 * while that normal mirrors the real sun into this camera (`facetGlint`). No
 * clocks and no noise: it twinkles because the waves turn it through
 * alignment and because the viewer moves. Sun intensity and colour come from
 * the phase and weather (zero sunGlint under rain, snow and fog), dimmed under
 * a passing cloud shadow. HDR white-gold, so bloom catches the brightest cores
 * on High.
 */
function WaterGlints({ map, lite, skip, radius }: { map: IslandMap; lite: boolean; skip?: (x: number, z: number) => boolean; radius?: number }) {
  const [geometry, material] = useMemo(() => {
    const position = glintPoints(map, skip, radius), n = position.length / 3, tilt = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) tilt.set(facetTilt(position[i * 3], position[i * 3 + 2]), i * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aTilt", new THREE.BufferAttribute(tilt, 2));
    g.setDrawRange(0, lite ? Math.floor(n / 2) : n);
    const map_ = new THREE.TextureLoader().load(GLINT_URL);
    map_.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.PointsMaterial({ map: map_, size: 0.5, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    m.onBeforeCompile = (shader) => {
      const u = waterSurfaceUniforms();
      Object.assign(shader.uniforms, {
        uTime: u.uTime, uWaveHeight: u.uWaveHeight, uWaveScale: u.uWaveScale, uWaveSpeed: u.uWaveSpeed, uRippleTexture: u.uRippleTexture, uRippleStrength: u.uRippleStrength,
        uSunDir: u.uSunDir, uSunColor: u.uSunColor, uSunGlint: u.uSunGlint, uSunSize: u.uSunSize, uRoughness: u.uRoughness,
        uCloudMap: u.uCloudMap, uCloudUv: u.uCloudUv, uCloudShade: u.uCloudShade,
      });
      shader.vertexShader = "attribute vec2 aTilt;\nuniform vec3 uSunDir;\nuniform float uSunGlint;\nuniform float uSunSize;\nuniform float uRoughness;\nvarying float vGlint;\n" + WATER_SWELL + WATER_RIPPLE + WATER_CHOP + WATER_CLOUDS + WATER_OPTICS + shader.vertexShader
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          vec3 glintAt = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vec2 swellGrad;
          float swell = waterSwell(glintAt.xz, swellGrad);
          transformed.y += swell;
          glintAt.y += swell;
          vec2 slope = waterDetailNormal(glintAt.xz) - swellGrad + (aTilt + chopSlope(glintAt.xz, uTime)) * uRoughness;
          float lit = facetGlint(uSunDir, cameraPosition, glintAt, vec3(slope.x, 1.0, slope.y), uSunSize);
          vGlint = lit * uSunGlint * sunThroughClouds(glintAt.xz);`)
        .replace("#include <logdepthbuf_vertex>", `
          gl_PointSize *= 0.5 + 0.7 * lit;
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
  }, [map, lite, skip, radius]);
  useEffect(() => () => { geometry.dispose(); material.map?.dispose(); material.dispose(); }, [geometry, material]);
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
