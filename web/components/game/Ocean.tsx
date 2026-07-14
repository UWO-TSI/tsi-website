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
import { getCausticTexture } from "@/lib/game/causticTexture";
import { COAST_GLSL, coastWobble as coastWobbleJS } from "@/lib/game/coast";

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

// ── Sea glints (Beach Cove sweep 2026-07-14) ─────────────────────
// The dump's actual sea-sparkle sprite (water-model/sea-water-model)
// as two drifting point clouds twinkling in counter-phase. Two draw
// calls, no shader work; the whole layer's opacity follows the phase.
const GLINT_URL = "/assets/acnh/textures/sea-glint.png";
const GLINT_OPACITY: Record<Phase, number> = { dawn: 0.34, day: 0.5, dusk: 0.28, night: 0.12 };

function seededGlintPositions(seed: number, count: number): Float32Array {
  const out = new Float32Array(count * 3);
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 54 + rnd() * 34; // past the shore ring, inside the fog
    out[i * 3] = Math.cos(a) * r;
    out[i * 3 + 1] = 0.03; // just above the ocean plane (local, pre-rotation Z)
    out[i * 3 + 2] = Math.sin(a) * r;
  }
  return out;
}

function SeaGlints({ phase }: { phase: Phase }) {
  const matA = useRef<THREE.PointsMaterial | null>(null);
  const matB = useRef<THREE.PointsMaterial | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const [geoA, geoB, tex] = useMemo(() => {
    const a = new THREE.BufferGeometry();
    a.setAttribute("position", new THREE.BufferAttribute(seededGlintPositions(7, 26), 3));
    const b = new THREE.BufferGeometry();
    b.setAttribute("position", new THREE.BufferAttribute(seededGlintPositions(1913, 26), 3));
    const t = new THREE.TextureLoader().load(GLINT_URL);
    t.colorSpace = THREE.SRGBColorSpace;
    return [a, b, t];
  }, []);
  useEffect(
    () => () => {
      geoA.dispose();
      geoB.dispose();
      tex.dispose();
    },
    [geoA, geoB, tex]
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const base = GLINT_OPACITY[phase];
    // counter-phase twinkle so glints pop in/out instead of pulsing as one
    if (matA.current) matA.current.opacity = base * (0.45 + 0.55 * Math.max(0, Math.sin(t * 0.9)));
    if (matB.current) matB.current.opacity = base * (0.45 + 0.55 * Math.max(0, Math.sin(t * 0.9 + Math.PI)));
    if (groupRef.current) groupRef.current.rotation.y = t * 0.004; // slow drift
  });
  return (
    <group ref={groupRef} position={[0, OCEAN_Y + 0.05, 0]}>
      <points geometry={geoA}>
        <pointsMaterial
          ref={matA}
          map={tex}
          size={1.15}
          sizeAttenuation
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0}
        />
      </points>
      <points geometry={geoB}>
        <pointsMaterial
          ref={matB}
          map={tex}
          size={0.85}
          sizeAttenuation
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0}
        />
      </points>
    </group>
  );
}

// Night shore glow (loop iteration 14) — faint cyan sparkles dotted
// along the waterline after dark, a bioluminescent plankton wash. Same
// point-cloud trick as SeaGlints; positions ride the organic coast.
function NightShoreGlow({ phase }: { phase: Phase }) {
  const mat = useRef<THREE.PointsMaterial | null>(null);
  const [geo, tex] = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const N = 22;
    const pos = new Float32Array(N * 3);
    let s = 4211;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < N; i++) {
      const a = rnd() * Math.PI * 2;
      const ux = Math.cos(a);
      const uz = Math.sin(a);
      // parked just past the waterline (coast-space 51.7..52.6)
      const r = 51.7 + rnd() * 0.9 + coastWobbleJS(ux, uz);
      pos[i * 3] = ux * r;
      pos[i * 3 + 1] = 0.04;
      pos[i * 3 + 2] = uz * r;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const t = new THREE.TextureLoader().load(GLINT_URL);
    t.colorSpace = THREE.SRGBColorSpace;
    return [g, t];
  }, []);
  useEffect(
    () => () => {
      geo.dispose();
      tex.dispose();
    },
    [geo, tex]
  );
  useFrame(({ clock }) => {
    if (!mat.current) return;
    const base = phase === "night" ? 0.5 : phase === "dusk" ? 0.16 : 0;
    mat.current.opacity = base * (0.55 + 0.45 * Math.sin(clock.elapsedTime * 1.7));
  });
  return (
    <points geometry={geo} position={[0, OCEAN_Y + 0.03, 0]}>
      <pointsMaterial
        ref={mat}
        map={tex}
        color="#7FE8D8"
        size={0.5}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0}
      />
    </points>
  );
}

export default function Ocean({ phase }: { phase: Phase }) {
  const timeUniform = useRef({ value: 0 });
  // Live uniform refs so the frame loop can lerp toward the phase palette.
  const deepRef = useRef(new THREE.Color(SEA_PALETTE.day[0]));
  const shallowRef = useRef(new THREE.Color(SEA_PALETTE.day[1]));
  const foamRef = useRef(new THREE.Color(SEA_PALETTE.day[2]));
  // Moon glint path (loop iteration 11): 1 at night, a whisper at dusk.
  const nightRef = useRef({ value: 0 });
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
      shader.uniforms.uCaustic = { value: getCausticTexture() };
      shader.uniforms.uNight = nightRef.current;

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
uniform float uNight;
uniform sampler2D uCaustic;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
varying vec2 vOceanXZ;
${COAST_GLSL}`
      ).replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  // Distance to the ORGANIC shoreline (coast.ts harmonics): 0 at the
  // waterline, so the foam band hugs every lobe and bay.
  float shore = length(vOceanXZ) - (${SHORE_RADIUS.toFixed(1)} + coastWobble(vOceanXZ));

  // Depth ramp: shallow near shore -> deep water outward.
  float depthT = smoothstep(0.0, 14.0, shore);
  vec3 water = mix(uShallow, uDeep, depthT);

  // Sparkle: two crossed scrolling waves, product sharpened.
  float w1 = sin(vOceanXZ.x * 0.55 + uTime * 0.9) * sin(vOceanXZ.y * 0.5 - uTime * 0.7);
  float w2 = sin((vOceanXZ.x + vOceanXZ.y) * 0.32 + uTime * 0.5);
  float sparkle = pow(max(w1 * w2, 0.0), 3.0) * 0.35;

  // Moonlight path (iteration 11): at night the sparkle brightens inside
  // a wedge toward the eastern horizon (the moon rises opposite the
  // sunset), so the sea carries a shimmering moon-glint lane.
  float moonBand = exp(-abs(1.0 - dot(normalize(vOceanXZ), vec2(0.966, 0.259))) * 7.0);
  sparkle *= 1.0 + uNight * moonBand * 2.6;
  sparkle += uNight * moonBand * pow(max(w2, 0.0), 2.0) * 0.10;

  // ACNH caustic patches (P2 polish 2026-07-13): the real water-model mask
  // from the dump, two drifting copies, min() -> soft light cells that
  // fade toward the horizon. Harness-tuned to the mask's 0..0.69 range.
  float c1 = texture2D(uCaustic, vOceanXZ * 0.055 + uTime * vec2(0.012, 0.008)).r;
  float c2 = texture2D(uCaustic, vOceanXZ * 0.089 - uTime * vec2(0.009, 0.013)).r;
  float web = smoothstep(0.24, 0.60, min(c1, c2)) * 0.8;
  web *= mix(1.0, 0.2, depthT);

  // Shore foam: a lapping band just outside the island, edge animated by a
  // travelling sine so the line breathes like ACNH's beach waves.
  float lap = sin(vOceanXZ.x * 0.9 + vOceanXZ.y * 0.7 + uTime * 1.4) * 0.5;
  float foamEdge = ${FOAM_BAND.toFixed(1)} + lap;
  float foam = 1.0 - smoothstep(0.35, foamEdge, shore);
  foam *= step(0.0, shore); // nothing under the island itself

  vec3 col = mix(water + sparkle, uFoam, clamp(web, 0.0, 1.0));
  diffuseColor.rgb = mix(col, uFoam, clamp(foam, 0.0, 1.0));
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
    const nightTarget = phaseRef.current === "night" ? 1 : phaseRef.current === "dusk" ? 0.3 : 0;
    nightRef.current.value += (nightTarget - nightRef.current.value) * k;
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
      <SeaGlints phase={phase} />
      <NightShoreGlow phase={phase} />
    </group>
  );
}
