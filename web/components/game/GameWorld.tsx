"use client";

import { Suspense, useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls, Cloud, Clouds, Html } from "@react-three/drei";
import { Smile, BookOpen } from "lucide-react";
import * as THREE from "three";
import PlayerAvatar from "./PlayerAvatar";
import Building from "./Building";
import Path from "./Path";
import River, { sampleRiverPoint, findRiverTForX } from "./River";
import { getTerrainHeight, valueNoise, BUILDING_FOOTPRINTS } from "./terrain";
import { NatureTree, NatureBush, NatureFlowerCluster, NatureFence, NatureMushroom, NatureStump } from "./NatureModels";
import AmbientProps from "./AmbientProps";
import AmbientLife from "./AmbientLife";
import AudioController from "./AudioController";
import NPCChatOverlay from "./NPCChatOverlay";
import EmoteMenu from "./EmoteMenu";
import GuestbookOverlay from "@/components/portal/GuestbookOverlay";
import NPC from "./NPC";
import GhostReplay from "./GhostReplay";
import { useUser } from "@/components/portal/UserContext";
import { useActivePalette, useNPCPersonas } from "@/lib/game/contentLoader";
import { usePositionHeartbeat } from "@/lib/game/usePositionHeartbeat";
import { useGhostPositions } from "@/lib/game/useGhostPositions";
import { useGhostReplaySetting } from "@/lib/game/useGhostReplaySetting";
import type { EmoteType, NPCPersona, SpawnZone } from "@/lib/game/contentTypes";

/**
 * Game World v2 — Animal Crossing: New Horizons visual style.
 * Implements specs/ux-game-world-v2.md EXACTLY.
 *
 * Palette, camera, lighting, terrain, river, bridge, trees, bushes,
 * flowers, props all sourced from the v2 spec hex values.
 */

// ─── Palette from v2 spec Section 3 ────────────────────────────
const P = {
  skyTop: "#87CEEB", skyBottom: "#B8E4F0",
  grassPrimary: "#7EC850", grassSecondary: "#6BB83E", grassHighlight: "#9ADE6B", grassShadow: "#5AA033",
  dirtPath: "#C4A265", dirtPathEdge: "#B39355", stonePath: "#B8B0A0",
  riverSurface: "#5BB8D4", riverDeep: "#3A8FB0", riverEdge: "#7CCCE5", riverbed: "#A08B65",
  pondSurface: "#6DC4D8",
  trunk: "#8B6B4A", barkDetail: "#6B5238",
  foliage: "#4DAF4A", foliageHighlight: "#6BC867", foliageShadow: "#3A8838",
  pine: "#3D7A3D", bush: "#5CB85C", bushFlower: "#FF6B8A",
  flowerRed: "#E85050", flowerPink: "#FF8CB0", flowerYellow: "#FFD166",
  flowerWhite: "#F5F5F5", flowerBlue: "#6BA3D6", flowerPurple: "#9B6BB0", flowerOrange: "#FF9944",
  fence: "#B8935A", stoneFence: "#A8A090", lampPost: "#3D3D3D", lampGlow: "#FFE4B0",
  benchWood: "#B8935A", bridgeWood: "#A07850", bridgeRope: "#C4B090",
  wellStone: "#9B9080", stumpBrown: "#8B6B4A",
  windowGlass: "#B8E4F0", windowFrame: "#FFFFFF", chimney: "#C4A265", doorFrame: "#6B4226",
  fog: "#C8E4D8",
};

// ─── Building config per v2 spec Section 6 ──────────────────────
const BUILDINGS = [
  { id: "hq", name: "HQ", position: [0, 0, -4] as [number, number, number], size: [6, 4, 5] as [number, number, number], color: "#FFF5E1", roofColor: "#E87B5A", href: undefined },
  { id: "shop", name: "Shop", position: [-14, 0, 8] as [number, number, number], size: [4, 3.5, 4] as [number, number, number], color: "#D4EAD4", roofColor: "#5BA086", href: "/student/dashboard/shop" },
  { id: "oracle", name: "Oracle Temple", position: [0, 3, 22] as [number, number, number], size: [5, 5, 5] as [number, number, number], color: "#E8DCF0", roofColor: "#7B5EA7", href: undefined },
  { id: "house", name: "House", position: [14, 0, 10] as [number, number, number], size: [3.5, 2.8, 3.5] as [number, number, number], color: "#C8E6C9", roofColor: "#7EB8C9", href: undefined },
  { id: "bounty", name: "Bounty Board", position: [10, 0, 8] as [number, number, number], size: [1.5, 1.8, 0.3] as [number, number, number], color: P.dirtPath, href: "/student/dashboard/bounty" },
  { id: "jobs", name: "Job Board", position: [-10, 0, -10] as [number, number, number], size: [1.5, 1.8, 0.3] as [number, number, number], color: P.dirtPath, href: "/student/dashboard/jobs" },
  { id: "leaderboard", name: "Leaderboard", position: [10, 0, -10] as [number, number, number], size: [1.2, 2.5, 1.2] as [number, number, number], color: P.wellStone, href: "/student/dashboard/leaderboard" },
];

const SPAWN_POSITION: [number, number, number] = [0, 0, -15];

// ─── Time-of-Day (v2 spec Section 8.1) ──────────────────────────
// [hour, skyTop, skyBottom, sunColor, sunIntensity, ambientColor, ambientIntensity]
const TOD_KEYS: [number, string, string, string, number, string, number][] = [
  [5,  "#FFB366", "#FFD4A8", "#FFD4A8", 0.6, "#C4B0FF", 0.4],
  [7,  "#87CEEB", "#B8E4F0", "#FFF5E1", 0.9, "#B0D4FF", 0.5],
  [10, "#87CEEB", "#B8E4F0", "#FFFFFF", 1.0, "#C4D8FF", 0.5],
  [15, "#87CEEB", "#FFD4A8", "#FFE4B0", 0.8, "#D4C8B0", 0.5],
  [17, "#FF9966", "#FFD4A8", "#FFB366", 0.7, "#FFD4A8", 0.4],
  [19, "#FF9966", "#2D2D6B", "#FF8844", 0.3, "#6B5A8B", 0.3],
  [21, "#1A1A40", "#2D2D6B", "#334466", 0.0, "#334466", 0.25],
];
const _tc = new THREE.Color();

function TimeOfDayCycle() {
  const { scene } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const skyMat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { topColor: { value: new THREE.Color(P.skyTop) }, bottomColor: { value: new THREE.Color(P.skyBottom) } },
    vertexShader: `varying vec3 vWP; void main(){ vWP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 topColor,bottomColor; varying vec3 vWP; void main(){ float t=smoothstep(-0.05,0.5,normalize(vWP).y); gl_FragColor=vec4(mix(bottomColor,topColor,t),1.0); }`,
  }), []);

  useFrame(() => {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;

    // Find bounding keyframes
    let ai = TOD_KEYS.length - 1, bi = 0;
    for (let i = 0; i < TOD_KEYS.length - 1; i++) {
      if (h >= TOD_KEYS[i][0] && h < TOD_KEYS[i + 1][0]) { ai = i; bi = i + 1; break; }
    }
    const a = TOD_KEYS[ai], b = TOD_KEYS[bi];

    let t: number;
    if (ai < bi) {
      t = (h - a[0]) / (b[0] - a[0]);
    } else {
      // Night→Dawn wrap (21→5)
      const span = (24 - a[0]) + b[0];
      t = (h >= a[0] ? h - a[0] : h + 24 - a[0]) / span;
    }
    t = THREE.MathUtils.clamp(t, 0, 1);

    // Sky
    skyMat.uniforms.topColor.value.set(a[1]).lerp(_tc.set(b[1]), t);
    skyMat.uniforms.bottomColor.value.set(a[2]).lerp(_tc.set(b[2]), t);

    // Sun
    if (sunRef.current) {
      sunRef.current.color.set(a[3]).lerp(_tc.set(b[3]), t);
      sunRef.current.intensity = a[4] + (b[4] - a[4]) * t;
    }
    // Ambient
    if (ambRef.current) {
      ambRef.current.color.set(a[5]).lerp(_tc.set(b[5]), t);
      ambRef.current.intensity = a[6] + (b[6] - a[6]) * t;
    }
    // Fog matches sky bottom
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(skyMat.uniforms.bottomColor.value);
  });

  return (
    <>
      <mesh scale={[100, 100, 100]} renderOrder={-1}>
        <sphereGeometry args={[1, 32, 32]} />
        <primitive object={skyMat} attach="material" />
      </mesh>
      <hemisphereLight args={["#FFF5E1", P.grassPrimary, 0.55]} />
      <ambientLight ref={ambRef} intensity={0.5} color="#C4D8FF" />
      <directionalLight
        ref={sunRef}
        color="#FFFFFF" intensity={1.0} position={[15, 30, 15]}
        castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-far={60} shadow-camera-left={-30} shadow-camera-right={30}
        shadow-camera-top={30} shadow-camera-bottom={-30}
        shadow-bias={-0.001}
      />
      <directionalLight color="#C0D0FF" intensity={0.15} position={[-12, 18, -8]} />
    </>
  );
}

// ─── Terrain (v2 spec Section 4 — vertex-displaced rolling hills) ─
function Terrain() {
  const geometry = useMemo(() => {
    const size = 82;
    const segments = 128;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c1 = new THREE.Color(P.grassPrimary);
    const c2 = new THREE.Color(P.grassSecondary);
    const cH = new THREE.Color(P.grassHighlight);
    const cS = new THREE.Color(P.grassShadow);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = Math.sqrt(x * x + z * z);
      const h = getTerrainHeight(x, z);
      pos.setY(i, h);

      // Vertex color: blend greens by height + noise variation.
      // A1 retune: amplitude is now ~0.6, so divide by 0.6 not 3.
      const cn = valueNoise(x * 0.15, z * 0.15);
      const hf = THREE.MathUtils.clamp(h / 0.6, 0, 1);

      if (dist > 38) {
        tmp.copy(cS);
      } else if (hf > 0.5) {
        tmp.lerpColors(c1, cH, (hf - 0.5) * 2);
      } else if (cn > 0.6) {
        tmp.copy(cH);
      } else if (cn < 0.3) {
        tmp.copy(c2);
      } else {
        tmp.copy(c1);
      }

      if (dist > 34) {
        tmp.lerp(cS, (dist - 34) / 6);
      }

      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.92} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* Building slab patches — flat grass discs slightly above terrain so
          buildings sit flush with no visible seam. Sprint A1. */}
      {BUILDING_FOOTPRINTS.map((b, i) => {
        const y = getTerrainHeight(b.x, b.z);
        return (
          <mesh
            key={`slab-${i}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[b.x, y + 0.01, b.z]}
            receiveShadow
          >
            <circleGeometry args={[b.radius, 24]} />
            <meshStandardMaterial
              color={P.grassPrimary}
              roughness={0.92}
              metalness={0}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>
        );
      })}
      {/* Curved alpha-blended paths (sprint A2). PATH_CORRIDORS in terrain.ts
          still flatten these zones to y≈0 — control points stay within the
          ±1.75 halfWidth corridor + 1.5 falloff, so we never leave the flat
          band. See Path.tsx for the spline + soft-edge implementation. */}
      <Path
        controlPoints={[[0, -23], [1.5, -10], [-0.5, 4], [0, 17]]}
        width={2.8}
        color={P.dirtPath}
      />
      <Path
        controlPoints={[[-16, 8], [-5, 7], [5, 9], [16, 8]]}
        width={2.8}
        color={P.dirtPath}
      />
      <Path
        controlPoints={[[-12, -10], [-3, -10.5], [3, -9.5], [12, -10]]}
        width={2.8}
        color={P.dirtPath}
      />
    </group>
  );
}

// ─── Bridge (v2 spec Section 5.2) ────────────────────────────────
// Bridge sits where the river spline crosses the N-S path (x=0). We sample
// the spline once at module-load and orient the bridge along the river's
// tangent at that point. The bridge group spans the river width (~3.8) +
// some overhang. Sprint A3.
function Bridge() {
  const { position, rotation } = useMemo(() => {
    const t = findRiverTForX(0);
    const sample = sampleRiverPoint(t);
    // Bridge planks should run perpendicular to the river (i.e. parallel to
    // the path's N-S direction). The bridge's own +Z axis aligns with the
    // path. Rotate around Y so the bridge's local Z = river's normal.
    // Atan2 of the river tangent gives the river's heading; the bridge's
    // heading is perpendicular to that.
    const heading = Math.atan2(sample.tangent.x, sample.tangent.z);
    return {
      position: [sample.position.x, 0.06, sample.position.z] as [number, number, number],
      rotation: [0, heading + Math.PI / 2, 0] as [number, number, number],
    };
  }, []);

  return (
    <group position={position} rotation={rotation}>
      {/* Planks run along the bridge's local Z, lined up across the river. */}
      {[-1.4, -1.0, -0.6, -0.2, 0.2, 0.6, 1.0, 1.4].map((x, i) => (
        <mesh key={`plank-${i}`} position={[x, 0.02, 0]} castShadow>
          <boxGeometry args={[0.35, 0.06, 4.4]} />
          <meshStandardMaterial color={P.bridgeWood} roughness={0.85} metalness={0} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={`rail-${side}`}>
          {[-1.5, 0, 1.5].map((x, i) => (
            <mesh key={i} position={[x, 0.5, side * 2.0]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 1, 6]} />
              <meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} />
            </mesh>
          ))}
          <mesh position={[0, 0.8, side * 2.0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 3.2, 8]} />
            <meshStandardMaterial color={P.bridgeRope} roughness={0.95} metalness={0} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// (Lighting merged into TimeOfDayCycle above)

// (Tree component replaced by NatureTree from NatureModels.tsx)
const TREE_XZ: [number, number][] = [
  [-7, 16], [7, 16], [-20, 5], [20, 5],
  [-18, -5], [18, -5], [-5, -20], [5, -20],
  [-24, 12], [24, 12], [-10, 24], [12, 24],
  [-22, -14], [22, -14], [-14, -16], [14, 16],
  [-28, 0], [28, 6], [-8, 26], [8, 26],
];

// ─── Bushes (v2 spec Section 7.2) ───────────────────────────────
const BUSH_XZ: [number, number][] = [
  [-5, -2], [5, -2], [-13, 6], [13, 6],
  [-3, -7], [3, -7], [-15, -3], [15, -3],
  [-7, 12], [7, 12], [0, -17], [-18, 10],
  [18, 10], [-6, -14], [6, -14], [-10, 14],
  [10, 14], [-22, 3], [22, 3], [0, 9],
];
function Bushes() {
  return (
    <group>
      {BUSH_XZ.map(([x, z], i) => (
        <NatureBush key={i} position={[x, getTerrainHeight(x, z), z]} seed={i} />
      ))}
    </group>
  );
}

// ─── Flowers (v2 spec Section 7.3) ──────────────────────────────
const FLOWER_XZ: [number, number][] = [
  [-4, -3], [4, 6], [-7, 11], [11, -4],
  [-2, 14], [6, -13], [-11, 5], [13, 4],
  [2, 17], [-6, -11], [8, 15], [-14, -6],
];
function Flowers() {
  return (
    <group>
      {FLOWER_XZ.map(([x, z], i) => (
        <NatureFlowerCluster key={i} position={[x, getTerrainHeight(x, z), z]} seed={i} />
      ))}
    </group>
  );
}

// Butterflies migrated to AmbientLife.tsx (sprint A6 — day-only group with
// procedural wing-flap meshes + fireflies/leaves/birds for full ambient life).

// ─── Time-of-day phase helper (sprint A6) ───────────────────────
// TimeOfDayCycle reads wall-clock directly each frame; we mirror that here at
// a coarser interval so AmbientLife can swap day/night creatures without
// refactoring the cycle itself.
function hourToPhase(h: number): "day" | "night" | "dawn" | "dusk" {
  if (h >= 5 && h < 7) return "dawn";
  if (h >= 7 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

// Shared phase hook — used by Scene (for AmbientLife) and the outer GameWorld
// shell (for the DOM-mounted AudioController). 60s tick matches A6.
function useTodPhase(): "day" | "night" | "dawn" | "dusk" {
  const [phase, setPhase] = useState<"day" | "night" | "dawn" | "dusk">(() =>
    hourToPhase(new Date().getHours()),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setPhase(hourToPhase(new Date().getHours()));
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return phase;
}

// ─── Chimney Smoke (v2 spec Section 10 — slow upward drift) ─────
const SMOKE_COUNT = 20;
function ChimneySmoke() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SMOKE_COUNT * 3), 3));
    return g;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const pos = ref.current.geometry.attributes.position;
    const baseY = getTerrainHeight(0, -4) + 5.2;
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const age = (t * 0.3 + i / SMOKE_COUNT) % 1;
      pos.setXYZ(
        i,
        1.5 + Math.sin(t * 0.2 + i) * age * 0.5,
        baseY + age * 3,
        -5 + Math.cos(t * 0.15 + i * 0.7) * age * 0.3,
      );
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#D0C8C0" size={0.2} transparent opacity={0.3} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ─── Props (v2 spec Section 9) — all placed at terrain height ───
function yAt(x: number, z: number): [number, number, number] {
  return [x, getTerrainHeight(x, z), z];
}
function Props() {
  return (
    <group>
      {/* Benches */}
      {[[-3, -5], [3, -5], [-3, 6], [3, 6]].map(([x, z], i) => (
        <group key={`bench-${i}`} position={yAt(x, z)}>
          <mesh position={[0, 0.4, 0]} castShadow><boxGeometry args={[1.4, 0.1, 0.5]} /><meshStandardMaterial color={P.benchWood} roughness={0.85} metalness={0} /></mesh>
          <mesh position={[0, 0.7, -0.2]} castShadow><boxGeometry args={[1.4, 0.5, 0.08]} /><meshStandardMaterial color={P.benchWood} roughness={0.85} metalness={0} /></mesh>
          {[-0.55, 0.55].map((bx, j) => (
            <mesh key={j} position={[bx, 0.2, 0]} castShadow><boxGeometry args={[0.08, 0.4, 0.5]} /><meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} /></mesh>
          ))}
        </group>
      ))}
      {/* Lampposts */}
      {[[1.8, -7], [-1.8, 6], [1.8, 13], [-1.8, -12], [1.8, -18]].map(([x, z], i) => (
        <group key={`lamp-${i}`} position={yAt(x, z)}>
          <mesh position={[0, 1.6, 0]} castShadow><cylinderGeometry args={[0.05, 0.07, 3.2, 8]} /><meshStandardMaterial color={P.lampPost} roughness={0.7} metalness={0.15} /></mesh>
          <mesh position={[0, 3.4, 0]}><boxGeometry args={[0.4, 0.3, 0.4]} /><meshStandardMaterial color="#F5E6C8" roughness={0.6} metalness={0} emissive={P.lampGlow} emissiveIntensity={0.2} /></mesh>
          <pointLight color={P.lampGlow} intensity={0.35} distance={6} position={[0, 3.2, 0]} />
        </group>
      ))}
      {/* Wooden fences near HQ (Kenney Nature Kit) */}
      {[[-5, -2], [-5, 0], [-5, -4], [5, -2], [5, 0], [5, -4]].map(([x, z], i) => (
        <NatureFence key={`fence-${i}`} position={yAt(x, z)} variant={i} />
      ))}
      {/* Well near HQ */}
      <group position={yAt(4, -6)}>
        <mesh position={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.6, 0.7, 0.8, 12]} /><meshStandardMaterial color={P.wellStone} roughness={0.92} metalness={0} /></mesh>
        <mesh position={[0, 1.0, 0]} castShadow><cylinderGeometry args={[0.04, 0.04, 1.2, 6]} /><meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} /></mesh>
        <mesh position={[0, 1.6, 0]}><boxGeometry args={[1.4, 0.08, 0.5]} /><meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} /></mesh>
      </group>
      {/* Log stumps (Kenney Nature Kit) */}
      {[[-16, -10], [18, -16], [-20, 14]].map(([x, z], i) => (
        <NatureStump key={`stump-${i}`} position={yAt(x, z)} />
      ))}
      {/* Mushrooms under trees (Kenney Nature Kit) */}
      {[[-7.5, 15.5], [7.5, 15.5], [-20.5, 4.5], [20.5, 4.5], [-5.5, -19.5]].map(([x, z], i) => (
        <NatureMushroom key={`mush-${i}`} position={yAt(x, z)} seed={i} />
      ))}
      {/* Banners near HQ */}
      {[[3.5, -7], [-3.5, -7]].map(([x, z], i) => (
        <group key={`banner-${i}`} position={yAt(x, z)}>
          <mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.04, 0.04, 3.2, 8]} /><meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} /></mesh>
          <mesh position={[0, 2.8, 0]}><planeGeometry args={[0.7, 1]} /><meshStandardMaterial color="#4A6FA5" roughness={0.8} metalness={0} side={THREE.DoubleSide} /></mesh>
        </group>
      ))}
    </group>
  );
}

// ─── NPC spawn anchors (D5) ─────────────────────────────────────
// Approximate centers per spawn_zone enum. When >1 NPC shares a zone we
// offset along +x so they don't visually overlap.
const NPC_SPAWN_POSITIONS: Record<SpawnZone, [number, number, number]> = {
  courtyard: [-2, 0, -2],
  shop: [-14, 0, 6],
  temple: [0, 0, 18],
  roaming: [5, 0, 5],
};

// Generic filler NPCs — design principle #2: world must never feel empty.
// No persona_prompt / canned_dialogue: clicking shows a brief tooltip, not
// the chat overlay. Synthetic ids prefixed `filler-` for traceability.
const FILLER_NPCS: NPCPersona[] = [
  {
    id: "filler-wanderer-1",
    slug: "wanderer-1",
    display_name: "Wanderer",
    sprite_url: null,
    spawn_zone: "courtyard",
    is_permanent: false,
    persona_prompt: null,
    canned_dialogue: [],
    active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "filler-visitor-1",
    slug: "visitor-1",
    display_name: "Visitor",
    sprite_url: null,
    spawn_zone: "courtyard",
    is_permanent: false,
    persona_prompt: null,
    canned_dialogue: [],
    active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "filler-stranger-1",
    slug: "stranger-1",
    display_name: "Stranger",
    sprite_url: null,
    spawn_zone: "courtyard",
    is_permanent: false,
    persona_prompt: null,
    canned_dialogue: [],
    active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
];

const FILLER_POSITIONS: [number, number, number][] = [
  [3, 0, -4],
  [-4, 0, -5],
  [2, 0, -8],
];

// ─── Scene ──────────────────────────────────────────────────────
function Scene({
  playerName,
  playerLevel,
  fogColor,
  todPhase,
  onNPCClick,
  activeEmote,
  playerPosRef,
}: {
  playerName: string;
  playerLevel: number;
  fogColor: string;
  todPhase: "day" | "night" | "dawn" | "dusk";
  onNPCClick: (npc: NPCPersona) => void;
  activeEmote: EmoteType | null;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
}) {
  const cameraRef = useRef<CameraControls>(null);
  const [playerPos, setPlayerPos] = useState<THREE.Vector3>(new THREE.Vector3(...SPAWN_POSITION));
  const { data: personas } = useNPCPersonas({ permanentOnly: true });
  const [fillerToast, setFillerToast] = useState<string | null>(null);

  // E4: heartbeat current position to player_positions every 30s.
  // playerPosRef is a Vector3; the hook only reads .x and .z so it duck-types.
  usePositionHeartbeat(playerPosRef as unknown as React.RefObject<{ x: number; z: number } | null>);
  // E5: ghost-replay of other recent members (last 24h, max 10).
  const { ghosts } = useGhostPositions();
  // E9: settings toggle — members can disable ghost ambience.
  const [ghostsEnabled] = useGhostReplaySetting();

  // Position each permanent NPC by spawn_zone, offsetting duplicates so they
  // don't overlap. Stable: ordering follows the personas array.
  const placedPersonas = useMemo(() => {
    const zoneCount: Partial<Record<SpawnZone, number>> = {};
    return personas.map((p) => {
      const base = NPC_SPAWN_POSITIONS[p.spawn_zone] ?? NPC_SPAWN_POSITIONS.courtyard;
      const idx = zoneCount[p.spawn_zone] ?? 0;
      zoneCount[p.spawn_zone] = idx + 1;
      const pos: [number, number, number] = [base[0] + idx * 1.5, base[1], base[2]];
      return { persona: p, position: pos };
    });
  }, [personas]);

  const handleFillerClick = useCallback((name: string) => {
    setFillerToast(`${name}: ...just passing through.`);
    setTimeout(() => setFillerToast(null), 2000);
  }, []);

  const handlePlayerMove = useCallback((position: THREE.Vector3) => {
    setPlayerPos(position);
    playerPosRef.current.copy(position);
    cameraRef.current?.moveTo(position.x, position.y + 1.5, position.z, true);
  }, [playerPosRef]);

  // Sprint F1.1: rebind mouse buttons via the imperative API. drei's JSX
  // wrapper doesn't always thread the `mouseButtons` object cleanly, so set
  // them once the controls instance is mounted.
  //  - left = NONE  → click-to-move ground raycast can fire without rotating
  //  - right = ROTATE → right-click drag yaws/pitches the camera
  //  - wheel = DOLLY → scroll zooms in/out within minDistance/maxDistance
  //  - middle = NONE
  useEffect(() => {
    const cc = cameraRef.current;
    if (!cc) return;
    // camera-controls ACTION enum: NONE=0, ROTATE=1, DOLLY=16
    cc.mouseButtons.left = 0;
    cc.mouseButtons.middle = 0;
    cc.mouseButtons.right = 1;
    cc.mouseButtons.wheel = 16;
  }, []);

  // Sprint F1.1: arrow-key camera rotation as no-mouse fallback. Tracks
  // held state via a ref so the rotation rate is consistent per frame.
  // Guarded against typing in inputs.
  const arrowKeysRef = useRef({ left: false, right: false, up: false, down: false });
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping()) return;
      if (e.key === "ArrowLeft") arrowKeysRef.current.left = true;
      else if (e.key === "ArrowRight") arrowKeysRef.current.right = true;
      else if (e.key === "ArrowUp") arrowKeysRef.current.up = true;
      else if (e.key === "ArrowDown") arrowKeysRef.current.down = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") arrowKeysRef.current.left = false;
      else if (e.key === "ArrowRight") arrowKeysRef.current.right = false;
      else if (e.key === "ArrowUp") arrowKeysRef.current.up = false;
      else if (e.key === "ArrowDown") arrowKeysRef.current.down = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useFrame(() => {
    const cc = cameraRef.current;
    if (!cc) return;
    const k = arrowKeysRef.current;
    let dAz = 0;
    let dPol = 0;
    if (k.left) dAz -= 0.02;
    if (k.right) dAz += 0.02;
    if (k.up) dPol -= 0.015;
    if (k.down) dPol += 0.015;
    if (dAz !== 0 || dPol !== 0) {
      cc.rotate(dAz, dPol, true);
    }
  });

  return (
    <>
      {/* Sprint F1.1: camera-relative WASD + right-click drag + scroll zoom +
          arrow-key fallback. Polar gated to ±20-30° around horizontal so the
          AC framing is preserved while allowing a peek up/down. */}
      <CameraControls
        ref={cameraRef}
        minPolarAngle={Math.PI / 2 - (30 * Math.PI) / 180}
        maxPolarAngle={Math.PI / 2 + (20 * Math.PI) / 180}
        minDistance={8}
        maxDistance={25}
        dollySpeed={1.0}
        truckSpeed={0}
        smoothTime={0.15}
        draggingSmoothTime={0.05}
        azimuthRotateSpeed={1.0}
        polarRotateSpeed={0.6}
        makeDefault
      />

      <TimeOfDayCycle />
      <fog attach="fog" args={[fogColor, 50, 100]} />

      <Terrain />
      <River />
      <Bridge />

      {TREE_XZ.map(([x, z], i) => <NatureTree key={i} position={[x, getTerrainHeight(x, z), z]} seed={i} />)}
      <Bushes />
      <Flowers />
      <AmbientLife phase={todPhase} />
      <ChimneySmoke />

      <Suspense fallback={null}>
        <Clouds material={THREE.MeshBasicMaterial}>
          <Cloud segments={40} bounds={[12, 2, 12]} volume={6} color="#FFFFFF" position={[-12, 25, -10]} opacity={0.6} speed={0.1} />
          <Cloud segments={30} bounds={[8, 2, 8]} volume={4} color="#FFF8F0" position={[14, 28, 12]} opacity={0.45} speed={0.15} />
          <Cloud segments={25} bounds={[6, 2, 6]} volume={3} color="#FFFFFF" position={[0, 30, 25]} opacity={0.5} speed={0.08} />
        </Clouds>
        <Props />
        <AmbientProps />
      </Suspense>

      {BUILDINGS.map((b) => {
        const y = getTerrainHeight(b.position[0], b.position[2]);
        return <Building key={b.id} id={b.id} name={b.name} position={[b.position[0], y, b.position[2]]} size={b.size} color={b.color} roofColor={b.roofColor} href={b.href} playerPosition={playerPos} />;
      })}

      {/* Permanent NPCs from content pipeline. Click → chat overlay. */}
      {placedPersonas.map(({ persona, position }) => (
        <NPC
          key={persona.id}
          persona={persona}
          position={position}
          onClick={() => onNPCClick(persona)}
        />
      ))}

      {/* Filler NPCs (design principle #2). Click → brief tooltip, no chat. */}
      {FILLER_NPCS.map((filler, i) => (
        <NPC
          key={filler.id}
          persona={filler}
          position={FILLER_POSITIONS[i]}
          onClick={() => handleFillerClick(filler.display_name)}
        />
      ))}

      {/* E5: Ghost-replay of other recent members. Capped at 10. E9: gated
          on the per-user settings toggle (default ON). */}
      {ghostsEnabled && ghosts.slice(0, 10).map((g) => (
        <GhostReplay key={g.user_id} ghost={g} />
      ))}

      <PlayerAvatar spawnPosition={SPAWN_POSITION} onMove={handlePlayerMove} playerName={playerName} playerLevel={playerLevel} activeEmote={activeEmote} />

      {fillerToast && (
        <Html position={[0, 4, 0]} center style={{ pointerEvents: "none" }} distanceFactor={10}>
          <div
            style={{
              background: "rgba(15, 15, 16, 0.85)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 8,
              padding: "6px 12px",
              color: "#f1ffff",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
          >
            {fillerToast}
          </div>
        </Html>
      )}
    </>
  );
}

// ─── Canvas (v2 spec Section 2) ─────────────────────────────────
export default function GameWorld() {
  const { profile } = useUser();
  const { data: activePalette } = useActivePalette();
  const playerName = profile?.display_name || "Player";
  const playerLevel = profile?.level ?? 1;

  // Sky + fog read from the active seasonal palette; everything else still
  // uses the hardcoded P table for this sprint. Time-of-day cycle continues to
  // animate sky from TOD_KEYS on top — palette controls only the initial /
  // fallback color and the fog tone before TOD overwrites it.
  const skyBase = activePalette.palette.sky || P.skyBottom;
  const fogColor = activePalette.palette.fog || P.fog;
  const todPhase = useTodPhase();

  // Active NPC chat target. D5 wires sprite clicks → setActiveNPC inside Scene.
  const [activeNPC, setActiveNPC] = useState<NPCPersona | null>(null);

  // Sprint E2 + E3: emote menu state + active emote bubble on the avatar.
  const [emoteMenuOpen, setEmoteMenuOpen] = useState(false);
  // Sprint E6: guestbook wall overlay state.
  const [guestbookOpen, setGuestbookOpen] = useState(false);
  const [activeEmote, setActiveEmote] = useState<EmoteType | null>(null);
  const emoteClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(...SPAWN_POSITION));

  // E key toggles the emote menu. Skip when the user is typing in an input /
  // textarea / contentEditable so we don't hijack chat or form fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "e" && e.key !== "E") return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      if (activeNPC) return; // don't pop emote menu while chatting with an NPC
      e.preventDefault();
      setEmoteMenuOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeNPC]);

  useEffect(() => {
    return () => {
      if (emoteClearTimerRef.current) clearTimeout(emoteClearTimerRef.current);
    };
  }, []);

  const handleEmotePick = useCallback((emote: EmoteType) => {
    setActiveEmote(emote);
    if (emoteClearTimerRef.current) clearTimeout(emoteClearTimerRef.current);
    emoteClearTimerRef.current = setTimeout(() => {
      setActiveEmote(null);
      emoteClearTimerRef.current = null;
    }, 3500);

    const pos = playerPosRef.current;
    void fetch("/api/emotes/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emote_type_id: emote.id,
        world_x: pos.x,
        world_z: pos.z,
      }),
    }).catch(() => {
      // Silent — emote played client-side even if log fails.
    });
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: skyBase, position: "relative" }}>
      <Canvas
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 50, near: 0.1, far: 300, position: [0, 12, -20] }}
        shadows
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <Suspense fallback={null}>
          <Scene
            playerName={playerName}
            playerLevel={playerLevel}
            fogColor={fogColor}
            todPhase={todPhase}
            onNPCClick={setActiveNPC}
            activeEmote={activeEmote}
            playerPosRef={playerPosRef}
          />
        </Suspense>
      </Canvas>
      <AudioController phase={todPhase} />
      <NPCChatOverlay npc={activeNPC} onClose={() => setActiveNPC(null)} />
      <EmoteMenu
        open={emoteMenuOpen}
        onClose={() => setEmoteMenuOpen(false)}
        onPick={handleEmotePick}
      />
      <GuestbookOverlay
        open={guestbookOpen}
        onClose={() => setGuestbookOpen(false)}
      />
      {/* Sprint E2: corner button for mobile / no-keyboard users. Sits left of
          the AudioController widget so they don't overlap. */}
      <button
        onClick={() => setEmoteMenuOpen((o) => !o)}
        aria-label="Open emote menu"
        title="Emote (E)"
        style={{
          position: "absolute",
          bottom: 16,
          right: 120,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 10px",
          background: "rgba(15, 15, 16, 0.78)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: 8,
          color: "#f1ffff",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          cursor: "pointer",
          backdropFilter: "blur(6px)",
        }}
      >
        <Smile size={14} />
        Emote
      </button>
      {/* Sprint E6: guestbook trigger. Sits left of the emote button. */}
      <button
        onClick={() => setGuestbookOpen((o) => !o)}
        aria-label="Open guestbook"
        title="Guestbook"
        style={{
          position: "absolute",
          bottom: 16,
          right: 200,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 10px",
          background: "rgba(15, 15, 16, 0.78)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: 8,
          color: "#f1ffff",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          cursor: "pointer",
          backdropFilter: "blur(6px)",
        }}
      >
        <BookOpen size={14} />
        Guestbook
      </button>
    </div>
  );
}
