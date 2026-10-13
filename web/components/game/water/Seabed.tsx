"use client";

/**
 * The seabed's props (v1 water item 2, specs/v1-drop.md §8c.1): faceted boulders, seagrass, kelp and coral-like plants
 * on the sand under the shallows (art/water/build_seabed.py), placed by the map (lib/game/seabedProps.ts) and drawn
 * one instanced mesh per kind: eight draws on High, three on Lite (the rocks and the seagrass, fewer of them). They are
 * seen through the water over them (the same depth fog as the bed) and the plants sway on the world clock. Only the
 * ones within reach of the view's focus are drawn (culling is per view; where they are is the map's).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { IslandMap } from "@/lib/game/grid";
import { shoreFieldOf } from "@/lib/game/seabed";
import { SEABED_KINDS, seabedProps, type SeabedKind } from "@/lib/game/seabedProps";
import { fxOn } from "@/lib/game/perf/fxBench";
import { foamRings } from "@/lib/game/foamRings";
import { addUnderwater, waterSurfaceUniforms } from "../grid/terrainMaterials";

export const SEABED_URL = "/assets/game/water/seabed.glb";
useGLTF.preload(SEABED_URL);

/** Drawn within this of the view's focus (world units): the sea on screen and a margin. */
const REACH = { high: 46, lite: 32 };
/** The focus moves this far before the drawn set is refilled. */
const REFILL = 5;

/** A kind's material: matte, its model's colour times each instance's tint, seen through the water; plants sway. */
function seabedMaterial(src: THREE.Material, kind: SeabedKind): THREE.MeshStandardMaterial {
  const color = (src as THREE.MeshStandardMaterial).color ?? new THREE.Color(0xffffff);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, side: kind.sway ? THREE.DoubleSide : THREE.FrontSide });
  m.name = `seabed:${kind.name}`;
  m.onBeforeCompile = (shader) => {
    addUnderwater(shader, "sea");
    if (!kind.sway) return;
    shader.uniforms.uTime = waterSurfaceUniforms().uTime;
    // Bends over with height (its tip the most), on the world clock, each plant at its own phase by where it stands.
    shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      {
        vec3 swayAt = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float k = clamp(position.y / ${kind.height.toFixed(2)}, 0.0, 1.0);
        float ph = dot(swayAt.xz, vec2(0.37, 0.61));
        float a = sin(mod(uTime * 0.9, 6.2831853) + ph) * 0.7 + sin(mod(uTime * 1.7, 6.2831853) + ph * 1.9) * 0.3;
        transformed.xz += vec2(a, cos(mod(uTime * 0.7, 6.2831853) + ph)) * ${(0.07).toFixed(2)} * k * k;
      }`);
  };
  m.customProgramCacheKey = () => `seabed-v1-${kind.sway ? "sway" : "still"}`;
  return m;
}

type Kind = { mesh: THREE.InstancedMesh; matrices: Float32Array; tints: Float32Array; xz: Float32Array };
type Last = { x: number; z: number; kinds: readonly Kind[] | null };
/**
 * The frame (module scope: the react compiler forbids writing through hook values). Shown or hidden by the world
 * bench's switch; when the view's focus has moved REFILL, the instances in reach of it are copied in.
 */
function refill(kinds: readonly Kind[], last: Last, camera: THREE.Camera, lite: boolean) {
  const on = fxOn("seabed");
  for (const k of kinds) k.mesh.visible = on;
  if (!on) return;
  // The focus: where the view's ray meets the sea (the sea that is on screen).
  camera.getWorldPosition(_eye);
  camera.getWorldDirection(_dir);
  const t = _dir.y < -0.05 ? Math.min(-_eye.y / _dir.y, 60) : 60, fx = _eye.x + _dir.x * t, fz = _eye.z + _dir.z * t;
  if (last.kinds === kinds && Math.hypot(fx - last.x, fz - last.z) < REFILL) return;
  last.x = fx; last.z = fz; last.kinds = kinds;
  const reach = lite ? REACH.lite : REACH.high, r2 = reach * reach;
  for (const k of kinds) {
    const dst = k.mesh.instanceMatrix.array as Float32Array, col = k.mesh.instanceColor!.array as Float32Array;
    let n = 0;
    for (let i = 0; i < k.xz.length / 2; i++) {
      const dx = k.xz[i * 2] - fx, dz = k.xz[i * 2 + 1] - fz;
      if (dx * dx + dz * dz > r2) continue;
      dst.set(k.matrices.subarray(i * 16, i * 16 + 16), n * 16);
      col.set(k.tints.subarray(i * 3, i * 3 + 3), n * 3);
      n++;
    }
    k.mesh.count = n;
    k.mesh.instanceMatrix.needsUpdate = true;
    k.mesh.instanceColor!.needsUpdate = true;
  }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const _eye = new THREE.Vector3(), _dir = new THREE.Vector3();

export default function Seabed({ map, lite = false, skip }: { map: IslandMap; lite?: boolean; skip?: (x: number, z: number) => boolean }) {
  const { nodes } = useGLTF(SEABED_URL) as unknown as { nodes: Record<string, THREE.Mesh> };
  const layout = useMemo(() => seabedProps(map, shoreFieldOf(map), { skip, lite }), [map, skip, lite]);
  const kinds = useMemo((): Kind[] => SEABED_KINDS.filter(k => (!lite || k.lite) && layout.items[k.name].length && nodes[k.name]).map(kind => {
    const items = layout.items[kind.name], n = items.length;
    // Every placement's matrix and tint once; a refill copies the ones in reach.
    const matrices = new Float32Array(n * 16), tints = new Float32Array(n * 3), xz = new Float32Array(n * 2);
    items.forEach((it, i) => {
      _m.compose(_p.set(it.x, it.y, it.z), _q.setFromAxisAngle(UP, it.yaw), _s.setScalar(it.scale)).toArray(matrices, i * 16);
      _c.setHex(kind.tints[Math.floor(it.tint * kind.tints.length) % kind.tints.length]).toArray(tints, i * 3);
      xz[i * 2] = it.x; xz[i * 2 + 1] = it.z;
    });
    const mesh = new THREE.InstancedMesh(nodes[kind.name].geometry, seabedMaterial(nodes[kind.name].material as THREE.Material, kind), n);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    mesh.count = 0;
    mesh.name = `seabed:${kind.name}`;
    mesh.frustumCulled = false; // placed by the refill round the focus; the set is small
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    return { mesh, matrices, tints, xz };
  }), [nodes, layout, lite]);
  useEffect(() => () => { for (const k of kinds) { (k.mesh.material as THREE.Material).dispose(); k.mesh.dispose(); } }, [kinds]);
  // The rocks that stand out of the water wear a foam collar where they meet it (v1 water item 3).
  useEffect(() => {
    const drawn = new Set(SEABED_KINDS.filter(k => !lite || k.lite).map(k => k.name));
    const handles = layout.breaking.filter(b => drawn.has(b.kind)).map(b => foamRings.add(b.x, b.z, b.r, 1));
    return () => handles.forEach(h => foamRings.remove(h));
  }, [layout, lite]);

  const last = useRef<Last>({ x: Infinity, z: Infinity, kinds: null });
  useFrame(({ camera }) => refill(kinds, last.current, camera, lite));
  return <group>{kinds.map(k => <primitive key={k.mesh.name} object={k.mesh} />)}</group>;
}
