"use client";

import { Suspense, useRef, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import * as THREE from "three";
import PS1Effect from "./PS1Pipeline";
import PlayerAvatar from "./PlayerAvatar";
import Building from "./Building";

/**
 * Building config — positions from specs/ux-game-world.md Section 4.1
 * modelPath references real FBX files in public/assets/buildings/
 */
const BUILDINGS = [
  {
    id: "hq",
    name: "HQ",
    position: [0, 0, 0] as [number, number, number],
    size: [4, 3, 4] as [number, number, number],
    color: "#1a3a5c",
    modelPath: "/assets/buildings/hq.fbx",
    modelScale: 0.02,
    href: undefined,
  },
  {
    id: "shop",
    name: "Shop",
    position: [-15, 0, 10] as [number, number, number],
    size: [3, 2.5, 3] as [number, number, number],
    color: "#5c4a1a",
    modelPath: "/assets/buildings/shop.fbx",
    modelScale: 0.02,
    href: "/student/dashboard/shop",
  },
  {
    id: "oracle",
    name: "Oracle Temple",
    position: [0, 0, 25] as [number, number, number],
    size: [3.5, 4, 3.5] as [number, number, number],
    color: "#3a1a5c",
    modelPath: "/assets/buildings/oracle_temple.fbx",
    modelScale: 0.02,
    href: undefined,
  },
  {
    id: "house",
    name: "House",
    position: [15, 0, 15] as [number, number, number],
    size: [3, 2.5, 3] as [number, number, number],
    color: "#4a3a2a",
    modelPath: "/assets/buildings/house_1.fbx",
    modelScale: 0.02,
    href: undefined,
  },
  {
    id: "bounty",
    name: "Bounty Board",
    position: [15, 0, 10] as [number, number, number],
    size: [1.5, 2, 0.3] as [number, number, number],
    color: "#5c2a1a",
    href: "/student/dashboard/bounty",
  },
  {
    id: "jobs",
    name: "Job Board",
    position: [-12, 0, -12] as [number, number, number],
    size: [1.5, 2, 0.3] as [number, number, number],
    color: "#1a5c3a",
    href: "/student/dashboard/jobs",
  },
  {
    id: "leaderboard",
    name: "Leaderboard",
    position: [12, 0, -12] as [number, number, number],
    size: [1.5, 3, 1.5] as [number, number, number],
    color: "#5c5c1a",
    href: "/student/dashboard/leaderboard",
  },
];

const SPAWN_POSITION: [number, number, number] = [0, 0, -20];

function Terrain() {
  return (
    <group>
      {/* Main grass plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#2d5a27" roughness={1} />
      </mesh>
      {/* North-South main path */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[3, 50]} />
        <meshStandardMaterial color="#6b6358" roughness={0.9} />
      </mesh>
      {/* East-West path (upper) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 10]}>
        <planeGeometry args={[35, 3]} />
        <meshStandardMaterial color="#6b6358" roughness={0.9} />
      </mesh>
      {/* East-West path (lower) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -12]}>
        <planeGeometry args={[28, 3]} />
        <meshStandardMaterial color="#6b6358" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Lighting() {
  return (
    <>
      <ambientLight color="#ffffff" intensity={0.4} />
      <directionalLight
        color="#ffeedd"
        intensity={0.8}
        position={[20, 30, 10]}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Warm lamps near building entrances */}
      <pointLight color="#ffcc88" intensity={0.6} distance={8} position={[0, 2, -2]} />
      <pointLight color="#ffcc88" intensity={0.6} distance={8} position={[-15, 2, 8]} />
      <pointLight color="#ffcc88" intensity={0.6} distance={8} position={[0, 2, 23]} />
      {/* HQ — subtle blue glow */}
      <pointLight color="#002fa7" intensity={0.3} distance={6} position={[0, 3, -1]} />
    </>
  );
}

/* Props are placeholder meshes for now — real assets will replace them later */

function Decorations() {
  // Placeholder trees (swap for Kenney Nature Kit when available)
  const treePositions: [number, number, number][] = [
    [-8, 0, 20], [8, 0, 20], [-20, 0, 5], [20, 0, 5],
    [-18, 0, -8], [18, 0, -8], [-6, 0, -22], [6, 0, -22],
    [-25, 0, 15], [25, 0, 15], [-12, 0, 22], [12, 0, 22],
  ];

  // Lamppost positions
  const lampPositions: [number, number, number][] = [
    [1.5, 0, -8], [-1.5, 0, 4], [1.5, 0, 16],
  ];

  return (
    <group>
      {/* Trees — placeholder geometry */}
      {treePositions.map((pos, i) => (
        <group key={`tree-${i}`} position={pos}>
          <mesh position={[0, 0.75, 0]}>
            <cylinderGeometry args={[0.15, 0.2, 1.5, 6]} />
            <meshStandardMaterial color="#5c3a1a" roughness={1} />
          </mesh>
          <mesh position={[0, 2, 0]}>
            <coneGeometry args={[1.2, 2, 6]} />
            <meshStandardMaterial color="#1a4a1a" roughness={1} />
          </mesh>
        </group>
      ))}

      {/* Real props from assets */}
      <Suspense fallback={null}>
        {/* Benches along paths (placeholder meshes) */}
        {[[-3, 0, -5], [3, 0, -5], [-3, 0, 5], [3, 0, 5]].map((pos, i) => (
          <mesh key={`bench-${i}`} position={pos as [number, number, number]} castShadow>
            <boxGeometry args={[1.2, 0.4, 0.5]} />
            <meshStandardMaterial color="#8B6914" />
          </mesh>
        ))}

        {/* Banners near HQ (placeholder meshes) */}
        {[[3, 0, -1], [-3, 0, -1]].map((pos, i) => (
          <group key={`banner-${i}`} position={pos as [number, number, number]}>
            <mesh position={[0, 1.5, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 3, 6]} />
              <meshStandardMaterial color="#5c3a1a" />
            </mesh>
            <mesh position={[0, 2.5, 0]}>
              <planeGeometry args={[0.6, 0.8]} />
              <meshStandardMaterial color="#002fa7" side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}

        {/* Torch lights near Oracle (placeholder point lights) */}
        <pointLight position={[-2, 1.5, 24]} color="#ffcc88" intensity={0.8} distance={6} />
        <pointLight position={[2, 1.5, 24]} color="#ffcc88" intensity={0.8} distance={6} />
      </Suspense>

      {/* Lampposts with lights */}
      {lampPositions.map((pos, i) => (
        <group key={`lamp-${i}`} position={pos}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 3, 6]} />
            <meshStandardMaterial color="#4a4a4a" roughness={0.8} />
          </mesh>
          <mesh position={[0, 3.2, 0]}>
            <sphereGeometry args={[0.2, 6, 6]} />
            <meshStandardMaterial color="#ffcc88" emissive="#ffcc88" emissiveIntensity={0.5} />
          </mesh>
          <pointLight color="#ffcc88" intensity={0.3} distance={5} position={[0, 3.2, 0]} />
        </group>
      ))}
    </group>
  );
}

function Scene() {
  const cameraControlsRef = useRef<CameraControls>(null);
  const [playerPos, setPlayerPos] = useState<THREE.Vector3>(
    new THREE.Vector3(...SPAWN_POSITION)
  );

  const handlePlayerMove = useCallback((position: THREE.Vector3) => {
    setPlayerPos(position);
    if (cameraControlsRef.current) {
      cameraControlsRef.current.moveTo(position.x, position.y + 2, position.z, true);
    }
  }, []);

  return (
    <>
      <PS1Effect />

      {/* Camera — isometric-ish, locked polar 45deg, FOV 35deg */}
      <CameraControls
        ref={cameraControlsRef}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 4}
        minDistance={20}
        maxDistance={20}
        dollySpeed={0}
        truckSpeed={0}
        makeDefault
      />

      {/* Fog — fades to bg-main color at edges */}
      <fog attach="fog" args={["#0f0f10", 60, 120]} />

      <Lighting />
      <Terrain />

      <Suspense fallback={null}>
        <Decorations />
      </Suspense>

      {/* Buildings */}
      {BUILDINGS.map((b) => (
        <Building
          key={b.id}
          id={b.id}
          name={b.name}
          position={b.position}
          size={b.size}
          color={b.color}
          modelPath={b.modelPath}
          modelScale={b.modelScale}
          href={b.href}
          playerPosition={playerPos}
        />
      ))}

      {/* Player */}
      <PlayerAvatar spawnPosition={SPAWN_POSITION} onMove={handlePlayerMove} />
    </>
  );
}

export default function GameWorld() {
  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#0f0f10" }}>
      <Canvas
        dpr={0.35}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        camera={{ fov: 35, near: 0.1, far: 200, position: [0, 15, -35] }}
        style={{ imageRendering: "pixelated" }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
