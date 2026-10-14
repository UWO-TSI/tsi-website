"use client";

/**
 * GrassTufts: the cinematic pass's flowing tufts, kept for the worlds that don't name their obstacles (the applicant
 * island, the ruins, the home island, the movement lab: GridWorld's `grassLayer`), so they render as they did. The
 * village, the v2 world and the title draw the blade field (GrassField) instead.
 *
 * GrassTufts — the moving layer on the ground (David, 2026-07-28: "ground is too
 * 2d static, needs some swaying grass and stuff while keeping performance").
 *
 * WHY CARDS AND NOT A SHADER ON THE GROUND. The ground is a flat quad per cell.
 * Displacing it would need vertices it does not have, and adding them would put
 * the cost on all ~11k land cells whether or not anything shows. ACNH does the
 * same thing we do here: the ground stays flat and separate `mProcGrass` cards
 * stand on it — every cliff piece in the kit ships one (`PGrassBA__mProcGrass`).
 *
 * THE COST. One InstancedMesh, one draw call, two triangles per tuft. The wind
 * is entirely in the vertex shader — no per-frame CPU work, no per-instance
 * matrix rewrite, one uniform updated per frame. At the shipped density
 * (6 per 100 grass cells) that is roughly 500 tufts on this island: 1 draw,
 * ~1k triangles. It is cheaper than a single one of the 68 prop GLBs.
 *
 * Tufts are placed on a deterministic hash of the cell, so they do not shimmer
 * between loads and do not need to be stored in the map.
 *
 * ON LITE THEY THIN WITH DISTANCE (v1 performance). The v2 world's grass is a
 * quarter of its triangles; past THIN.near of the camera only a share of the
 * tufts stands, falling to THIN.keep past THIN.far (each tuft's own hash says
 * which, so the same ones stay as you walk). Far tufts are a pixel or two on
 * Lite's half-resolution canvas. High draws them all, as before.
 */

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  type IslandMap,
  Surface,
  TILE,
  heightField,
  sampleGroundHeight,
  surfaceAt,
  isVoid,
  needsCliff,
  cellToWorldX,
  cellToWorldZ,
  isGroundAtWorld,
  overlayAt,
  DIR_OFFSETS,
  NATURAL_SURFACES,
} from "@/lib/game/grid";
import { useTuning } from "@/lib/game/tuning";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { worldTime } from "@/lib/game/worldClock";
import { meshShadow, shadowClassFor } from "@/lib/game/shadows";

const PACK_URL = "/assets/nature/grass-tufts.glb";
useGLTF.preload(PACK_URL);
/** Tufts are the Small shadow class: no sun shadow, they receive. */
const TUFT_SHADOW = meshShadow(shadowClassFor(PACK_URL), "tuft");

/**
 * Lite's thinning: every tuft within `near` u of the camera (on the ground), `keep` of them past `far`, a straight ramp
 * between; the instances are rewritten when the camera has moved `step` u since the last time.
 */
export const THIN = { near: 30, far: 45, keep: 0.25, step: 2 };
/** The share of tufts standing `d` u from the camera on Lite. */
export function thinShare(d: number): number {
  return d <= THIN.near ? 1 : d >= THIN.far ? THIN.keep : 1 - ((d - THIN.near) / (THIN.far - THIN.near)) * (1 - THIN.keep);
}

/** How much likelier a tuft is on grass beside a soil path or the beach. */
const EDGE_TUFTS = 3;

/** Deterministic per-cell hash in [0, 1). Same cell, same tuft, every load. */
function hash01(cx: number, cz: number, salt: number): number {
  let h = (cx * 374761393 + cz * 668265263 + salt * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * A single tuft: two crossed cards, tapered to a point, with the tip vertices
 * flagged so the shader knows what to bend.
 *
 * The flag rides in the UV's y, which is already 1 at the tip and 0 at the
 * base — so bend strength is just `uv.y`, and no custom attribute is needed.
 */
export function tuftGeometry(height: number): THREE.BufferGeometry {
  const w = 0.13;
  const make = (rot: number) => {
    const g = new THREE.PlaneGeometry(w, height, 1, 1);
    g.translate(0, height / 2, 0);
    g.rotateY(rot);
    return g;
  };
  const a = make(0);
  const b = make(Math.PI / 2);

  // Merge by hand — two quads is not worth pulling in BufferGeometryUtils.
  const pos = new Float32Array(a.attributes.position.count * 3 * 2);
  const uv = new Float32Array(a.attributes.uv.count * 2 * 2);
  pos.set(a.attributes.position.array as Float32Array, 0);
  pos.set(b.attributes.position.array as Float32Array, a.attributes.position.count * 3);
  uv.set(a.attributes.uv.array as Float32Array, 0);
  uv.set(b.attributes.uv.array as Float32Array, a.attributes.uv.count * 2);

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const n = a.attributes.position.count;
  const idxA = Array.from(a.index!.array);
  g.setIndex([...idxA, ...idxA.map((i) => i + n)]);
  a.dispose();
  b.dispose();
  g.computeVertexNormals();
  return g;
}

/**
 * The wind, as a vertex-shader patch.
 *
 * `bend = uv.y^2` so the base stays planted and the tip does the moving, which
 * is what makes it read as grass rather than as a sliding sprite. The gust term
 * uses WORLD position, so the wave travels across the field instead of every
 * tuft moving in lockstep — that lockstep is the tell that gives away cheap
 * foliage.
 */
/**
 * Exported so `/lab/tune` patches the SAME shader the world does. A bench that
 * tunes a copy of the effect is a bench that lies.
 */
export function patchWind(
  mat: THREE.Material,
  uTime: { value: number },
  uWind: { value: THREE.Vector4 }
) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uWind = uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uTime;
         uniform vec4 uWind; // amount, speed, gust wavelength, tuft height`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           vec3 tuftOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
         #else
           vec3 tuftOrigin = vec3(0.0);
         #endif
         // Bend from HEIGHT UP THE BLADE, not from uv.y — the imported pack
         // carries no UVs, and height works for both sources. Tufts are
         // authored with their base at y = 0, so this is 0 at the root and 1 at
         // the tip; squaring it keeps the root planted.
         float up = clamp(transformed.y / max(uWind.w, 0.001), 0.0, 1.0);
         float bend = up * up;
         float gust = (tuftOrigin.x + tuftOrigin.z) / max(uWind.z, 0.001);
         float phase = uTime * uWind.y + gust;
         transformed.x += sin(phase) * bend * uWind.x;
         transformed.z += cos(phase * 0.7) * bend * uWind.x * 0.6;`
      );
  };
  mat.needsUpdate = true;
}

interface Tuft { x: number; y: number; z: number; rot: number; s: number; v: number; rank: number }

/** Each variant's placements and their matrices (16 floats each), built once. */
interface Variant { mesh: THREE.InstancedMesh | null; tufts: Tuft[]; matrices: Float32Array }

/** Lite: rewrite each variant's instances for the camera at (x, z): the tufts its thinning keeps. Module scope (frame loop). */
function thinTo(variants: Variant[], x: number, z: number) {
  for (const v of variants) {
    const inst = v.mesh;
    if (!inst) continue;
    const out = inst.instanceMatrix.array as Float32Array;
    let k = 0;
    for (let i = 0; i < v.tufts.length; i++) {
      const p = v.tufts[i];
      if (p.rank >= thinShare(Math.hypot(p.x - x, p.z - z))) continue;
      out.set(v.matrices.subarray(i * 16, i * 16 + 16), k * 16);
      k++;
    }
    inst.count = k;
    inst.instanceMatrix.needsUpdate = true;
  }
}

/** Every variant's instances: all its tufts (High, and Lite until the first thinning). */
function showAll(variants: Variant[]) {
  for (const v of variants) {
    const inst = v.mesh;
    if (!inst) continue;
    (inst.instanceMatrix.array as Float32Array).set(v.matrices);
    inst.count = v.tufts.length;
    inst.instanceMatrix.needsUpdate = true;
  }
}

/** `windScale` multiplies sway: 0 for the Light tier, >1 on windy days. */
export default function GrassTufts({ map, windScale = 1 }: { map: IslandMap; windScale?: number }) {
  const t = useTuning();
  const [graphics] = useGraphicsSettings();
  const thin = graphics.liteMode;
  // Plain memo, not a ref: these objects are handed to the shader once and then
  // mutated per frame, and reading a ref during render to build the material is
  // exactly what the react-compiler lint rule forbids.
  // Refs, matching the pattern Ocean.tsx already uses for its animated
  // uniforms: the react-compiler lint forbids mutating a useMemo result, and a
  // uniform object exists precisely to be mutated every frame.
  const uTime = useRef({ value: 0 });
  const uWind = useRef({ value: new THREE.Vector4(0.09, 1.1, 9, 0.34) });

  // Placements depend only on density, so a sway tweak does not rebuild them.
  const groundField = useMemo(() => heightField(map), [map]);
  const placements = useMemo(() => {
    const out: Tuft[] = [];
    if (t.grass.tuftDensity <= 0) return out;
    const chance = t.grass.tuftDensity / 100;
    for (let cz = 0; cz < map.depth; cz++) {
      for (let cx = 0; cx < map.width; cx++) {
        const s = surfaceAt(map, cx, cz);
        if (isVoid(s) || s !== Surface.Grass) continue;
        if (needsCliff(map, cx, cz)) continue;
        // Thicker along a worn path or beach edge, where grass grows back into the trodden ground.
        const edge = DIR_OFFSETS.some(([dx, dz]) => NATURAL_SURFACES.has(surfaceAt(map, cx + dx, cz + dz)));
        if (hash01(cx, cz, 1) > chance * (edge ? EDGE_TUFTS : 1)) continue;
        const x = cellToWorldX(map, cx) + (hash01(cx, cz, 2) - 0.5) * TILE;
        const z = cellToWorldZ(map, cz) + (hash01(cx, cz, 3) - 0.5) * TILE;
        if (!isGroundAtWorld(map, x, z)) continue; // the organic coast can take a cell's corner
        // On the grass side of a worn edge, not out on the path.
        if ([...NATURAL_SURFACES].some((o) => overlayAt(map, o, x, z) > 0.4)) continue;
        out.push({
          x, y: sampleGroundHeight(map, groundField, x, z), z,
          rot: hash01(cx, cz, 4) * Math.PI * 2,
          s: 0.75 + hash01(cx, cz, 5) * 0.5,
          v: Math.floor(hash01(cx, cz, 6) * 64) % 64,
          rank: hash01(cx, cz, 7),
        });
      }
    }
    return out;
  }, [map, groundField, t.grass.tuftDensity]);

  const useModel = t.grass.model >= 0.5;

  // The imported pack. Tufts are authored 1.0 unit tall with their base at the
  // origin, so `tuftHeight` is a straight scale rather than a rebuild — which is
  // why the height slider does not churn geometry on this path.
  const { scene: packScene } = useGLTF(PACK_URL);
  const variants = useMemo(() => {
    if (!useModel) return [] as THREE.BufferGeometry[];
    const out: THREE.BufferGeometry[] = [];
    packScene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) out.push(mesh.geometry);
    });
    return out;
  }, [packScene, useModel]);
  const scaleFor = useModel ? t.grass.tuftHeight : 1;

  const cardGeometry = useMemo(
    () => (useModel ? new THREE.BufferGeometry() : tuftGeometry(t.grass.tuftHeight)),
    [t.grass.tuftHeight, useModel]
  );

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      name: "terrain:tufts",
      // White base when the pack supplies colour through COLOR_0; the flat green
      // is only for the procedural cards, which carry no vertex colour.
      color: useModel ? 0xffffff : 0x86b862,
      vertexColors: useModel,
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
      // Blades read as solid from the diorama camera; alpha would cost a sorted
      // transparent pass for no visible gain at this size.
      transparent: false,
    });
    return m;
  }, [useModel]);

  // The wind patch is attached in an EFFECT, not in the memo that builds the
  // material: effects may read refs, render may not, and the material is not
  // compiled by the renderer until the first frame, which is after effects run.
  useEffect(() => {
    patchWind(material, uTime.current, uWind.current);
    return () => material.dispose();
  }, [material]);
  useEffect(() => () => cardGeometry.dispose(), [cardGeometry]);

  // Each variant's tufts and matrices, built once; the instanced meshes take them (all of them, or Lite's thinned share).
  const variantCount = useModel && variants.length > 0 ? variants.length : 1;
  const sets = useMemo((): Variant[] => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    return Array.from({ length: variantCount }, (_, variant) => {
      const tufts = placements.filter(pl => variantCount === 1 || pl.v % variantCount === variant);
      const matrices = new Float32Array(tufts.length * 16);
      tufts.forEach((pl, i) => {
        e.set(0, pl.rot, 0);
        q.setFromEuler(e);
        p.set(pl.x, pl.y, pl.z);
        sc.setScalar(pl.s * scaleFor);
        m.compose(p, q, sc).toArray(matrices, i * 16);
      });
      return { mesh: null, tufts, matrices };
    });
  }, [placements, variantCount, scaleFor]);
  const thinnedAt = useRef({ x: NaN, z: NaN });

  useFrame(({ camera }) => {
    uTime.current.value = worldTime();
    uWind.current.value.set(t.grass.tuftSway * windScale, t.grass.swaySpeed, t.grass.gustLength, t.grass.tuftHeight);
    if (!thin) return;
    const at = thinnedAt.current;
    if (Math.hypot(camera.position.x - at.x, camera.position.z - at.z) < THIN.step) return;
    at.x = camera.position.x; at.z = camera.position.z;
    thinTo(sets, at.x, at.z);
  });
  // A new set of instances, or Lite turned on or off: all of them, then (on Lite) the thinning from the next frame.
  useEffect(() => { thinnedAt.current.x = NaN; showAll(sets); }, [sets, thin]);

  const setMatricesFor = (variant: number) => (inst: THREE.InstancedMesh | null) => {
    sets[variant].mesh = inst;
    showAll(sets);
  };

  if (placements.length === 0) return null;

  // ONE InstancedMesh per tuft variant. The pack collapses to a single material
  // (colour is baked into COLOR_0 by the extractor), so this is `variants` draw
  // calls for the entire grass layer of the island, not one per tuft.
  if (useModel && variants.length > 0) {
    return (
      <group>
        {variants.map((geo, i) => (
          <instancedMesh
            key={i}
            ref={setMatricesFor(i)}
            args={[geo, material, placements.length]}
            frustumCulled={false}
            castShadow={TUFT_SHADOW.cast}
            receiveShadow={TUFT_SHADOW.receive}
          />
        ))}
      </group>
    );
  }

  return (
    <instancedMesh
      ref={setMatricesFor(0)}
      args={[cardGeometry, material, placements.length]}
      frustumCulled={false}
      castShadow={TUFT_SHADOW.cast}
      receiveShadow={TUFT_SHADOW.receive}
    />
  );
}
