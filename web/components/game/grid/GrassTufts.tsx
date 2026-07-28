"use client";

/**
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
 */

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  type IslandMap,
  Surface,
  TILE,
  LEVEL_STEP,
  levelAt,
  surfaceAt,
  isVoid,
  needsCliff,
  cellToWorldX,
  cellToWorldZ,
} from "@/lib/game/grid";
import { useTuning } from "@/lib/game/tuning";

const PACK_URL = "/assets/nature/grass-tufts.glb";
useGLTF.preload(PACK_URL);

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

export default function GrassTufts({ map }: { map: IslandMap }) {
  const t = useTuning();
  // Plain memo, not a ref: these objects are handed to the shader once and then
  // mutated per frame, and reading a ref during render to build the material is
  // exactly what the react-compiler lint rule forbids.
  // Refs, matching the pattern Ocean.tsx already uses for its animated
  // uniforms: the react-compiler lint forbids mutating a useMemo result, and a
  // uniform object exists precisely to be mutated every frame.
  const uTime = useRef({ value: 0 });
  const uWind = useRef({ value: new THREE.Vector4(0.09, 1.1, 9, 0.34) });

  // Placements depend only on density, so a sway tweak does not rebuild them.
  const placements = useMemo(() => {
    const out: { x: number; y: number; z: number; rot: number; s: number; v: number }[] = [];
    if (t.grass.tuftDensity <= 0) return out;
    const chance = t.grass.tuftDensity / 100;
    for (let cz = 0; cz < map.depth; cz++) {
      for (let cx = 0; cx < map.width; cx++) {
        const s = surfaceAt(map, cx, cz);
        if (isVoid(s) || s !== Surface.Grass) continue;
        if (needsCliff(map, cx, cz)) continue;
        if (hash01(cx, cz, 1) > chance) continue;
        out.push({
          x: cellToWorldX(map, cx) + (hash01(cx, cz, 2) - 0.5) * TILE,
          y: levelAt(map, cx, cz) * LEVEL_STEP,
          z: cellToWorldZ(map, cz) + (hash01(cx, cz, 3) - 0.5) * TILE,
          rot: hash01(cx, cz, 4) * Math.PI * 2,
          s: 0.75 + hash01(cx, cz, 5) * 0.5,
          v: Math.floor(hash01(cx, cz, 6) * 64) % 64,
        });
      }
    }
    return out;
  }, [map, t.grass.tuftDensity]);

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
  }, [material]);

  useFrame((state) => {
    uTime.current.value = state.clock.elapsedTime;
    uWind.current.value.set(t.grass.swayAmount, t.grass.swaySpeed, t.grass.gustLength, t.grass.tuftHeight);
  });

  const setMatricesFor = (variant: number, total: number) => (inst: THREE.InstancedMesh | null) => {
    if (!inst) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    let k = 0;
    for (const pl of placements) {
      if (total > 1 && pl.v % total !== variant) continue;
      e.set(0, pl.rot, 0);
      q.setFromEuler(e);
      p.set(pl.x, pl.y, pl.z);
      sc.setScalar(pl.s * scaleFor);
      m.compose(p, q, sc);
      inst.setMatrixAt(k++, m);
    }
    inst.count = k;
    inst.instanceMatrix.needsUpdate = true;
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
            ref={setMatricesFor(i, variants.length)}
            args={[geo, material, placements.length]}
            frustumCulled={false}
            castShadow={false}
            receiveShadow
          />
        ))}
      </group>
    );
  }

  return (
    <instancedMesh
      ref={setMatricesFor(0, 1)}
      args={[cardGeometry, material, placements.length]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow
    />
  );
}
