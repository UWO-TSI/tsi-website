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
import { COAST_GLSL, coastWobble as coastWobbleJS, COAST_SCALE } from "@/lib/game/coast";
import {
  applyWaterShader,
  waterUniforms,
  writeWaterUniforms,
  type WaterParams,
} from "@/lib/game/waterShader";

const OCEAN_SIZE = 400;
const OCEAN_Y = -0.55;
const SHORE_RADIUS = 51.4; // where the sunken beach ring crosses OCEAN_Y
const FOAM_BAND = 2.6; // how far the shore foam reaches out from the island

// V5: sea palette per time-of-day. [deep, shallow, foam]. Day = bright azure,
// dusk = warm violet, night = deep navy, dawn = soft peach-blue.
type Phase = "dawn" | "day" | "dusk" | "night";
// AC-reference calibration (specs/references/acnh): the sea in the
// snapshots is a muted steel-teal, not vivid azure — day palette pulled
// toward the reference chroma; foam goes cream, not white.
//
// DAY REPLACED 2026-07-29 with the palette sampled off David's own references
// (images 12 and 13): #3098B3 deep, #CADCBC shallow, #FAFCEB foam. The old day
// row was calibrated against an ACNH capture he has since rejected as "wrong".
// dawn / dusk / night are untouched — no reference was supplied for them and
// they are already tuned.
const SEA_PALETTE: Record<Phase, [string, string, string]> = {
  dawn: ["#5E86C4", "#9FC0D8", "#F2E4D8"],
  day: ["#3098B3", "#CADCBC", "#FAFCEB"],
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
      const r = (51.7 + rnd() * 0.9 + coastWobbleJS(ux, uz)) * COAST_SCALE;
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

/**
 * Distance to the ORGANIC shoreline (coast.ts harmonics), 0 at the waterline,
 * so foam and shallows hug every lobe and bay.
 *
 * The grid reads a baked field instead; the sea cannot yet, because the DEFAULT
 * terrain is still the old heightfield and its coastline is these harmonics,
 * not the map's. When `?grid=1` becomes the default this is replaced by
 * SHORE_FROM_FIELD and the harmonics go with the old terrain.
 *
 * TILE is 1.0, so a world unit and a cell are the same number here.
 */
const SHORE_FROM_COAST = /* glsl */ `
${COAST_GLSL}
float shoreDistance(vec2 xz) {
  float main = length(xz) - (${SHORE_RADIUS.toFixed(1)} + coastWobble(xz)) * COAST_SCALE;
  // S5 Isla Chica: the islet's skirt crosses the ocean surface at r~7.4 —
  // min() folds it into the same field, so the islet gets foam and shallows
  // exactly like the mainland.
  float islet = length(xz - vec2(-24.0, 72.0)) - 7.4;
  return min(main, islet);
}
`;

/**
 * The two sea layers that predate the shared shader and are worth keeping.
 *
 * CAUSTICS — the real `water-model` mask from the dump, two drifting copies,
 * min() into soft light cells that fade with depth. Harness-tuned to the mask's
 * 0..0.69 range in 2026-07-13's polish pass.
 *
 * MOON PATH — at night the eastern horizon carries a shimmering lane, because
 * the moon rises opposite the sunset. The sun glint in the shared shader dies
 * on its own after dark (uSunDir drops below the horizon), so this is what
 * replaces it rather than something competing with it.
 */
const SEA_EXTRA = /* glsl */ `
uniform sampler2D uCaustic;
uniform float uNight;
vec3 waterExtra(vec3 col, float t, vec2 xz) {
  float c1 = texture2D(uCaustic, xz * 0.055 + uTime * vec2(0.012, 0.008)).r;
  float c2 = texture2D(uCaustic, xz * 0.089 - uTime * vec2(0.009, 0.013)).r;
  float web = smoothstep(0.24, 0.60, min(c1, c2)) * 0.8 * mix(1.0, 0.2, t);
  col = mix(col, uFoamColor, clamp(web, 0.0, 1.0));
  float moon = exp(-abs(1.0 - dot(normalize(xz), vec2(0.966, 0.259))) * 7.0);
  float w = sin((xz.x + xz.y) * 0.32 + uTime * 0.5);
  col += vec3(0.72, 0.80, 1.00) * uNight * moon * pow(max(w, 0.0), 2.0) * 0.16;
  return col;
}
`;

/** What the bed would be if there were one. Only used to derive the ramp's last stop. */
const SAND = new THREE.Color("#EAE1C3");

/**
 * The sea's half of "one shader, split parameters" (David, 2026-07-29).
 *
 * Everything the river tunes in cells over a channel, the sea tunes in tens of
 * cells over open water: it shelves for 18 cells rather than 3.5, and the blobs
 * are three times the size or they read as noise at this scale. The swell is
 * long and low because the plane is 400 units across 48 segments — a 7-unit
 * wavelength would alias into a moiré.
 *
 * Colours are overwritten every frame from SEA_PALETTE, so the ones here only
 * matter for the first frame. NOT on the bench yet.
 */
const SEA_PARAMS: WaterParams = {
  deepColor: 0x3098b3,
  midColor: 0x45b6c4,
  shallowColor: 0xcadcbc,
  bedColor: 0xeae1c3,
  foamColor: 0xfafceb,
  ringColor: 0xfafceb,
  depthFalloff: 3.2,
  bedDepth: 6,
  bedSlope: 18,
  foamWidth: FOAM_BAND,
  foamStrength: 0.95,
  foamSoft: 0.25,
  // The sea's own lapping band, from before the shared shader: 0.5 cells of
  // swash at 1.4 rad/s, which is what the beach foam used to breathe at.
  foamWave: 0.5,
  foamWaveSpeed: 1.4,
  blobScale: 9,
  blobDarken: 0.9,
  blobSpeed: 0.25,
  ringWidth: 0.05,
  ringStrength: 0.3,
  shoreAlpha: 1,
  opacity: 1,
  fresnel: 0.12,
  glare: 1.5,
  glareWidth: 26,
  sunGlint: 6.5,
  sunSharp: 230,
  sparkle: 0.7,
  sparkleSpeed: 1.4,
  waveHeight: 0.06,
  waveScale: 34,
  waveSpeed: 0.5,
};

/**
 * Module scope, not a hook, and deliberately so.
 *
 * A uniform block exists to be written every frame. React's compiler lint
 * rejects mutating anything a hook returned OR reading a ref during render, and
 * the block has to be reachable from both `onBeforeCompile` and the frame loop.
 * `terrainMaterials.ts` holds the river's block the same way for the same
 * reason. There is one Ocean, so there is one block; a remount would reuse it,
 * which is harmless because every value is overwritten on the next frame.
 */
const SEA_UNIFORMS = {
  ...waterUniforms(SEA_PARAMS),
  uCaustic: { value: null as THREE.Texture | null },
  uNight: { value: 0 },
};

export default function Ocean({ phase }: { phase: Phase }) {
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
    applyWaterShader(mat, () => SEA_UNIFORMS, {
      shore: SHORE_FROM_COAST,
      extra: SEA_EXTRA,
      // No bed out here. Transparency would reveal the fog, not sand.
      transparent: false,
    });
    return mat;
  }, []);

  useEffect(() => () => material.dispose(), [material]);

  // Built on first mount rather than at module scope: the caustic mask is drawn
  // on a canvas, and this module is imported before there is a document.
  useEffect(() => {
    SEA_UNIFORMS.uCaustic.value = getCausticTexture();
  }, []);

  const _tgt = useMemo(() => new THREE.Color(), []);
  const _params = useRef({ ...SEA_PARAMS });
  // The key light, found by traversal rather than duplicated from GameWorld's
  // sun arc. Same move GridWorld makes, and for the same reason: one source of
  // truth, so the glare stays correct if that arc changes.
  const sunDir = useRef(new THREE.Vector3(0, 1, 0));
  useFrame((state, delta) => {
    let key: THREE.DirectionalLight | null = null;
    state.scene.traverse((o) => {
      const l = o as THREE.DirectionalLight;
      if (!key && l.isDirectionalLight && l.intensity > 0.5) key = l;
    });
    if (key) sunDir.current.copy((key as THREE.DirectionalLight).position).normalize();

    // V5: ease the sea palette toward the current phase (~1.5s to settle).
    const pal = SEA_PALETTE[phaseRef.current];
    const k = 1 - Math.exp(-delta / 0.5);
    deepRef.current.lerp(_tgt.set(pal[0]), k);
    shallowRef.current.lerp(_tgt.set(pal[1]), k);
    foamRef.current.lerp(_tgt.set(pal[2]), k);
    // Moon glint path (loop iteration 11): 1 at night, a whisper at dusk.
    const nightTarget = phaseRef.current === "night" ? 1 : phaseRef.current === "dusk" ? 0.3 : 0;
    const night = SEA_UNIFORMS.uNight;
    night.value += (nightTarget - night.value) * k;

    // The phase table carries three colours; the ramp wants five. Rather than
    // author twenty and throw away work that is already calibrated against the
    // ACNH captures, the two new stops are DERIVED: mid sits between deep and
    // shallow, and the bed is the shallow colour dragged most of the way to
    // sand. Day is David's reference palette, so it is exact where it matters.
    _params.current.deepColor = deepRef.current.getHex();
    _params.current.shallowColor = shallowRef.current.getHex();
    _params.current.foamColor = foamRef.current.getHex();
    _params.current.midColor = _tgt.copy(deepRef.current).lerp(shallowRef.current, 0.55).getHex();
    _params.current.bedColor = _tgt.copy(shallowRef.current).lerp(SAND, 0.7).getHex();
    _params.current.ringColor = _params.current.foamColor;
    writeWaterUniforms(SEA_UNIFORMS, _params.current);
    SEA_UNIFORMS.uTime.value = state.clock.elapsedTime;
    SEA_UNIFORMS.uSunDir.value.copy(sunDir.current);
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
