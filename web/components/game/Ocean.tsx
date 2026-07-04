"use client";

/**
 * Ocean + island skirt (cozy push V3) — the ACNH island edge.
 *
 * A 400x400 water plane surrounds the 82x82 terrain, replacing the hard
 * plane-edge-against-sky rim that the fog pullback exposed. Same shader
 * approach as River.tsx: MeshBasicMaterial + onBeforeCompile, two scrolling
 * sine waves for sparkle, plus a foam band that hugs the island's square
 * footprint (Chebyshev distance in world XZ) so waves lap at the shore.
 * Fog + the curved-world chunk apply automatically (built-in material).
 *
 * The skirt is four soil-colored boxes under the terrain perimeter so the
 * island reads as a chunky cliff over the water instead of a paper edge.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const OCEAN_SIZE = 400;
const OCEAN_Y = -0.55;
const ISLAND_HALF = 41; // terrain is 82x82
const FOAM_BAND = 2.6; // how far the shore foam reaches out from the island
const DEEP = "#3D8FC4";
const SHALLOW = "#7CC4E8";
const FOAM = "#EAF7FA";
const SOIL = "#7A5C43";
const SOIL_DARK = "#5E4632";

export default function Ocean() {
  const timeUniform = useRef({ value: 0 });

  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform.current;
      shader.uniforms.uDeep = { value: new THREE.Color(DEEP) };
      shader.uniforms.uShallow = { value: new THREE.Color(SHALLOW) };
      shader.uniforms.uFoam = { value: new THREE.Color(FOAM) };

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
  // Chebyshev distance to the island footprint: 0 at the shore line.
  float shore = max(abs(vOceanXZ.x), abs(vOceanXZ.y)) - ${ISLAND_HALF.toFixed(1)};

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

  useFrame((_, delta) => {
    timeUniform.current.value += delta;
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

      {/* Island skirt: soil cliff faces under the terrain perimeter. Slight
          inward tilt-free boxes; tops tucked under the terrain edge. */}
      {([
        [0, -1.05, -ISLAND_HALF, 82.4, 0.35],
        [0, -1.05, ISLAND_HALF, 82.4, 0.35],
      ] as const).map(([x, y, z, w], i) => (
        <mesh key={`ns-${i}`} position={[x, y, z]}>
          <boxGeometry args={[w, 2.4, 0.7]} />
          <meshStandardMaterial color={i % 2 ? SOIL : SOIL_DARK} roughness={1} />
        </mesh>
      ))}
      {([
        [-ISLAND_HALF, -1.05, 0],
        [ISLAND_HALF, -1.05, 0],
      ] as const).map(([x, y, z], i) => (
        <mesh key={`ew-${i}`} position={[x, y, z]}>
          <boxGeometry args={[0.7, 2.4, 82.4]} />
          <meshStandardMaterial color={i % 2 ? SOIL : SOIL_DARK} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}
