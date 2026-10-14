"use client";

/**
 * Decorative fish (v1 water item 6, specs/v1-drop.md §8c.6): small schools gliding in the shallows, scenery only (they
 * can't be caught and mark no fishing spot). Where each school swims is the map's and where each fish is the world
 * clock's (lib/game/decorativeFish.ts), so every client sees the same fish. One instanced mesh for every fish in reach
 * of the view's focus: one draw. Each school its own colour, each tail swinging in the shader, all seen through the
 * water by their depth (and wobbling with glass water on High).
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { IslandMap } from "@/lib/game/grid";
import { shoreFieldOf } from "@/lib/game/seabed";
import { fishAt, fishSchools, type FishPose, type FishSchool } from "@/lib/game/decorativeFish";
import { fxOn } from "@/lib/game/perf/fxBench";
import { worldTime } from "@/lib/game/worldClock";
import { addUnderwater } from "../grid/terrainMaterials";

export const FISH_URL = "/assets/game/water/fish.glb";
useGLTF.preload(FISH_URL);

/** Fish drawn within this of the view's focus. */
const REACH = 40;

function fishMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  m.name = "decorative-fish";
  m.onBeforeCompile = (shader) => {
    addUnderwater(shader, "sea");
    // The tail swings side to side behind the body (nothing at the nose), quick, each fish at its own phase.
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      {
        vec3 fishAt = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float back = clamp(-position.z / 0.12 + 0.25, 0.0, 1.2);
        transformed.x += sin(mod(uTime * 11.0, 6.2831853) + dot(fishAt.xz, vec2(3.1, 2.3)) - position.z * 18.0) * 0.016 * back * back;
      }`);
  };
  m.customProgramCacheKey = () => "decorative-fish-v1";
  return m;
}

type Fish = { mesh: THREE.InstancedMesh; schools: readonly FishSchool[] };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0), _eye = new THREE.Vector3(), _dir = new THREE.Vector3();
const pose: FishPose = { x: 0, y: 0, z: 0, yaw: 0 };

/** The frame (module scope: the react compiler forbids writing through hook values): every fish in reach, placed. */
function swim(f: Fish, camera: THREE.Camera) {
  const on = fxOn("fish");
  f.mesh.visible = on;
  if (!on) return;
  camera.getWorldPosition(_eye);
  camera.getWorldDirection(_dir);
  const k = _dir.y < -0.05 ? Math.min(-_eye.y / _dir.y, 60) : 60, fx = _eye.x + _dir.x * k, fz = _eye.z + _dir.z * k;
  const t = worldTime();
  let n = 0;
  for (const s of f.schools) {
    if (Math.hypot(s.cx - fx, s.cz - fz) > REACH + s.a) continue;
    _c.setHex(s.tint);
    for (let i = 0; i < s.count; i++) {
      fishAt(s, i, t, pose);
      _m.compose(_p.set(pose.x, pose.y, pose.z), _q.setFromAxisAngle(UP, pose.yaw), _s.setScalar(s.size));
      f.mesh.setMatrixAt(n, _m);
      f.mesh.setColorAt(n, _c);
      n++;
    }
  }
  f.mesh.count = n;
  f.mesh.instanceMatrix.needsUpdate = true;
  if (f.mesh.instanceColor) f.mesh.instanceColor.needsUpdate = true;
}

export default function DecorativeFish({ map, lite = false, skip }: { map: IslandMap; lite?: boolean; skip?: (x: number, z: number) => boolean }) {
  const { nodes } = useGLTF(FISH_URL) as unknown as { nodes: Record<string, THREE.Mesh> };
  const fish = useMemo((): Fish | null => {
    const schools = fishSchools(map, shoreFieldOf(map), { avoid: skip, lite });
    const total = schools.reduce((a, s) => a + s.count, 0), geometry = nodes.fish?.geometry;
    if (!total || !geometry) return null;
    const mesh = new THREE.InstancedMesh(geometry, fishMaterial(), total);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3);
    mesh.count = 0;
    mesh.name = "decorative-fish";
    mesh.frustumCulled = false; // placed every frame round the focus; one draw
    mesh.castShadow = false;
    return { mesh, schools };
  }, [map, skip, lite, nodes]);
  useEffect(() => () => { if (fish) { (fish.mesh.material as THREE.Material).dispose(); fish.mesh.dispose(); } }, [fish]);
  useFrame(({ camera }) => { if (fish) swim(fish, camera); });
  return fish ? <primitive object={fish.mesh} /> : null;
}
