"use client";

import { Suspense, useRef, useState, useCallback, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { CameraControls, Cloud, Clouds } from "@react-three/drei";
import * as THREE from "three";
import PlayerAvatar from "./PlayerAvatar";
import Building from "./Building";

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

// ─── Gradient Sky (v2 spec Section 3.1) ─────────────────────────
function GradientSky() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { topColor: { value: new THREE.Color(P.skyTop) }, bottomColor: { value: new THREE.Color(P.skyBottom) } },
    vertexShader: `varying vec3 vWP; void main(){ vWP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 topColor,bottomColor; varying vec3 vWP; void main(){ float t=smoothstep(-0.05,0.5,normalize(vWP).y); gl_FragColor=vec4(mix(bottomColor,topColor,t),1.0); }`,
  }), []);
  return <mesh scale={[100, 100, 100]} renderOrder={-1}><sphereGeometry args={[1, 32, 32]} /><primitive object={mat} attach="material" /></mesh>;
}

// ─── Terrain (v2 spec Section 4) ────────────────────────────────
function Terrain() {
  return (
    <group>
      {/* Main grass island — circular for AC feel */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[40, 48]} />
        <meshStandardMaterial color={P.grassPrimary} roughness={0.92} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* Darker edge ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <ringGeometry args={[34, 40, 48]} />
        <meshStandardMaterial color={P.grassShadow} roughness={0.92} metalness={0} />
      </mesh>
      {/* Light grass patches */}
      {[[-8, -12], [10, 15], [-16, 6], [14, -6], [-4, 22], [6, 3]].map(([x, z], i) => (
        <mesh key={`gp-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, z]}>
          <circleGeometry args={[2.5 + i % 3, 16]} />
          <meshStandardMaterial color={i % 2 === 0 ? P.grassHighlight : P.grassSecondary} roughness={0.92} metalness={0} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
      ))}
      {/* Oracle hill — elevated area (v2 spec: Oracle at 3-4 units elevation) */}
      <mesh position={[0, 1.5, 22]} castShadow receiveShadow>
        <cylinderGeometry args={[8, 10, 3, 24]} />
        <meshStandardMaterial color={P.grassSecondary} roughness={0.92} metalness={0} />
      </mesh>
      {/* Path borders */}
      {[[0, 0, 4.5, 45], [0, 8, 32, 4.5], [0, -10, 24, 4.5]].map(([x, z, w, h], i) => (
        <mesh key={`pb-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, z]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color={P.dirtPathEdge} roughness={0.88} metalness={0} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      ))}
      {/* Dirt paths */}
      {[[0, 0, 3.5, 45], [0, 8, 32, 3.5], [0, -10, 24, 3.5]].map(([x, z, w, h], i) => (
        <mesh key={`p-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, z]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color={P.dirtPath} roughness={0.85} metalness={0} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
      ))}
    </group>
  );
}

// ─── River + Bridge (v2 spec Section 5) ─────────────────────────
function River() {
  const waterRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (waterRef.current) {
      const mat = waterRef.current.material as THREE.MeshStandardMaterial;
      if (mat.map) mat.map.offset.x = state.clock.elapsedTime * 0.02;
    }
  });
  return (
    <group>
      {/* Riverbed */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 3]}>
        <planeGeometry args={[80, 4]} />
        <meshStandardMaterial color={P.riverbed} roughness={0.95} metalness={0} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      {/* River banks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 3]}>
        <planeGeometry args={[80, 5]} />
        <meshStandardMaterial color={P.riverEdge} roughness={0.7} metalness={0} transparent opacity={0.6} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      {/* Water surface */}
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 3]}>
        <planeGeometry args={[80, 3]} />
        <meshStandardMaterial color={P.riverSurface} roughness={0.2} metalness={0.1} transparent opacity={0.75} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
      </mesh>
      {/* Bridge (v2 spec Section 5.2) */}
      <group position={[0, 0.05, 3]}>
        {/* Planks */}
        {[-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2].map((x, i) => (
          <mesh key={`plank-${i}`} position={[x, 0.02, 0]} castShadow>
            <boxGeometry args={[0.35, 0.06, 3.2]} />
            <meshStandardMaterial color={P.bridgeWood} roughness={0.85} metalness={0} />
          </mesh>
        ))}
        {/* Rope railings */}
        {[-1, 1].map((side) => (
          <group key={`rail-${side}`}>
            {[-1.3, 0, 1.3].map((x, i) => (
              <mesh key={i} position={[x, 0.5, side * 1.5]} castShadow>
                <cylinderGeometry args={[0.04, 0.04, 1, 6]} />
                <meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} />
              </mesh>
            ))}
            <mesh position={[0, 0.8, side * 1.5]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, 3, 8]} />
              <meshStandardMaterial color={P.bridgeRope} roughness={0.95} metalness={0} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

// ─── Lighting (v2 spec Section 8 — fixed midday) ────────────────
function Lighting() {
  return (
    <>
      <hemisphereLight args={["#FFF5E1", P.grassPrimary, 0.55]} />
      <ambientLight intensity={0.5} color="#C4D8FF" />
      <directionalLight
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

// ─── Trees (v2 spec Section 7.1 — sphere canopies) ──────────────
function Tree({ position, seed }: { position: [number, number, number]; seed: number }) {
  const canopyRef = useRef<THREE.Group>(null);
  const scale = 0.85 + (seed % 5) * 0.08;
  const type = seed % 4;
  useFrame((s) => {
    if (canopyRef.current) {
      const t = s.clock.elapsedTime;
      canopyRef.current.rotation.z = Math.sin(t * 0.15 + seed * 1.7) * (Math.PI / 90);
      canopyRef.current.rotation.x = Math.sin(t * 0.1 + seed * 2.3) * (Math.PI / 120);
    }
  });
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 1.6, 8]} />
        <meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} />
      </mesh>
      <group ref={canopyRef}>
        {type === 0 ? (
          // Deciduous — single round canopy
          <mesh position={[0, 2.4, 0]} castShadow>
            <sphereGeometry args={[1.3, 12, 10]} />
            <meshStandardMaterial color={P.foliage} roughness={0.88} metalness={0} />
          </mesh>
        ) : type === 1 ? (
          // 3-sphere cluster
          <>
            <mesh position={[0, 2.1, 0]} castShadow><sphereGeometry args={[1.1, 10, 8]} /><meshStandardMaterial color={P.foliageShadow} roughness={0.88} metalness={0} /></mesh>
            <mesh position={[-0.3, 2.8, 0.2]} castShadow><sphereGeometry args={[0.85, 10, 8]} /><meshStandardMaterial color={P.foliage} roughness={0.88} metalness={0} /></mesh>
            <mesh position={[0.2, 3.1, -0.1]} castShadow><sphereGeometry args={[0.7, 10, 8]} /><meshStandardMaterial color={P.foliageHighlight} roughness={0.88} metalness={0} /></mesh>
          </>
        ) : type === 2 ? (
          // Small sapling
          <mesh position={[0, 1.6, 0]} castShadow>
            <sphereGeometry args={[0.7, 10, 8]} />
            <meshStandardMaterial color={P.foliageHighlight} roughness={0.88} metalness={0} />
          </mesh>
        ) : (
          // Cedar/Pine — rounded layers
          <>
            <mesh position={[0, 1.8, 0]} castShadow><coneGeometry args={[1.1, 1.6, 8]} /><meshStandardMaterial color={P.pine} roughness={0.88} metalness={0} /></mesh>
            <mesh position={[0, 2.7, 0]} castShadow><coneGeometry args={[0.85, 1.4, 8]} /><meshStandardMaterial color={P.pine} roughness={0.88} metalness={0} /></mesh>
            <mesh position={[0, 3.4, 0]} castShadow><coneGeometry args={[0.55, 1.0, 8]} /><meshStandardMaterial color={P.foliage} roughness={0.88} metalness={0} /></mesh>
          </>
        )}
      </group>
    </group>
  );
}

const TREE_POS: [number, number, number][] = [
  [-7, 0, 16], [7, 0, 16], [-20, 0, 5], [20, 0, 5],
  [-18, 0, -5], [18, 0, -5], [-5, 0, -20], [5, 0, -20],
  [-24, 0, 12], [24, 0, 12], [-10, 0, 24], [12, 0, 24],
  [-22, 0, -14], [22, 0, -14], [-14, 0, -16], [14, 0, 16],
  [-28, 0, 0], [28, 0, 6], [-8, 3, 26], [8, 3, 26],
];

// ─── Bushes (v2 spec Section 7.2) ───────────────────────────────
function Bushes() {
  const pos: [number, number, number][] = [
    [-5, 0, -2], [5, 0, -2], [-13, 0, 6], [13, 0, 6],
    [-3, 0, -7], [3, 0, -7], [-15, 0, -3], [15, 0, -3],
    [-7, 0, 12], [7, 0, 12], [0, 0, -17], [-18, 0, 10],
    [18, 0, 10], [-6, 0, -14], [6, 0, -14], [-10, 0, 14],
    [10, 0, 14], [-22, 0, 3], [22, 0, 3], [0, 0, 9],
  ];
  return (
    <group>
      {pos.map((p, i) => (
        <mesh key={i} position={[p[0], 0.25 + (i % 3) * 0.05, p[2]]} castShadow>
          <sphereGeometry args={[0.4 + (i % 4) * 0.1, 8, 6]} />
          <meshStandardMaterial
            color={i % 5 === 0 ? P.bushFlower : P.bush}
            roughness={0.9} metalness={0}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Flowers (v2 spec Section 7.3) ──────────────────────────────
function Flowers() {
  const colors = [P.flowerRed, P.flowerPink, P.flowerYellow, P.flowerWhite, P.flowerBlue, P.flowerPurple, P.flowerOrange];
  const clusters: [number, number, number][] = [
    [-4, 0, -3], [4, 0, 6], [-7, 0, 11], [11, 0, -4],
    [-2, 0, 14], [6, 0, -13], [-11, 0, 5], [13, 0, 4],
    [2, 0, 17], [-6, 0, -11], [8, 0, 15], [-14, 0, -6],
  ];
  return (
    <group>
      {clusters.map((pos, i) => (
        <group key={i} position={pos}>
          {[0, 1, 2, 3, 4].map((j) => (
            <mesh key={j} position={[(j - 2) * 0.28, 0.12, ((j * 7 + i) % 3 - 1) * 0.25]}>
              <sphereGeometry args={[0.1, 6, 6]} />
              <meshStandardMaterial color={colors[(i + j) % colors.length]} roughness={0.75} metalness={0} emissive={colors[(i + j) % colors.length]} emissiveIntensity={0.08} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ─── Props (v2 spec Section 9) ──────────────────────────────────
function Props() {
  return (
    <group>
      {/* Benches */}
      {[[-3, 0, -5], [3, 0, -5], [-3, 0, 6], [3, 0, 6]].map((pos, i) => (
        <group key={`bench-${i}`} position={pos as [number, number, number]}>
          <mesh position={[0, 0.4, 0]} castShadow><boxGeometry args={[1.4, 0.1, 0.5]} /><meshStandardMaterial color={P.benchWood} roughness={0.85} metalness={0} /></mesh>
          <mesh position={[0, 0.7, -0.2]} castShadow><boxGeometry args={[1.4, 0.5, 0.08]} /><meshStandardMaterial color={P.benchWood} roughness={0.85} metalness={0} /></mesh>
          {[-0.55, 0.55].map((x, j) => (
            <mesh key={j} position={[x, 0.2, 0]} castShadow><boxGeometry args={[0.08, 0.4, 0.5]} /><meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} /></mesh>
          ))}
        </group>
      ))}
      {/* Lampposts */}
      {[[1.8, 0, -7], [-1.8, 0, 6], [1.8, 0, 13], [-1.8, 0, -12], [1.8, 0, -18]].map((pos, i) => (
        <group key={`lamp-${i}`} position={pos as [number, number, number]}>
          <mesh position={[0, 1.6, 0]} castShadow><cylinderGeometry args={[0.05, 0.07, 3.2, 8]} /><meshStandardMaterial color={P.lampPost} roughness={0.7} metalness={0.15} /></mesh>
          <mesh position={[0, 3.4, 0]}><boxGeometry args={[0.4, 0.3, 0.4]} /><meshStandardMaterial color="#F5E6C8" roughness={0.6} metalness={0} emissive={P.lampGlow} emissiveIntensity={0.2} /></mesh>
          <pointLight color={P.lampGlow} intensity={0.35} distance={6} position={[0, 3.2, 0]} />
        </group>
      ))}
      {/* Wooden fences near HQ */}
      {[[-5, 0, -2], [-5, 0, 0], [-5, 0, -4], [5, 0, -2], [5, 0, 0], [5, 0, -4]].map((pos, i) => (
        <group key={`fence-${i}`} position={pos as [number, number, number]}>
          {[-0.4, 0.4].map((x, j) => (
            <mesh key={j} position={[x, 0.35, 0]} castShadow><cylinderGeometry args={[0.035, 0.035, 0.7, 6]} /><meshStandardMaterial color={P.fence} roughness={0.9} metalness={0} /></mesh>
          ))}
          <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[1.0, 0.05, 0.05]} /><meshStandardMaterial color={P.fence} roughness={0.9} metalness={0} /></mesh>
          <mesh position={[0, 0.25, 0]} castShadow><boxGeometry args={[1.0, 0.05, 0.05]} /><meshStandardMaterial color={P.fence} roughness={0.9} metalness={0} /></mesh>
        </group>
      ))}
      {/* Well near HQ */}
      <group position={[4, 0, -6]}>
        <mesh position={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.6, 0.7, 0.8, 12]} /><meshStandardMaterial color={P.wellStone} roughness={0.92} metalness={0} /></mesh>
        <mesh position={[0, 1.0, 0]} castShadow><cylinderGeometry args={[0.04, 0.04, 1.2, 6]} /><meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} /></mesh>
        <mesh position={[0, 1.6, 0]}><boxGeometry args={[1.4, 0.08, 0.5]} /><meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} /></mesh>
      </group>
      {/* Log stumps */}
      {[[-16, 0, -10], [18, 0, -16], [-20, 0, 14]].map((pos, i) => (
        <mesh key={`stump-${i}`} position={[pos[0], 0.15, pos[2]] as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.35, 0.4, 0.3, 8]} />
          <meshStandardMaterial color={P.stumpBrown} roughness={0.95} metalness={0} />
        </mesh>
      ))}
      {/* Mushrooms under trees */}
      {[[-7.5, 0, 15.5], [7.5, 0, 15.5], [-20.5, 0, 4.5], [20.5, 0, 4.5], [-5.5, 0, -19.5]].map((pos, i) => (
        <group key={`mush-${i}`} position={pos as [number, number, number]}>
          <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.04, 0.05, 0.15, 6]} /><meshStandardMaterial color="#E8DCC8" roughness={0.9} metalness={0} /></mesh>
          <mesh position={[0, 0.2, 0]}><sphereGeometry args={[0.1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={i % 2 === 0 ? "#E85050" : "#FFD166"} roughness={0.8} metalness={0} /></mesh>
        </group>
      ))}
      {/* Banners near HQ */}
      {[[3.5, 0, -7], [-3.5, 0, -7]].map((pos, i) => (
        <group key={`banner-${i}`} position={pos as [number, number, number]}>
          <mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.04, 0.04, 3.2, 8]} /><meshStandardMaterial color={P.trunk} roughness={0.9} metalness={0} /></mesh>
          <mesh position={[0, 2.8, 0]}><planeGeometry args={[0.7, 1]} /><meshStandardMaterial color="#4A6FA5" roughness={0.8} metalness={0} side={THREE.DoubleSide} /></mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Scene ──────────────────────────────────────────────────────
function Scene() {
  const cameraRef = useRef<CameraControls>(null);
  const [playerPos, setPlayerPos] = useState<THREE.Vector3>(new THREE.Vector3(...SPAWN_POSITION));

  const handlePlayerMove = useCallback((position: THREE.Vector3) => {
    setPlayerPos(position);
    cameraRef.current?.moveTo(position.x, position.y + 1.5, position.z, true);
  }, []);

  return (
    <>
      {/* Camera: FOV 50°, polar 55-60° (~1.0 rad), distance 15, locked azimuth */}
      <CameraControls
        ref={cameraRef}
        minPolarAngle={Math.PI / 3.3}
        maxPolarAngle={Math.PI / 3}
        minDistance={15}
        maxDistance={15}
        dollySpeed={0}
        truckSpeed={0}
        makeDefault
      />

      <GradientSky />
      <fog attach="fog" args={[P.fog, 50, 100]} />
      <Lighting />

      <Terrain />
      <River />

      {TREE_POS.map((pos, i) => <Tree key={i} position={pos} seed={i} />)}
      <Bushes />
      <Flowers />

      <Suspense fallback={null}>
        <Clouds material={THREE.MeshBasicMaterial}>
          <Cloud segments={40} bounds={[12, 2, 12]} volume={6} color="#FFFFFF" position={[-12, 25, -10]} opacity={0.6} speed={0.1} />
          <Cloud segments={30} bounds={[8, 2, 8]} volume={4} color="#FFF8F0" position={[14, 28, 12]} opacity={0.45} speed={0.15} />
          <Cloud segments={25} bounds={[6, 2, 6]} volume={3} color="#FFFFFF" position={[0, 30, 25]} opacity={0.5} speed={0.08} />
        </Clouds>
        <Props />
      </Suspense>

      {BUILDINGS.map((b) => (
        <Building key={b.id} id={b.id} name={b.name} position={b.position} size={b.size} color={b.color} roofColor={b.roofColor} href={b.href} playerPosition={playerPos} />
      ))}

      <PlayerAvatar spawnPosition={SPAWN_POSITION} onMove={handlePlayerMove} />
    </>
  );
}

// ─── Canvas (v2 spec Section 2) ─────────────────────────────────
export default function GameWorld() {
  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: P.skyBottom }}>
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
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
