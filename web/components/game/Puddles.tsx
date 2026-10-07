"use client";

/**
 * The rain's puddles (specs/polish/forage-craft-museum.md 5), drawn as water lying on the ground: an uneven outline
 * (each its own, from its spot), a dark wet rim where the ground soaks it up, and still water in the middle that takes
 * the sky's light off the environment, wrinkling where the drops land. Rain rings land on them (WeatherGround) and a
 * foot splashes in them (lib/game/puddles.ts). One instanced draw; nothing per frame but a clock uniform.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { worldTime } from "@/lib/game/worldClock";

export interface PuddleBlob { x: number; y: number; z: number; rx: number; rz: number; yaw: number }

const DISC = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
const TIME = { value: 0 };

function puddleMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ name: "Puddle", color: "#4f6472", roughness: 0.16, metalness: 0, envMapIntensity: 1.25, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.onBeforeCompile = shader => {
    shader.uniforms.uPuddleTime = TIME;
    shader.vertexShader = "varying vec2 vPud;\nvarying float vPudSeed;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
  vPud = uv * 2.0 - 1.0;
  #ifdef USE_INSTANCING
    vPudSeed = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;
  #else
    vPudSeed = 0.0;
  #endif`);
    shader.fragmentShader = "uniform float uPuddleTime;\nvarying vec2 vPud;\nvarying float vPudSeed;\n" + shader.fragmentShader
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
  // Drops wrinkling the surface: a few moving rings, faint.
  float pudW = sin(length(vPud * 9.0 + vec2(sin(vPudSeed), cos(vPudSeed))) * 6.0 - uPuddleTime * 5.0) * 0.5 + sin(vPud.x * 13.0 + uPuddleTime * 2.3 + vPudSeed) * 0.25;
  normal = normalize(normal + vec3(pudW * 0.035, 0.0, pudW * 0.03));`)
      .replace("#include <color_fragment>", `#include <color_fragment>
  {
    // Its own outline: an ellipse worn uneven by two slow waves round its edge.
    float pudA = atan(vPud.y, vPud.x);
    float pudR = length(vPud) + sin(pudA * 3.0 + vPudSeed) * 0.07 + sin(pudA * 7.0 + vPudSeed * 1.7) * 0.035;
    float pudIn = smoothstep(1.0, 0.86, pudR);
    // The soaked rim, darker than the water it holds.
    float pudRim = smoothstep(1.0, 0.9, pudR) * smoothstep(0.62, 0.86, pudR);
    diffuseColor.rgb *= 1.0 - pudRim * 0.35;
    diffuseColor.a *= pudIn;
    if (diffuseColor.a < 0.004) discard;
  }`);
  };
  m.customProgramCacheKey = () => "puddle-v1";
  return m;
}

/** Module scope (the react compiler forbids writing through hook values). */
const setOpacity = (m: THREE.Material, o: number) => { m.opacity = o; };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
export default function Puddles({ spots, opacity = 0.82 }: { spots: readonly PuddleBlob[]; opacity?: number }) {
  const material = useMemo(() => puddleMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(DISC, material, Math.max(1, spots.length));
    m.frustumCulled = false; m.renderOrder = 1; m.receiveShadow = true;
    spots.forEach((s, i) => m.setMatrixAt(i, _m.compose(_p.set(s.x, s.y + 0.025, s.z), _q.setFromAxisAngle(_up, s.yaw + i * 0.9), _s.set(s.rx, 1, s.rz))));
    m.count = spots.length;
    m.instanceMatrix.needsUpdate = true;
    return m;
  }, [spots, material]);
  useEffect(() => setOpacity(material, opacity), [material, opacity]);
  useFrame(() => { TIME.value = worldTime(); });
  return <primitive object={mesh} />;
}
