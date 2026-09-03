"use client";

/**
 * MiniOcean — the member island's sea shader (Ocean.tsx) with a plain
 * radial shoreline at the applicant island's SHORE_RADIUS. No harmonic
 * coast wobble, no night glints: the portal is pinned to late afternoon.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getCausticTexture } from "@/lib/game/causticTexture";
import { SHORE_RADIUS } from "@/lib/game/miniIsland";

const OCEAN_SIZE = 260;
const OCEAN_Y = -0.55;
const FOAM_BAND = 2.2;

// Day palette from Ocean.tsx SEA_PALETTE, warmed a touch for the hour.
const DEEP = "#4A85A8";
const SHALLOW = "#8FC2D4";
const FOAM = "#F2F5EC";

export default function MiniOcean() {
  const timeUniform = useRef({ value: 0 });

  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform.current;
      shader.uniforms.uDeep = { value: new THREE.Color(DEEP) };
      shader.uniforms.uShallow = { value: new THREE.Color(SHALLOW) };
      shader.uniforms.uFoam = { value: new THREE.Color(FOAM) };
      shader.uniforms.uCaustic = { value: getCausticTexture() };

      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\nvarying vec2 vOceanXZ;`)
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\nvOceanXZ = (modelMatrix * vec4(position, 1.0)).xz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform float uTime;
uniform sampler2D uCaustic;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
varying vec2 vOceanXZ;`
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
{
  float shore = length(vOceanXZ) - ${SHORE_RADIUS.toFixed(1)};
  float depthT = smoothstep(0.0, 9.0, shore);
  vec3 water = mix(uShallow, uDeep, depthT);

  float w1 = sin(vOceanXZ.x * 0.55 + uTime * 0.9) * sin(vOceanXZ.y * 0.5 - uTime * 0.7);
  float w2 = sin((vOceanXZ.x + vOceanXZ.y) * 0.32 + uTime * 0.5);
  float sparkle = pow(max(w1 * w2, 0.0), 3.0) * 0.35;

  float c1 = texture2D(uCaustic, vOceanXZ * 0.055 + uTime * vec2(0.012, 0.008)).r;
  float c2 = texture2D(uCaustic, vOceanXZ * 0.089 - uTime * vec2(0.009, 0.013)).r;
  float web = smoothstep(0.24, 0.60, min(c1, c2)) * 0.8;
  web *= mix(1.0, 0.2, depthT);

  float lap = sin(vOceanXZ.x * 0.9 + vOceanXZ.y * 0.7 + uTime * 1.4) * 0.5;
  float foamEdge = ${FOAM_BAND.toFixed(1)} + lap;
  float foam = 1.0 - smoothstep(0.35, foamEdge, shore);
  foam *= step(0.0, shore);

  vec3 col = mix(water + sparkle, uFoam, clamp(web, 0.0, 1.0));
  diffuseColor.rgb = mix(col, uFoam, clamp(foam, 0.0, 1.0));
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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, OCEAN_Y, 0]} material={material}>
      <planeGeometry args={[OCEAN_SIZE, OCEAN_SIZE, 40, 40]} />
    </mesh>
  );
}
