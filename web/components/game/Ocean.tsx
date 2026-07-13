"use client";

/**
 * Ocean + island skirt (cozy push V3) — the ACNH island edge.
 *
 * A 400x400 water plane surrounds the terrain. Same shader approach as
 * River.tsx: MeshBasicMaterial + onBeforeCompile, two scrolling sine waves
 * for sparkle, plus a foam band that laps the shore. Fog + the curved-world
 * chunk apply automatically (built-in material).
 *
 * Task 27 (2026-07-12): the island is ROUND now. Shore distance is radial
 * (length(xz) - SHORE_RADIUS) instead of the old Chebyshev square, and the
 * four square skirt boxes are gone — the terrain rim itself sinks into a
 * sand ring under the waterline (see Terrain() in GameWorld.tsx).
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const OCEAN_SIZE = 400;
const OCEAN_Y = -0.55;
const SHORE_RADIUS = 51.4; // where the sunken beach ring crosses OCEAN_Y
const FOAM_BAND = 2.6; // how far the shore foam reaches out from the island

// V5: sea palette per time-of-day. [deep, shallow, foam]. Day = bright azure,
// dusk = warm violet, night = deep navy, dawn = soft peach-blue.
type Phase = "dawn" | "day" | "dusk" | "night";
const SEA_PALETTE: Record<Phase, [string, string, string]> = {
  dawn: ["#5E86C4", "#9FC0D8", "#F2E4D8"],
  day: ["#3D8FC4", "#7CC4E8", "#EAF7FA"],
  dusk: ["#5A5490", "#9C7FB0", "#F0D8C4"],
  night: ["#1E2A52", "#354674", "#8FA0C8"],
};

export default function Ocean({ phase }: { phase: Phase }) {
  const timeUniform = useRef({ value: 0 });
  // Live uniform refs so the frame loop can lerp toward the phase palette.
  const deepRef = useRef(new THREE.Color(SEA_PALETTE.day[0]));
  const shallowRef = useRef(new THREE.Color(SEA_PALETTE.day[1]));
  const foamRef = useRef(new THREE.Color(SEA_PALETTE.day[2]));
  const phaseRef = useRef<Phase>(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform.current;
      shader.uniforms.uDeep = { value: deepRef.current };
      shader.uniforms.uShallow = { value: shallowRef.current };
      shader.uniforms.uFoam = { value: foamRef.current };

      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
varying vec2 vOceanXZ;`
      ).replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vOceanXZ = (modelMatrix * vec4(position, 1.0)).xz;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
varying vec2 vOceanXZ;`
      ).replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  // Radial distance to the round shoreline: 0 at the waterline.
  float shore = length(vOceanXZ) - ${SHORE_RADIUS.toFixed(1)};

  // Depth ramp: shallow near shore -> deep water outward.
  float depthT = smoothstep(0.0, 14.0, shore);
  vec3 water = mix(uShallow, uDeep, depthT);

  // Sparkle: two crossed scrolling waves, product sharpened.
  float w1 = sin(vOceanXZ.x * 0.55 + uTime * 0.9) * sin(vOceanXZ.y * 0.5 - uTime * 0.7);
  float w2 = sin((vOceanXZ.x + vOceanXZ.y) * 0.32 + uTime * 0.5);
  float sparkle = pow(max(w1 * w2, 0.0), 3.0) * 0.35;

  // Shore foam: a lapping band just outside the island, edge animated by a
  // travelling sine so the line breathes like ACNH's beach waves.
  float lap = sin(vOceanXZ.x * 0.9 + vOceanXZ.y * 0.7 + uTime * 1.4) * 0.5;
  float foamEdge = ${FOAM_BAND.toFixed(1)} + lap;
  float foam = 1.0 - smoothstep(0.35, foamEdge, shore);
  foam *= step(0.0, shore); // nothing under the island itself

  diffuseColor.rgb = mix(water + sparkle, uFoam, clamp(foam, 0.0, 1.0));
}`
      );
    };
    return mat;
  }, []);

  useEffect(() => () => material.dispose(), [material]);

  const _tgt = useMemo(() => new THREE.Color(), []);
  useFrame((_, delta) => {
    timeUniform.current.value += delta;
    // V5: ease the sea palette toward the current phase (~1.5s to settle).
    const pal = SEA_PALETTE[phaseRef.current];
    const k = 1 - Math.exp(-delta / 0.5);
    deepRef.current.lerp(_tgt.set(pal[0]), k);
    shallowRef.current.lerp(_tgt.set(pal[1]), k);
    foamRef.current.lerp(_tgt.set(pal[2]), k);
  });

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, OCEAN_Y, 0]}
        material={material}
      >
        {/* Enough segments for the curved-world bend to roll the sea too */}
        <planeGeometry args={[OCEAN_SIZE, OCEAN_SIZE, 48, 48]} />
      </mesh>
    </group>
  );
}
