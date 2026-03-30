"use client";

import { Suspense, useRef, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import * as THREE from "three";
import PlayerAvatar from "./PlayerAvatar";
import Building from "./Building";

/**
 * Building config — Animal Crossing style village layout
 */
const BUILDINGS = [
  {
    id: "hq",
    name: "HQ",
    position: [0, 0, 0] as [number, number, number],
    size: [5, 3.5, 5] as [number, number, number],
    color: "#4a6fa5",
    roofColor: "#2c3e6b",
    href: undefined,
  },
  {
    id: "shop",
    name: "Shop",
    position: [-14, 0, 10] as [number, number, number],
    size: [4, 3, 4] as [number, number, number],
    color: "#c9a96e",
    roofColor: "#8b6914",
    href: "/student/dashboard/shop",
  },
  {
    id: "oracle",
    name: "Oracle Temple",
    position: [0, 0, 22] as [number, number, number],
    size: [4.5, 4, 4.5] as [number, number, number],
    color: "#7b5ea7",
    roofColor: "#4a2d6b",
    href: undefined,
  },
  {
    id: "house",
    name: "House",
    position: [14, 0, 14] as [number, number, number],
    size: [3.5, 2.8, 3.5] as [number, number, number],
    color: "#a8c4a0",
    roofColor: "#5a7a52",
    href: undefined,
  },
  {
    id: "bounty",
    name: "Bounty Board",
    position: [10, 0, -2] as [number, number, number],
    size: [1.5, 2, 0.3] as [number, number, number],
    color: "#8b5e3c",
    href: "/student/dashboard/bounty",
  },
  {
    id: "jobs",
    name: "Job Board",
    position: [-10, 0, -10] as [number, number, number],
    size: [1.5, 2, 0.3] as [number, number, number],
    color: "#3c7a5e",
    href: "/student/dashboard/jobs",
  },
  {
    id: "leaderboard",
    name: "Leaderboard",
    position: [10, 0, -10] as [number, number, number],
    size: [1.5, 3, 1.5] as [number, number, number],
    color: "#c4a82a",
    roofColor: "#8b7a1a",
    href: "/student/dashboard/leaderboard",
  },
];

const SPAWN_POSITION: [number, number, number] = [0, 0, -15];

function Terrain() {
  return (
    <group>
      {/* Main grass — base layer */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshLambertMaterial color="#5da34e" />
      </mesh>

      {/* Lighter grass patches — polygonOffset to avoid z-fighting */}
      {[[-10, 0, -15], [12, 0, 18], [-18, 0, 20], [20, 0, -5]].map((pos, i) => (
        <mesh key={`grass-patch-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={pos as [number, number, number]}>
          <circleGeometry args={[6, 16]} />
          <meshLambertMaterial color="#6bbf5a" polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
      ))}

      {/* Path borders — rendered below paths */}
      {[[0, 0, 0, 4.2, 50], [0, 0, 10, 35, 4.2], [0, 0, -10, 25, 4.2]].map(([x, y, z, w, h], i) => (
        <mesh key={`border-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, y, z] as [number, number, number]}>
          <planeGeometry args={[w, h]} />
          <meshLambertMaterial color="#b8a878" polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      ))}

      {/* Paths — on top of borders */}
      {[[0, 0, 0, 3.5, 50], [0, 0, 10, 35, 3.5], [0, 0, -10, 25, 3.5]].map(([x, y, z, w, h], i) => (
        <mesh key={`path-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, y, z] as [number, number, number]}>
          <planeGeometry args={[w, h]} />
          <meshLambertMaterial color="#d4c5a0" polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
      ))}

      {/* Pond border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8, 0, 20]}>
        <circleGeometry args={[3.4, 24]} />
        <meshLambertMaterial color="#3a7a90" polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      {/* Pond water */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8, 0, 20]}>
        <circleGeometry args={[3, 24]} />
        <meshLambertMaterial color="#4a8fa8" polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
      </mesh>
    </group>
  );
}

function Lighting() {
  return (
    <>
      {/* Bright ambient — Animal Crossing is well-lit */}
      <ambientLight color="#f0f0ff" intensity={0.7} />
      {/* Warm sun */}
      <directionalLight
        color="#fff5e0"
        intensity={1.0}
        position={[20, 40, 20]}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={80}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      {/* Fill light from opposite side */}
      <directionalLight color="#c0d0ff" intensity={0.3} position={[-15, 20, -10]} />
    </>
  );
}

function Trees() {
  const positions: [number, number, number][] = [
    [-8, 0, 18], [8, 0, 25], [-20, 0, 5], [20, 0, 5],
    [-18, 0, -6], [18, 0, -6], [-6, 0, -20], [6, 0, -20],
    [-24, 0, 15], [24, 0, 15], [-12, 0, 24], [16, 0, 24],
    [-22, 0, -15], [22, 0, -15], [-15, 0, -18], [15, 0, 18],
  ];

  return (
    <group>
      {positions.map((pos, i) => {
        const scale = 0.8 + Math.random() * 0.5;
        const treeType = i % 3;
        return (
          <group key={`tree-${i}`} position={pos} scale={scale}>
            {/* Trunk */}
            <mesh position={[0, 0.8, 0]} castShadow>
              <cylinderGeometry args={[0.15, 0.25, 1.6, 8]} />
              <meshLambertMaterial color="#8B6914" />
            </mesh>
            {/* Foliage — round for AC feel */}
            {treeType === 0 ? (
              // Round tree
              <mesh position={[0, 2.4, 0]} castShadow>
                <sphereGeometry args={[1.4, 12, 10]} />
                <meshLambertMaterial color="#3a8a3a" />
              </mesh>
            ) : treeType === 1 ? (
              // Bushy tree — two spheres
              <group>
                <mesh position={[0, 2.2, 0]} castShadow>
                  <sphereGeometry args={[1.2, 10, 8]} />
                  <meshLambertMaterial color="#2d7a2d" />
                </mesh>
                <mesh position={[0, 3.2, 0]} castShadow>
                  <sphereGeometry args={[0.9, 10, 8]} />
                  <meshLambertMaterial color="#3a9a3a" />
                </mesh>
              </group>
            ) : (
              // Pine tree
              <group>
                <mesh position={[0, 1.8, 0]} castShadow>
                  <coneGeometry args={[1.3, 1.8, 8]} />
                  <meshLambertMaterial color="#2a6a2a" />
                </mesh>
                <mesh position={[0, 2.8, 0]} castShadow>
                  <coneGeometry args={[1.0, 1.6, 8]} />
                  <meshLambertMaterial color="#2d7d2d" />
                </mesh>
                <mesh position={[0, 3.6, 0]} castShadow>
                  <coneGeometry args={[0.7, 1.2, 8]} />
                  <meshLambertMaterial color="#3a8a3a" />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

function Decorations() {
  return (
    <group>
      {/* Flowers scattered around */}
      {[[-5, 0.1, -3], [5, 0.1, 7], [-8, 0.1, 13], [12, 0.1, -5], [-3, 0.1, 16], [7, 0.1, -14]].map((pos, i) => {
        const colors = ["#ff6b8a", "#ffb347", "#87ceeb", "#dda0dd", "#f0e68c", "#ff69b4"];
        return (
          <group key={`flower-${i}`} position={pos as [number, number, number]}>
            {[0, 1, 2].map((j) => (
              <mesh key={j} position={[(j - 1) * 0.4, 0.15, (j % 2) * 0.3]}>
                <sphereGeometry args={[0.12, 6, 6]} />
                <meshLambertMaterial color={colors[(i + j) % colors.length]} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Benches */}
      {[[-3, 0, -5], [3, 0, -5], [-3, 0, 5], [3, 0, 5]].map((pos, i) => (
        <group key={`bench-${i}`} position={pos as [number, number, number]}>
          {/* Seat */}
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[1.4, 0.1, 0.5]} />
            <meshLambertMaterial color="#c49a6c" />
          </mesh>
          {/* Back */}
          <mesh position={[0, 0.7, -0.2]} castShadow>
            <boxGeometry args={[1.4, 0.5, 0.08]} />
            <meshLambertMaterial color="#c49a6c" />
          </mesh>
          {/* Legs */}
          {[-0.55, 0.55].map((x, j) => (
            <mesh key={j} position={[x, 0.2, 0]} castShadow>
              <boxGeometry args={[0.08, 0.4, 0.5]} />
              <meshLambertMaterial color="#8B6914" />
            </mesh>
          ))}
        </group>
      ))}

      {/* Lampposts */}
      {[[1.5, 0, -7], [-1.5, 0, 4], [1.5, 0, 15]].map((pos, i) => (
        <group key={`lamp-${i}`} position={pos as [number, number, number]}>
          <mesh position={[0, 1.8, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 3.6, 8]} />
            <meshLambertMaterial color="#3a3a3a" />
          </mesh>
          {/* Lamp head */}
          <mesh position={[0, 3.8, 0]}>
            <boxGeometry args={[0.5, 0.4, 0.5]} />
            <meshLambertMaterial color="#f5e6c8" emissive="#ffcc88" emissiveIntensity={0.3} />
          </mesh>
          <pointLight color="#ffdd99" intensity={0.5} distance={8} position={[0, 3.5, 0]} />
        </group>
      ))}

      {/* Banners near HQ */}
      {[[4, 0, -2], [-4, 0, -2]].map((pos, i) => (
        <group key={`banner-${i}`} position={pos as [number, number, number]}>
          <mesh position={[0, 1.8, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 3.6, 8]} />
            <meshLambertMaterial color="#6b5a3a" />
          </mesh>
          <mesh position={[0, 3, 0]}>
            <planeGeometry args={[0.7, 1]} />
            <meshLambertMaterial color="#4a6fa5" side={THREE.DoubleSide} />
          </mesh>
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
      {/* Camera — isometric-ish, locked polar angle */}
      <CameraControls
        ref={cameraControlsRef}
        minPolarAngle={Math.PI / 4.5}
        maxPolarAngle={Math.PI / 4.5}
        minDistance={22}
        maxDistance={22}
        dollySpeed={0}
        truckSpeed={0}
        makeDefault
      />

      {/* Sky color */}
      <color attach="background" args={["#87ceeb"]} />

      {/* Soft fog at edges */}
      <fog attach="fog" args={["#c0dff0", 50, 90]} />

      <Lighting />
      <Terrain />
      <Trees />

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
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: "#87ceeb" }}>
      <Canvas
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 40, near: 0.1, far: 200, position: [0, 18, -30] }}
        shadows
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
