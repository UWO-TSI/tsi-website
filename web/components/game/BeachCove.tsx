"use client";

/**
 * BeachCove (2026-07-14) — the south-east shore destination, built from
 * the water/land dump sweep (specs/asset-flags.md):
 *
 *   - palms (Plants/palm-tree 3+4, LUT textures normalized + tinted)
 *   - hibiscus bushes at the spur end
 *   - parasol + towel + beach ball camp on the dry sand band
 *   - the 5 classic ACNH rocks: NE grass field cluster + sand strays
 *   - shallow-water outcrops poking through the swell past the rim
 *   - rope fence lining the sand path (Fences/rope-fence)
 *
 * The sand path + wood deck themselves are RoadTiles zones; corridors
 * live in terrain.ts PATH_CORRIDORS. Everything here is static — no
 * useFrame. Rocks/fences skip the shadow pass (ground-hugging).
 *
 * Also hosts the other dump-sweep flora: the bamboo grove behind the
 * Oracle temple (Plants/bamboo 3+4, same LUT-normalize treatment).
 */

import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import InstancedGLB, { type NaturePlacement } from "./InstancedNature";
import { GLBProp } from "./NatureModels";
import { getTerrainHeight } from "./terrain";
import { coastDist, coastWobble, rimSink } from "@/lib/game/coast";

const PALM_A = "/assets/acnh/plants/tree-palm-a.glb";
const PALM_B = "/assets/acnh/plants/tree-palm-b.glb";
const BAMBOO_A = "/assets/acnh/plants/tree-bamboo-a.glb";
const BAMBOO_B = "/assets/acnh/plants/tree-bamboo-b.glb";
const HIBISCUS = "/assets/acnh/plants/bush-hibiscus.glb";
const ROCKS = ["a", "b", "c", "d", "e"].map((k) => `/assets/acnh/props/rock-${k}.glb`);
const SHELLS = ["scallop", "turban", "whelk", "asari"].map(
  (k) => `/assets/acnh/props/shell-${k}.glb`
);
const FENCE_A = "/assets/acnh/props/fence-rope-a.glb";
const FENCE_I = "/assets/acnh/props/fence-rope-i.glb";
const PARASOL = "/assets/acnh/props/beach-parasol.glb";
const TOWEL = "/assets/acnh/props/beach-towel.glb";
const BALL = "/assets/acnh/props/beach-ball.glb";
const BED = "/assets/acnh/props/beach-bed.glb";
[PALM_A, PALM_B, BAMBOO_A, BAMBOO_B, HIBISCUS, ...ROCKS, ...SHELLS, FENCE_A, FENCE_I, PARASOL, TOWEL, BALL, BED].forEach(
  (u) => useGLTF.preload(u)
);

// Visible ground = terrain height minus the beach rim sink, both in
// coast-space (lib/game/coast.ts owns the profile).
function groundY(x: number, z: number): number {
  return getTerrainHeight(x, z) - rimSink(coastDist(x, z));
}

// Palms hug the beach band (dist ~48-49.5) — cove cluster + far accents.
// Coast v2 (bay + headlands): palms frame the cove from the two headland
// arms + one on the inner-bay sand. All coords from coast_solver.py.
const PALM_A_XZ: [number, number, number, number][] = [
  [37.8, 40.3, 0.4, 1.0],   // east headland tip
  [3.7, 49.8, 2.1, 0.95],   // west headland
  [11.4, 46.0, 1.2, 0.9],   // inner-bay sand
  [38.2, -18.9, 5.2, 0.95], // NE sweep accent
  [-18.1, 40.4, 1.0, 1.0],  // west beach accent
];
const PALM_B_XZ: [number, number, number, number][] = [
  [40.3, 35.4, 3.6, 1.05],  // east headland pair
  [24.5, 41.5, 2.9, 0.9],   // spur-side
  [-44.8, 20.1, 2.7, 0.95],
];

// Exported so GameWorld's blob-shadow builder can ground the palms too.
export const BEACH_PALM_XZ: [number, number][] = [...PALM_A_XZ, ...PALM_B_XZ].map(
  ([x, z]) => [x, z]
);

const HIBISCUS_XZ: [number, number, number][] = [
  [14.6, 43.3, 0.9],
  [21.7, 40.9, 3.8],
  [11.9, 45.2, 1.7],
];

// Bamboo grove arcing behind the Oracle temple (footprint 0,31.8 r4.5;
// entrance faces north — the grove backs the south side).
// [x, z, rotY, scale, model 0=tall 1=short]
const BAMBOO_XZ: [number, number, number, number, number][] = [
  [-5.5, 37.2, 0.3, 1.1, 0],
  [-3.4, 38.6, 1.8, 0.95, 1],
  [-1.2, 37.0, 3.1, 1.0, 0],
  [1.4, 38.8, 0.9, 1.15, 0],
  [3.4, 37.4, 2.4, 0.9, 1],
  [5.6, 38.2, 4.2, 1.05, 0],
  [0.2, 39.7, 5.3, 0.85, 1],
];

// The classic ACNH rock cluster in the NE field + two sand strays.
// [modelIndex, x, z, rotY, scale]
const LAND_ROCKS: [number, number, number, number, number][] = [
  [0, 10, -21, 0.7, 1.0],
  [1, 11.7, -22.6, 2.1, 1.15],
  [2, 13.6, -21.2, 4.0, 0.95],
  [3, 12.2, -19.4, 1.2, 0.8],
  [4, 15.2, -22.7, 3.3, 1.25],
  [2, 23.2, 44.9, 0.5, 1.1], // sand stray by the deck
  [0, 10.6, 48.3, 2.8, 0.9], // sand stray at the waterline
];

// Shallow-water outcrops past the rim: fixed Y (the seabed has dived),
// scaled so tops poke 0.3-0.6u above the -0.55 ocean surface.
// [modelIndex, x, z, y, rotY, scale]
const SEA_ROCKS: [number, number, number, number, number, number][] = [
  [3, 53.5, -7, -1.15, 0.4, 2.0],
  [1, 54.6, -5.2, -1.0, 2.3, 1.5],
  [0, 52.8, -9.1, -0.95, 1.1, 1.2],
  [4, -33.5, 42.5, -1.2, 3.0, 2.2],
  [2, -31.8, 44.2, -0.95, 0.8, 1.4],
  [1, -11, -53.5, -1.1, 1.9, 1.8],
  [3, -8.8, -54.8, -0.95, 4.2, 1.3],
];

// Rope fence along the west edge of the sand path (posts follow terrain).
const FENCE_X = 16.35;
const FENCE_Z0 = 27.2;
const FENCE_COUNT = 11;

// Rocky banks (iteration 4): where beachWidthShift squeezes the sand
// away (θ≈2.48 west bank, θ≈5.62 by the lighthouse), clusters of rocks
// sit half-in-half-out of the water — grassy-bank shorelines read
// rugged instead of bare. [angleRad, coastDistE, modelIndex, rotY, scale]
const BANK_ROCK_SPOTS: [number, number, number, number, number][] = [
  [2.44, 50.4, 1, 0.7, 1.5],
  [2.48, 50.9, 4, 2.2, 1.9],
  [2.53, 51.3, 3, 4.1, 1.3],
  [5.58, 50.5, 4, 1.1, 1.7],
  [5.62, 51.0, 2, 3.4, 1.4],
  [5.67, 50.6, 0, 5.0, 1.2],
];

// Shells strewn on the sand band all around the island (iteration 2).
// Placed by angle in coast-space so they ride the organic beach.
// [angleRad, coastDistE, modelIndex, rotY, scale]
const SHELL_SPOTS: [number, number, number, number, number][] = [
  [0.35, 49.6, 0, 2.1, 1.1],
  [0.95, 49.1, 1, 0.4, 1.0],
  [1.35, 50.0, 3, 4.4, 1.2],
  [1.62, 49.4, 2, 1.7, 0.95],
  [2.35, 49.8, 0, 3.0, 1.25],
  [2.95, 49.2, 3, 0.9, 1.0],
  [3.65, 50.1, 1, 5.2, 1.1],
  [4.35, 49.5, 2, 2.6, 1.0],
  [4.95, 49.9, 0, 1.2, 0.9],
  [5.65, 49.3, 3, 3.8, 1.15],
];

function shellPlacements(): NaturePlacement[][] {
  const groups: NaturePlacement[][] = SHELLS.map(() => []);
  for (const [a, e, mi, rot, scale] of SHELL_SPOTS) {
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const r = e + coastWobble(ux, uz);
    const x = ux * r;
    const z = uz * r;
    groups[mi].push({ position: [x, groundY(x, z) + 0.01, z], rotation: rot, scale });
  }
  return groups;
}

// Soft foam rings where the shallow-water outcrops break the swell —
// one merged geometry, one draw call, static.
function buildFoamRings(): THREE.BufferGeometry | null {
  const geos = SEA_ROCKS.map(([, x, z, , , scale]) => {
    const inner = 0.42 * scale;
    const outer = 0.62 * scale;
    const g = new THREE.RingGeometry(inner, outer, 22);
    g.rotateX(-Math.PI / 2);
    g.translate(x, -0.52, z);
    return g;
  });
  return mergeGeometries(geos, false);
}

function buildRockPlacements(): NaturePlacement[][] {
  const groups: NaturePlacement[][] = ROCKS.map(() => []);
  for (const [mi, x, z, rot, scale] of LAND_ROCKS) {
    groups[mi].push({ position: [x, groundY(x, z), z], rotation: rot, scale });
  }
  for (const [mi, x, z, y, rot, scale] of SEA_ROCKS) {
    groups[mi].push({ position: [x, y, z], rotation: rot, scale });
  }
  for (const [a, e, mi, rot, scale] of BANK_ROCK_SPOTS) {
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const r = e + coastWobble(ux, uz);
    const x = ux * r;
    const z = uz * r;
    groups[mi].push({ position: [x, groundY(x, z), z], rotation: rot, scale });
  }
  return groups;
}

export default function BeachCove() {
  const palmsA = useMemo<NaturePlacement[]>(
    () =>
      PALM_A_XZ.map(([x, z, rot, scale]) => ({
        position: [x, groundY(x, z), z] as [number, number, number],
        rotation: rot,
        scale,
      })),
    []
  );
  const palmsB = useMemo<NaturePlacement[]>(
    () =>
      PALM_B_XZ.map(([x, z, rot, scale]) => ({
        position: [x, groundY(x, z), z] as [number, number, number],
        rotation: rot,
        scale,
      })),
    []
  );
  const rocks = useMemo(() => buildRockPlacements(), []);
  const shells = useMemo(() => shellPlacements(), []);
  const foamRings = useMemo(() => buildFoamRings(), []);
  const bamboo = useMemo<NaturePlacement[][]>(() => {
    const groups: NaturePlacement[][] = [[], []];
    for (const [x, z, rot, scale, model] of BAMBOO_XZ) {
      groups[model].push({ position: [x, getTerrainHeight(x, z), z], rotation: rot, scale });
    }
    return groups;
  }, []);
  const fence = useMemo<NaturePlacement[]>(
    () =>
      Array.from({ length: FENCE_COUNT }, (_, i) => {
        const z = FENCE_Z0 + i;
        return {
          position: [FENCE_X, groundY(FENCE_X, z), z] as [number, number, number],
          rotation: Math.PI / 2,
        };
      }),
    []
  );

  return (
    <Suspense fallback={null}>
      <group>
        <InstancedGLB url={PALM_A} placements={palmsA} />
        <InstancedGLB url={PALM_B} placements={palmsB} />
        <InstancedGLB url={BAMBOO_A} placements={bamboo[0]} />
        <InstancedGLB url={BAMBOO_B} placements={bamboo[1]} />
        <InstancedGLB
          url={HIBISCUS}
          placements={HIBISCUS_XZ.map(([x, z, rot]) => ({
            position: [x, groundY(x, z), z] as [number, number, number],
            rotation: rot,
          }))}
          castShadow={false}
        />
        {ROCKS.map((url, i) =>
          rocks[i].length ? (
            <InstancedGLB key={url} url={url} placements={rocks[i]} castShadow={false} />
          ) : null
        )}
        {SHELLS.map((url, i) =>
          shells[i].length ? (
            <InstancedGLB key={url} url={url} placements={shells[i]} castShadow={false} />
          ) : null
        )}
        {foamRings && (
          <mesh geometry={foamRings} renderOrder={2}>
            <meshBasicMaterial color="#F2FBFA" transparent opacity={0.35} depthWrite={false} />
          </mesh>
        )}
        <InstancedGLB url={FENCE_A} placements={fence} castShadow={false} />
        <GLBProp
          url={FENCE_I}
          position={[FENCE_X, groundY(FENCE_X, FENCE_Z0 - 0.6), FENCE_Z0 - 0.6]}
          rotation={[0, Math.PI / 2, 0]}
          castShadow={false}
        />
        <GLBProp
          url={FENCE_I}
          position={[FENCE_X, groundY(FENCE_X, FENCE_Z0 + FENCE_COUNT - 0.4), FENCE_Z0 + FENCE_COUNT - 0.4]}
          rotation={[0, -Math.PI / 2, 0]}
          castShadow={false}
        />
        {/* the camp — on the inner-bay sand (coast v2, solver coords) */}
        <GLBProp url={PARASOL} position={[13.6, groundY(13.6, 45.9), 45.9]} rotation={[0, 0.5, 0]} />
        <GLBProp url={TOWEL} position={[15.1, groundY(15.1, 45.5) + 0.02, 45.5]} rotation={[0, -0.35, 0]} castShadow={false} />
        <GLBProp url={BALL} position={[12.6, groundY(12.6, 47.1) + 0.02, 47.1]} castShadow={false} />
        {/* NE sweep mini-camp (iteration 13): a lone sun lounger facing
            the water — the wide beach gets its own reason to wander over */}
        <GLBProp url={BED} position={[37.7, groundY(37.7, -21.6), -21.6]} rotation={[0, 2.2, 0]} />
      </group>
    </Suspense>
  );
}
