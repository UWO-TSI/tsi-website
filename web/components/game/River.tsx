"use client";

/**
 * ⚠️ WORLD MODEL NOTICE (David ruling 2026-07-26) — the river is a SPLINE here
 * and ACNH's is a TILE CHAIN. Read `specs/acnh-system-reference.md` before
 * editing. Three problems, all structural:
 *
 * 1. THREE CONFLICTING DATUMS. The ACNH kit puts ground at 0, the water
 *    surface at -0.078u and the bed walls down to -1.125u (measured from
 *    River0A_0: Grass__mGrass y[-0.78, 0], RiverAC__mRiver y[-11.25, -0.78],
 *    raw). terrain.ts carves the channel to -0.95u. This file floats water at
 *    WATER_Y = -0.32u. The water therefore sits 0.63u above the carved floor
 *    and 0.24u below where the kit's grass fringe expects it. RiverBanks.tsx
 *    and RiverBankWalls.tsx exist only to paper that gap, which is why the
 *    banks read as applied decoration instead of as the edge of the water.
 *
 * 2. THE CORRECT KIT IS ON DISK AND UNUSED. `public/assets/acnh/river/*.glb`
 *    holds 12 extracted autotile pieces. grep across components/, lib/ and
 *    app/ returns ZERO references. The full kit is 45 pieces in
 *    `FldUnitRiver` and it shares the class/variant/rotation vocabulary with
 *    the cliff and road kits. The four extracted bank-*.glb pieces are also
 *    missing their own ground surface (mesh index 0 was dropped at export —
 *    see scripts/organize-dump.mjs).
 *
 * 3. NO GRADIENT, SO NO REAL FLOW. RIVER_DEPTH is constant across the whole
 *    island, so the river is a level channel coast to coast and motion is a
 *    scrolling texture over flat geometry. ACNH's river descends through
 *    waterfall pieces at level boundaries; the 47-piece FldUnitFall kit is not
 *    extracted at all. Flow direction should be a property of the level map,
 *    not a shader uniform.
 *
 * Target replacement: river becomes a `surface` cell type on the tile grid at
 * the kit's own datum, with Fall pieces emitted wherever a river cell borders
 * a lower level. That deletes WATER_Y, RIVER_DEPTH, RiverBanks and
 * RiverBankWalls.
 *
 * ── Original header ──────────────────────────────────────────────
 *
 * Curved river mesh with animated procedural flow.
 *
 * Sprint A3 (2026-05-21). Replaces the previous straight 80×3 plane water
 * surface in GameWorld.tsx with a Catmull-Rom spline ribbon (same approach
 * as Path.tsx) plus an onBeforeCompile shader patch that scrolls procedural
 * waves along the ribbon's length. Spec:
 * sprint-2026-05-game-look-feel.md §A3 + ux-game-world-v2.md §5.
 *
 * Geometry: 96 length-segments × 5 cross-rows of vertices laid out along the
 * spline. UVs are baked into the position attribute as a custom `riverUv`
 * vec2 — u is the cross-axis 0→1, v is the cumulative arc length so flow
 * tiles naturally regardless of bend density.
 *
 * Material: MeshBasicMaterial patched via onBeforeCompile. The fragment
 * shader generates two scrolling sine waves whose product becomes a foam
 * highlight, blended into a deep→shallow color ramp. A `time` uniform is
 * ticked from useFrame. Transparency = 0.78, depthWrite false so terrain
 * shows through subtly.
 *
 * Exports `RIVER_CONTROL_POINTS` + `sampleRiverPoint(t)` so the bridge in
 * GameWorld can sit on the spline at the right tangent / height.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getCausticTexture } from "@/lib/game/causticTexture";
import { riverWidthScale } from "./terrain";

/** Control points for the river spline. East-west run with gentle bends. */
export const RIVER_CONTROL_POINTS: [number, number][] = [
  // GEO S1: endpoints pushed to the new coast; interior bends unchanged
  // so the bridge/spots/stones keep their exact geometry.
  [-61, 2], [-40, 4], [-30, 5], [-12, 5], [-3, 1], [5, 4], [16, 2], [30, 4], [45, 3.5], [61, 3],
];

/** Default river width — slightly wider than paths (2.8) to feel substantial. */
const RIVER_WIDTH = 3.8;
const ROWS = 5; // 5 rows: 2 banks + 3 inner — denser cross-section than Path
const SEGMENTS = 144; // river v3: denser sampling keeps the narrows/pool edges smooth

/** Y offset of the water surface relative to the terrain baseline (y=0). */
// River v2 (2026-07-14): water dropped so the new bank walls
// (RiverBankWalls) get real ACNH presence above the surface.
const WATER_Y = -0.32; // V1: water sits deeper in the carved channel

const _curve = new THREE.CatmullRomCurve3(
  RIVER_CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  "catmullrom",
  0.5,
);

/**
 * Sample the river spline at parameter t∈[0,1]. Returns world-space center
 * point and unit tangent (XZ). Bridge in GameWorld.tsx uses this to align.
 */
export function sampleRiverPoint(t: number): { position: THREE.Vector3; tangent: THREE.Vector3 } {
  const position = _curve.getPoint(t).clone();
  position.y = WATER_Y;
  const tangent = _curve.getTangent(t).clone();
  tangent.y = 0;
  tangent.normalize();
  return { position, tangent };
}

/**
 * Find t∈[0,1] where the spline's X coordinate is closest to targetX.
 * Brute force: 200 samples is plenty for our 6-point spline.
 */
export function findRiverTForX(targetX: number): number {
  let bestT = 0;
  let bestDist = Infinity;
  for (let i = 0; i <= 200; i++) {
    const t = i / 200;
    const p = _curve.getPoint(t);
    const d = Math.abs(p.x - targetX);
    if (d < bestDist) {
      bestDist = d;
      bestT = t;
    }
  }
  return bestT;
}

interface RiverProps {
  /** Total ribbon width (cross-axis). Default 3.8 — wider than dirt paths. */
  width?: number;
  /** Number of length samples along the spline. More = smoother bends. */
  segments?: number;
  /** Deep water color (RGB). Used in the wave gradient. */
  deepColor?: string;
  /** Shallow / highlight water color (RGB). Blended on wave crests. */
  shallowColor?: string;
  /** Overall surface alpha. */
  opacity?: number;
  /** V6: time-of-day phase; eases water color to match the sea. */
  phase?: RiverPhase;
}

const DEFAULT_DEEP = "#3A6EA5";    // deeper blue, matches existing P.riverDeep tone
const DEFAULT_SHALLOW = "#A8D8E8"; // light blue foam highlight

// V6: river palette per time-of-day [deep, shallow], mirroring Ocean's SEA
// palette so the water bodies read as one at dusk/night instead of the river
// staying day-blue.
type RiverPhase = "dawn" | "day" | "dusk" | "night";
const RIVER_PALETTE: Record<RiverPhase, [string, string]> = {
  dawn: ["#5378B0", "#C4D8E8"],
  day: ["#3A6EA5", "#A8D8E8"],
  dusk: ["#54507E", "#C0A8C4"],
  night: ["#22305A", "#5A6E9C"],
};

export default function River({
  width = RIVER_WIDTH,
  segments = SEGMENTS,
  deepColor = DEFAULT_DEEP,
  shallowColor = DEFAULT_SHALLOW,
  opacity = 0.78,
  phase = "day",
}: RiverProps = {}) {
  const phaseRef = useRef<RiverPhase>(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const _riverTgt = useMemo(() => new THREE.Color(), []);
  // Build geometry: ribbon along spline. Each vertex carries a riverUv (u,v)
  // attribute: u = 0..1 across width, v = cumulative arc length / total length.
  const geometry = useMemo(() => {
    const points3 = RIVER_CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(points3, false, "catmullrom", 0.5);

    const sampleCount = segments + 1;
    const positions = new Float32Array(sampleCount * ROWS * 3);
    const uvs = new Float32Array(sampleCount * ROWS * 2);
    const indices: number[] = [];

    // First pass: compute cumulative arc length so v scales by distance.
    const centerPoints: THREE.Vector3[] = [];
    let totalLength = 0;
    const cumLengths: number[] = [0];
    for (let i = 0; i < sampleCount; i++) {
      const t = i / segments;
      const p = curve.getPoint(t);
      centerPoints.push(p);
      if (i > 0) {
        totalLength += p.distanceTo(centerPoints[i - 1]);
        cumLengths.push(totalLength);
      }
    }

    for (let i = 0; i < sampleCount; i++) {
      const t = i / segments;
      const point = centerPoints[i];
      const tangent = curve.getTangent(t);
      // Perpendicular in XZ: rotate tangent 90° around Y.
      const px = -tangent.z;
      const pz = tangent.x;
      const plen = Math.hypot(px, pz) || 1;
      const nx = px / plen;
      const nz = pz / plen;

      const v = cumLengths[i] / Math.max(totalLength, 0.0001);

      const wScale = riverWidthScale(point.x);
      for (let r = 0; r < ROWS; r++) {
        const u = r / (ROWS - 1); // 0, 0.25, 0.5, 0.75, 1
        const offset = (u - 0.5) * width * wScale;
        const vx = point.x + nx * offset;
        const vz = point.z + nz * offset;

        const idx = i * ROWS + r;
        positions[idx * 3] = vx;
        positions[idx * 3 + 1] = WATER_Y;
        positions[idx * 3 + 2] = vz;

        uvs[idx * 2] = u;
        uvs[idx * 2 + 1] = v;
      }

      if (i > 0) {
        for (let r = 0; r < ROWS - 1; r++) {
          const a0 = (i - 1) * ROWS + r;
          const a1 = (i - 1) * ROWS + r + 1;
          const b0 = i * ROWS + r;
          const b1 = i * ROWS + r + 1;
          indices.push(a0, b0, b1);
          indices.push(a0, b1, a1);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    // Custom attribute name to avoid clobbering Three.js's built-in uv pipeline.
    geo.setAttribute("riverUv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [width, segments]);

  // Riverbed geometry — same spline, no animation, sits a hair under the water.
  // Uses the deepColor's darker companion (we just darken in-shader by reusing
  // a fixed muted brown via vertex color isn't worth the complexity; one mesh
  // with sandy brown is enough). Slightly wider than the water so the bank
  // edge is visible from above.
  const riverbedGeometry = useMemo(() => {
    const points3 = RIVER_CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(points3, false, "catmullrom", 0.5);
    const sampleCount = segments + 1;
    const positions = new Float32Array(sampleCount * 3 * 3); // 3 rows: left bank, center, right bank
    const indices: number[] = [];
    const bedWidth = width * 1.25;

    for (let i = 0; i < sampleCount; i++) {
      const t = i / segments;
      const point = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      const px = -tangent.z;
      const pz = tangent.x;
      const plen = Math.hypot(px, pz) || 1;
      const nx = px / plen;
      const nz = pz / plen;

      const wScale = riverWidthScale(point.x);
      for (let r = 0; r < 3; r++) {
        const u = r / 2;
        const offset = (u - 0.5) * bedWidth * wScale;
        const idx = i * 3 + r;
        positions[idx * 3] = point.x + nx * offset;
        positions[idx * 3 + 1] = WATER_Y - 0.08;
        positions[idx * 3 + 2] = point.z + nz * offset;
      }

      if (i > 0) {
        for (let r = 0; r < 2; r++) {
          const a0 = (i - 1) * 3 + r;
          const a1 = (i - 1) * 3 + r + 1;
          const b0 = i * 3 + r;
          const b1 = i * 3 + r + 1;
          indices.push(a0, b0, b1);
          indices.push(a0, b1, a1);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [width, segments]);

  // Material: MeshBasicMaterial + onBeforeCompile shader patch. Uniforms:
  //   time     — incremented each frame
  //   deep     — deep water color
  //   shallow  — wave crest highlight color
  // The patched fragment shader generates two scrolling sine waves, multiplies
  // them into a sharp foam highlight (pow ^4), and blends into a deep→shallow
  // gradient. Output alpha set to opacity uniform.
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const uniforms = {
      time: { value: 0 },
      deep: { value: new THREE.Color(deepColor) },
      shallow: { value: new THREE.Color(shallowColor) },
      surfaceAlpha: { value: opacity },
    };

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.time = uniforms.time;
      shader.uniforms.deep = uniforms.deep;
      shader.uniforms.shallow = uniforms.shallow;
      shader.uniforms.surfaceAlpha = uniforms.surfaceAlpha;
      shader.uniforms.uCaustic = { value: getCausticTexture() };

      shader.vertexShader = shader.vertexShader
        .replace(
          "void main() {",
          "attribute vec2 riverUv;\nvarying vec2 vRiverUv;\nvoid main() {\n  vRiverUv = riverUv;",
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "void main() {",
          [
            "uniform float time;",
            "uniform sampler2D uCaustic;",
            "uniform vec3 deep;",
            "uniform vec3 shallow;",
            "uniform float surfaceAlpha;",
            "varying vec2 vRiverUv;",
            "void main() {",
          ].join("\n"),
        )
        .replace(
          "#include <color_fragment>",
          [
            "#include <color_fragment>",
            // P2 polish 2026-07-13: ACNH caustic cells drifting downstream,
            // layered under the existing waves + chevron.
            "float caust = texture2D(uCaustic, vec2(vRiverUv.x * 1.4, vRiverUv.y * 10.0 - time * 0.055)).r;",
            "float caust2 = texture2D(uCaustic, vec2(vRiverUv.x * 2.2 + 0.37, vRiverUv.y * 16.0 - time * 0.085)).r;",
            "float cells = smoothstep(0.26, 0.58, min(caust, caust2)) * 0.5;",
            // Tile density: 8 across width, ~28 along length. v already scales
            // with arc length so flow density is consistent through bends.
            "vec2 flowUv = vRiverUv * vec2(8.0, 28.0);",
            // Two waves drifting in the flow direction (v axis, "downstream").
            "flowUv.y += time * 0.08;",
            "float wave1 = sin(flowUv.x * 3.0 + flowUv.y * 2.0) * 0.5 + 0.5;",
            "float wave2 = sin(flowUv.x * 5.0 - flowUv.y * 3.5 + 1.0) * 0.5 + 0.5;",
            "float highlight = pow(wave1 * wave2, 4.0);",
            // Edge falloff so bank rows fade into the water instead of a hard line.
            "float edge = smoothstep(0.0, 0.18, vRiverUv.x) * smoothstep(0.0, 0.18, 1.0 - vRiverUv.x);",
            // P21: chevron arrow pattern indicating flow direction. The phase
            // is a V-shape (`abs(x - 0.5) * 2`) that scrolls along v
            // (downstream). The crisp band gives the eye a clear cue that
            // water moves east→west, not just shimmers in place.
            "float chevX = abs(vRiverUv.x - 0.5) * 2.0;",
            "float chevPhase = vRiverUv.y * 6.0 - time * 0.10 + chevX * 0.8;",
            "float chevSaw = abs(fract(chevPhase) - 0.5) * 2.0;",
            "float chevron = smoothstep(0.38, 0.32, chevSaw) * (1.0 - chevX) * 0.55;",
            // Color mix: deep base + wave-modulated shallow tone + crest highlight + arrow.
            "vec3 water = mix(deep, shallow, wave1 * 0.35);",
            "water = mix(water, vec3(0.92, 0.98, 1.0), cells);",
            "water += highlight * 0.35;",
            "water = mix(water, shallow, chevron);",
            "diffuseColor.rgb = water;",
            "diffuseColor.a = surfaceAlpha * edge;",
          ].join("\n"),
        );
    };

    // Stash uniforms on the material so the React component can tick `time`
    // without needing the shader handle (which is created lazily on compile).
    (mat as THREE.MeshBasicMaterial & { userData: { uniforms: typeof uniforms } }).userData.uniforms = uniforms;

    return mat;
  }, [deepColor, shallowColor, opacity]);

  const materialRef = useRef(material);

  // P4 memory: dispose River's BufferGeometries + Material on unmount.
  useEffect(() => {
    return () => {
      geometry.dispose();
      riverbedGeometry.dispose();
      material.dispose();
    };
  }, [geometry, riverbedGeometry, material]);

  useFrame((_, delta) => {
    const mat = materialRef.current as THREE.MeshBasicMaterial & {
      userData: { uniforms: { time: { value: number } } };
    };
    const u = (mat.userData as { uniforms?: { time: { value: number }; deep: { value: THREE.Color }; shallow: { value: THREE.Color } } }).uniforms;
    if (u?.time) {
      u.time.value += delta;
      // V6: ease water color toward the current phase (~0.5s constant).
      const pal = RIVER_PALETTE[phaseRef.current];
      const k = 1 - Math.exp(-delta / 0.5);
      u.deep.value.lerp(_riverTgt.set(pal[0]), k);
      u.shallow.value.lerp(_riverTgt.set(pal[1]), k);
    }
  });

  return (
    <group>
      {/* Riverbed — sandy brown plane following the spline, slightly wider. */}
      <mesh geometry={riverbedGeometry} receiveShadow>
        <meshStandardMaterial
          color="#A08B65"
          roughness={0.95}
          metalness={0}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      {/* Animated water surface — patched MeshBasicMaterial. */}
      <mesh geometry={geometry} material={material} />
    </group>
  );
}
