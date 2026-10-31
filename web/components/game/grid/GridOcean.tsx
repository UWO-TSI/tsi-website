"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { type IslandMap, WATER_DROP, LEVEL_STEP, cellToWorldX, cellToWorldZ, isGroundAtWorld, isRiver, levelAt, surfaceAt } from "@/lib/game/grid";
import { WATER_CHOP, WATER_CLOUDS, WATER_FOLD, WATER_OPTICS, WATER_RIPPLE, WATER_SWELL, WATER_WAVES, facetTilt, seaOf, swellUniformsOf, waveUniformsOf, type SeaKind } from "@/lib/game/waterShader";
import { ACTIVE_WORLD_BEND, ACTIVE_WORLD_BEND_SIDE } from "@/lib/game/curvedWorld";
import { terrainMaterial, waterSurfaceMaterial, waterSurfaceUniforms } from "./terrainMaterials";
import { deepestSeabed } from "@/lib/game/seabed";
import { groundFile, groundOf, type GroundSet } from "@/lib/game/groundTextures";
import { lastCall } from "@/lib/game/lastCall";

/**
 * Continue the grid's water outside its editable rectangle to the horizon, with its glint sprites
 * (`lite`: half of them; `skip`: water under a deck, where a sparkle would show through the planks;
 * `radius`: how far from the map's centre they reach, which grows with the map). `waves`: the new waves (game/waves)
 * where the world opts in, as its GridWorld does (lib/game/waterShader.ts seaOf); without it, main's sea exactly: the
 * swell, the graded strips and main's sparkles (the applicant island, live for recruits, first). `ownGround`: our own
 * textures (lib/game/groundTextures.ts: the sparkle's mask) where the world opts in, as its GridWorld does.
 */
export default function GridOcean({ map, lite = false, skip, radius, waves, ownGround }: { map: IslandMap; lite?: boolean; skip?: (x: number, z: number) => boolean; radius?: number; waves?: boolean; ownGround?: boolean }) {
  const sea = seaOf(waves), ground = groundOf(ownGround);
  const material = useMemo(() => waterSurfaceMaterial(sea), [sea]);
  const bed = useMemo(() => terrainMaterial("mRiverBed", ground)!, [ground]);
  const geometry = useMemo(() => (sea === "waves" ? oceanGeometry(map) : stripOceanGeometry(map)), [map, sea]);
  const floor = useMemo(() => seaBedGeometry(), []);
  useEffect(() => () => { geometry.dispose(); floor.dispose(); }, [geometry, floor]);
  // The deep bed goes on under the open sea, a little below the deepest the map's own bed gets (past the drop-off; the
  // map's bed covers it inside), so the little you see through deep water is the same seabed inside and out.
  return <group>
    <mesh position={[0, -WATER_DROP, 0]} geometry={geometry} material={material} />
    <mesh position={[0, -WATER_DROP - deepestSeabed() - 0.15, 0]} geometry={floor} material={bed} />
    <WaterGlints map={map} lite={lite} skip={skip} radius={radius} sea={sea} ground={ground} />
  </group>;
}

/**
 * The rings of open sea round the map, by how far out from its edge each runs: a unit apart at first, the gaps growing
 * to 6 units by 22 out and held there to 40 (the waves, lib/game/waves.ts: a mesh shows a wave only a few vertices
 * long, so the wind waves move it for the first dozen units and the swell, 26 long, out past where the arrival's
 * crossing starts), then widening to every 24 units out to the horizon (the curved world bends the sea down by distance
 * squared, and a longer span would cut the curve short).
 */
export const RINGS = [0, 1, 2, 3, 5, 7, 10, 13, 17, 22, 28, 34, 40, 48, 58, 72, 90, ...Array.from({ length: 40 }, (_, i) => 114 + 24 * i)];
/**
 * The open sea round a map's rectangle, out to `reach` every way, as one mesh in the world's frame (y 0). The map draws
 * its own water a quad per cell and the waves are evaluated per vertex, so the sea must have a vertex at every cell
 * corner along the map's edge or the two surfaces part as the waves run (a dark crack along the map's edge, seen as
 * soon as a boat or the camera goes out to sea).
 *
 * So the sea is rings: loops round the map's rectangle grown by each of RINGS (the last the reach's square), each loop's
 * vertices as far apart along it as the gap to its neighbour ring (a unit on the map's edge, its cell corners), and each
 * band between two loops stitched side by side, the inner loop's vertices to the outer's in order along the side (a
 * zipper). A loop's vertices are the same for the band inside it and the band outside, so no edge ever meets a coarser
 * one, and the far sea is no finer than it can show. Each vertex carries its spacing (`aWaveLod`, the wider of its
 * loop's spacing and its gap to the rings either side), so the waves move it only as far as the mesh can draw them.
 */
export function oceanGeometry(map: IslandMap, reach = 300): THREE.BufferGeometry {
  const minX = map.originX - 0.5, minZ = map.originZ - 0.5;
  const maxX = minX + map.width, maxZ = minZ + map.depth;
  const room = Math.min(minX + reach, reach - maxX, minZ + reach, reach - maxZ);
  const rings = RINGS.filter(d => d < room - 0.5);
  // Each loop's corners (anticlockwise from above: -x-z, +x-z, +x+z, -x+z), the last the reach's square.
  const loops = [...rings.map(d => [minX - d, minZ - d, maxX + d, maxZ + d]), [-reach, -reach, reach, reach]];
  // How far out each loop runs (the reach's square: as far as its nearest side).
  const dist = [...rings, room];
  const position: number[] = [], lod: number[] = [], index: number[] = [];
  /** A loop's vertices side by side (each side from its corner to the next, both corners in), and their spacing. */
  const sides = loops.map(([x0, z0, x1, z1], k) => {
    const inward = k > 0 ? dist[k] - dist[k - 1] : 1;
    const outward = k + 1 < loops.length ? dist[k + 1] - dist[k] : inward;
    const step = k === 0 ? 1 : Math.max(1, Math.round(Math.min(inward, outward)));
    const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    const ids = corners.map(([x, z]) => { position.push(x, 0, z); return position.length / 3 - 1; });
    return corners.map(([ax, az], i) => {
      const [bx, bz] = corners[(i + 1) % 4], n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / step)), side = [ids[i]];
      for (let j = 1; j < n; j++) { position.push(ax + ((bx - ax) * j) / n, 0, az + ((bz - az) * j) / n); side.push(position.length / 3 - 1); }
      side.push(ids[(i + 1) % 4]);
      return { side, spacing: Math.max(Math.hypot(bx - ax, bz - az) / n, inward, outward) };
    });
  });
  // Spacing per vertex: a corner is on two sides, so the wider.
  lod.length = position.length / 3;
  lod.fill(0);
  for (const loop of sides) for (const { side, spacing } of loop) for (const v of side) lod[v] = Math.max(lod[v], spacing);
  const up = (a: number, b: number, c: number) => {
    const ux = position[b * 3] - position[a * 3], uz = position[b * 3 + 2] - position[a * 3 + 2];
    const vx = position[c * 3] - position[a * 3], vz = position[c * 3 + 2] - position[a * 3 + 2];
    if (uz * vx - ux * vz > 0) index.push(a, b, c); else index.push(a, c, b); // facing up
  };
  for (let k = 0; k + 1 < sides.length; k++) for (let i = 0; i < 4; i++) {
    const a = sides[k][i].side, b = sides[k + 1][i].side;
    // Zip the two sides by how far along each its vertices are.
    let p = 0, q = 0;
    while (p + 1 < a.length || q + 1 < b.length) {
      if (q + 1 >= b.length || (p + 1 < a.length && (p + 1) / (a.length - 1) <= (q + 1) / (b.length - 1))) { up(a[p], a[p + 1], b[q]); p++; }
      else { up(a[p], b[q + 1], b[q]); q++; }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute("aWaveLod", new THREE.Float32BufferAttribute(lod, 1));
  g.setIndex(index);
  return g;
}

/**
 * Outward from the map's edge: a row every unit at first, then each twice as far, then every 24 units out to the
 * horizon (the curved world bends the sea down by distance squared, and a longer span would cut the curve short).
 */
const GRADED = [0, 1, 3, 7, 15, 31, ...Array.from({ length: 40 }, (_, i) => 55 + 24 * i)];
const graded = (span: number) => [...GRADED.filter(d => d < span - 0.5), span];
/**
 * The open sea round a map's rectangle, out to `reach` every way, as one mesh in the world's frame (y 0). The map draws
 * its own water a quad per cell and the swell is evaluated per vertex, so the sea must have a vertex at every cell
 * corner along the map's edge or the two surfaces part as the swell runs (a dark crack along the map's edge, seen as
 * soon as a boat or the camera goes out to sea). So: west and east strips the full depth, their rows a unit apart
 * beside the map and graded beyond it; north and south strips the map's width, their columns a unit apart; each strip
 * a whole grid (its rows and columns run right across), graded outward from the map, so no edge meets a coarser one.
 * Main's open sea, kept for the swell's worlds (GridOcean without `waves`); the waves' worlds draw oceanGeometry's rings.
 */
export function stripOceanGeometry(map: IslandMap, reach = 300): THREE.BufferGeometry {
  const minX = map.originX - 0.5, minZ = map.originZ - 0.5;
  const maxX = minX + map.width, maxZ = minZ + map.depth;
  const units = (a: number, b: number) => Array.from({ length: Math.round(b - a) + 1 }, (_, i) => a + i);
  const southRows = graded(minZ + reach).map(d => minZ - d).reverse(), northRows = graded(reach - maxZ).map(d => maxZ + d);
  const sideRows = [...southRows.slice(0, -1), ...units(minZ, maxZ), ...northRows.slice(1)];
  const strips: [number[], number[]][] = [
    [graded(minX + reach).map(d => minX - d).reverse(), sideRows],
    [graded(reach - maxX).map(d => maxX + d), sideRows],
    [units(minX, maxX), southRows],
    [units(minX, maxX), northRows],
  ];
  const position: number[] = [], index: number[] = [];
  for (const [xs, zs] of strips) {
    const base = position.length / 3, w = xs.length;
    for (const z of zs) for (const x of xs) position.push(x, 0, z);
    for (let j = 0; j + 1 < zs.length; j++) for (let i = 0; i + 1 < w; i++) {
      const a = base + j * w + i, b = a + 1, c = a + w, d = c + 1;
      index.push(a, c, b, b, c, d); // facing up
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  g.setIndex(index);
  return g;
}

/**
 * The open sea's bed: one plane out to `reach`, a vertex every 24 units (the world's bend cuts no more than half a unit
 * off its curve between them, well inside its depth), in the terrain's sand at the map bed's scale (two cells a repeat).
 */
export function seaBedGeometry(reach = 300): THREE.BufferGeometry {
  const n = Math.round((2 * reach) / 24), g = new THREE.PlaneGeometry(2 * reach, 2 * reach, n, n).rotateX(-Math.PI / 2);
  const p = g.getAttribute("position"), uv = g.getAttribute("uv");
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 0.5, p.getZ(i) * 0.5);
  return g;
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
  // Only over water: the organic coast reaches into some water cells.
  pts = pts.filter(([x, , z]) => !isGroundAtWorld(map, x, z));
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

/**
 * The sprites' fog. They add their light (additive blending), and three's fog mixes a fragment toward the fog's colour,
 * which on an additive sprite ADDS that pale colour: every faintly lit sprite far out drew as a pale dot, packed into
 * the band the world's bend squeezes the far sea into (playtest round 1, "the sparkles in the distance"). In fog a
 * sprite's light fades to nothing instead, as the sea under it fades to the fog.
 */
export const GLINT_FOG = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor.rgb *= 1.0 - fogFactor;
#endif
`;


/**
 * How a sparkle rides its sea: on the waves, a point of the surface that moves with it and leans on its slope; on
 * main's swell (the worlds that don't opt in), lifted by the swell as main drew it.
 */
const GLINT_RIDE: Record<SeaKind, string> = {
  waves: `
          // A sparkle is a point of the surface: it moves with it, and its facet leans on the waves' slope there.
          vec2 glintField = waveField(glintAt.xz);
          vec3 glintMove;
          vec2 swellGrad;
          waterWaves(glintAt.x, glintAt.z, glintField.x, glintField.y, 1.0, glintMove, swellGrad);
          transformed += glintMove;
          glintAt += glintMove;`,
  swell: `
          vec2 swellGrad;
          float swell = waterSwell(glintAt.xz, swellGrad);
          transformed.y += swell;
          glintAt.y += swell;`,
};

/** The sparkles' shader on a sea (WaterGlints): the water's live uniforms, its ride (GLINT_RIDE), the glint and the fold. */
export function glintShader(sea: SeaKind, shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string }): void {
  const u = waterSurfaceUniforms();
  Object.assign(shader.uniforms, {
    ...(sea === "waves" ? waveUniformsOf(u) : swellUniformsOf(u)), uRippleTexture: u.uRippleTexture, uRippleStrength: u.uRippleStrength,
    uSunDir: u.uSunDir, uSunColor: u.uSunColor, uSunGlint: u.uSunGlint, uSunSize: u.uSunSize, uRoughness: u.uRoughness,
    uCloudMap: u.uCloudMap, uCloudUv: u.uCloudUv, uCloudShade: u.uCloudShade,
  });
  shader.vertexShader = "attribute vec2 aTilt;\nuniform vec3 uSunDir;\nuniform float uSunGlint;\nuniform float uSunSize;\nuniform float uRoughness;\nvarying float vGlint;\n" + (sea === "waves" ? WATER_WAVES : WATER_SWELL) + WATER_RIPPLE + WATER_CHOP + WATER_CLOUDS + WATER_OPTICS + WATER_FOLD(ACTIVE_WORLD_BEND, ACTIVE_WORLD_BEND_SIDE) + shader.vertexShader
    .replace("#include <begin_vertex>", `#include <begin_vertex>
          vec3 glintAt = (modelMatrix * vec4(transformed, 1.0)).xyz;${GLINT_RIDE[sea]}
          vec2 slope = waterDetailNormal(glintAt.xz) - swellGrad + (aTilt + chopSlope(glintAt.xz, uTime)) * uRoughness;
          float lit = facetGlint(uSunDir, cameraPosition, glintAt, vec3(slope.x, 1.0, slope.y), uSunSize);
          vGlint = lit * uSunGlint * sunThroughClouds(glintAt.xz);`)
    .replace("#include <logdepthbuf_vertex>", `
          // mvPosition is bent here (project_vertex): nothing past the fold, a fade as the sea turns edge-on before it.
          vGlint *= foldFade(mvPosition.xyz);
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
          diffuseColor.rgb = uSunColor * vGlint * star * 1.2;`)
    .replace("#include <fog_fragment>", GLINT_FOG);
}

/**
 * Sparkles (row 238, specs/look-development.md §7.4): each sprite is one
 * ripple too small to draw, a point of the surface riding the waves. Its
 * normal is the water's own (waves + ripple texture, as the surface draws it)
 * plus a fixed tilt of its own (`facetTilt`) and the short fast waves passing
 * it (`chopSlope`), both spread by the water's roughness, and it flashes only
 * while that normal mirrors the real sun into this camera (`facetGlint`). No
 * clocks and no noise: it twinkles because the waves turn it through
 * alignment and because the viewer moves. Sun intensity and colour come from
 * the phase and weather (zero sunGlint under rain, snow and fog), dimmed under
 * a passing cloud shadow. HDR white-gold, so bloom catches the brightest cores
 * on High. Under the world's bend each fades as the bent sea under it turns
 * edge-on, and none draws past the fold (`WATER_FOLD`: playtest round 1, the
 * far sparkles folded back under the horizon and showed twice); in fog they
 * fade out rather than turn the fog's colour (`GLINT_FOG`).
 */
/** The glints' places, once: the scene renders several times before it first commits (lib/game/lastCall.ts). */
const glintsOf = lastCall((map: IslandMap, skip: ((x: number, z: number) => boolean) | undefined, radius: number | undefined) => glintPoints(map, skip, radius));

/** `ground`: whose sparkle sprite masks each sparkle (lib/game/groundTextures.ts seaGlint: ours, or the dump's July sea glints). */
function WaterGlints({ map, lite, skip, radius, sea, ground }: { map: IslandMap; lite: boolean; skip?: (x: number, z: number) => boolean; radius?: number; sea: SeaKind; ground: GroundSet }) {
  const [geometry, material] = useMemo(() => {
    const position = glintsOf(map, skip, radius), n = position.length / 3, tilt = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) tilt.set(facetTilt(position[i * 3], position[i * 3 + 2]), i * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aTilt", new THREE.BufferAttribute(tilt, 2));
    g.setDrawRange(0, lite ? Math.floor(n / 2) : n);
    const map_ = new THREE.TextureLoader().load(groundFile(ground, "seaGlint")!);
    map_.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.PointsMaterial({ map: map_, size: 0.5, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    m.onBeforeCompile = (shader) => glintShader(sea, shader);
    m.customProgramCacheKey = () => `water-glints-${sea}`;
    return [g, m];
  }, [map, lite, skip, radius, sea, ground]);
  useEffect(() => () => { geometry.dispose(); material.map?.dispose(); material.dispose(); }, [geometry, material]);
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
