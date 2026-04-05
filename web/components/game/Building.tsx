"use client";

import { Suspense, useState, useEffect, useRef, useMemo } from "react";
import { Html, useGLTF } from "@react-three/drei";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { useTransition } from "./TransitionOverlay";

const INTERACT_RANGE = 4;

// ─── GLB model paths for buildings with real 3D assets ──────────
const GLB_PATHS: Record<string, string> = {
  hq: "/assets/buildings/hq.glb",
  shop: "/assets/buildings/shop.glb",
  oracle: "/assets/buildings/oracle_temple.glb",
  house: "/assets/buildings/house_1.glb",
};

/**
 * Loads a real GLB model, auto-scales to fit expected dimensions,
 * and overrides materials with AC palette colors.
 */
function GLBBuilding({ id, size, color }: { id: string; size: [number, number, number]; color: string }) {
  const { scene } = useGLTF(GLB_PATHS[id]);

  const cloned = useMemo(() => {
    const clone = scene.clone(true);

    // Auto-scale to fit the expected bounding box
    const box = new THREE.Box3().setFromObject(clone);
    const modelSize = new THREE.Vector3();
    box.getSize(modelSize);
    const maxModel = Math.max(modelSize.x, modelSize.y, modelSize.z);
    const maxTarget = Math.max(size[0], size[1], size[2]);
    if (maxModel > 0) clone.scale.setScalar(maxTarget / maxModel);

    // Re-center horizontally, ground at y=0
    box.setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const min = box.min;
    clone.position.set(-center.x, -min.y, -center.z);

    // Override materials with AC palette
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color, roughness: 0.85, metalness: 0,
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    return clone;
  }, [scene, color, size]);

  return <primitive object={cloned} />;
}

/**
 * AC-style building per specs/ux-game-world-v2.md Section 6.
 * Pastel walls, bold roof with overhang, oversized door, arched windows,
 * chimney, flower boxes, awning. MeshStandardMaterial throughout.
 */
function ACBuilding({ size, color, roofColor: roofColorProp }: { size: [number, number, number]; color: string; roofColor?: string }) {
  const [sx, sy, sz] = size;
  const roofH = sy * 0.45;
  const roofColor = roofColorProp ? new THREE.Color(roofColorProp) : new THREE.Color(color).multiplyScalar(0.55);

  return (
    <group>
      {/* Walls */}
      <mesh position={[0, sy / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
      </mesh>
      {/* Roof with overhang */}
      <mesh position={[0, sy + roofH / 2 - 0.1, 0]} castShadow>
        <coneGeometry args={[Math.max(sx, sz) * 0.78, roofH, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.85} metalness={0} />
      </mesh>
      {/* Chimney — v2 spec: #C4A265 */}
      <mesh position={[sx * 0.25, sy + roofH * 0.4, -sz * 0.2]} castShadow>
        <boxGeometry args={[0.4, 0.6, 0.4]} />
        <meshStandardMaterial color="#C4A265" roughness={0.9} metalness={0} />
      </mesh>
      {/* Door frame — #6B4226 */}
      <mesh position={[0, 0.7, sz / 2 + 0.01]}>
        <planeGeometry args={[1.2, 1.6]} />
        <meshStandardMaterial color="#6B4226" roughness={0.9} metalness={0} />
      </mesh>
      {/* Door — #8B5E3C, oversized */}
      <mesh position={[0, 0.7, sz / 2 + 0.02]}>
        <planeGeometry args={[1.0, 1.4]} />
        <meshStandardMaterial color="#8B5E3C" roughness={0.85} metalness={0} />
      </mesh>
      {/* Windows — #B8E4F0 glass, #FFFFFF frame */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * (sx * 0.3), sy * 0.55, sz / 2 + 0.01]}>
            <planeGeometry args={[0.65, 0.65]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.9} metalness={0} />
          </mesh>
          <mesh position={[side * (sx * 0.3), sy * 0.55, sz / 2 + 0.02]}>
            <planeGeometry args={[0.5, 0.5]} />
            <meshStandardMaterial color="#B8E4F0" roughness={0.4} metalness={0} emissive="#FFE4B0" emissiveIntensity={0.12} />
          </mesh>
        </group>
      ))}
      {/* Awning over door */}
      <mesh position={[0, 1.55, sz / 2 + 0.3]} rotation={[0.3, 0, 0]} castShadow>
        <planeGeometry args={[1.6, 0.5]} />
        <meshStandardMaterial color={roofColor} roughness={0.85} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* Flower boxes under windows */}
      {[-1, 1].map((side) => (
        <group key={`fb-${side}`} position={[side * (sx * 0.3), sy * 0.25, sz / 2 + 0.15]}>
          <mesh castShadow><boxGeometry args={[0.5, 0.12, 0.15]} /><meshStandardMaterial color="#8B6B4A" roughness={0.9} metalness={0} /></mesh>
          {[-0.15, 0, 0.15].map((dx, i) => (
            <mesh key={i} position={[dx, 0.12, 0]}><sphereGeometry args={[0.06, 6, 6]} /><meshStandardMaterial color={i === 1 ? "#FFD166" : "#FF8CB0"} roughness={0.8} metalness={0} /></mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * Board/sign — wooden notice board with roof per v2 spec Section 6.4.
 */
function BoardSign({ size, color }: { size: [number, number, number]; color: string }) {
  const [sx, sy] = size;
  return (
    <group>
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x * sx * 0.6, sy / 2, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, sy, 8]} />
          <meshStandardMaterial color="#8B6B4A" roughness={0.9} metalness={0} />
        </mesh>
      ))}
      <mesh position={[0, sy * 0.65, 0]} castShadow>
        <boxGeometry args={[sx, sy * 0.5, 0.15]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
      </mesh>
      {/* Small roof */}
      <mesh position={[0, sy * 0.95, 0]} castShadow>
        <boxGeometry args={[sx * 1.2, 0.08, 0.35]} />
        <meshStandardMaterial color="#8B6B4A" roughness={0.9} metalness={0} />
      </mesh>
      {/* Pinned notes (colored rectangles) */}
      {[-0.3, 0, 0.3].map((x, i) => (
        <mesh key={i} position={[x, sy * 0.65 + (i - 1) * 0.08, 0.09]} rotation={[0, 0, (i - 1) * 0.15]}>
          <planeGeometry args={[0.25, 0.3]} />
          <meshStandardMaterial color={["#FFD166", "#FF8CB0", "#6BA3D6"][i]} roughness={0.8} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Leaderboard monument — v2 spec Section 6.6.
 */
function LeaderboardMonument({ size, color }: { size: [number, number, number]; color: string }) {
  const [sx, sy] = size;
  return (
    <group>
      {/* Stone base */}
      <mesh position={[0, sy * 0.3, 0]} castShadow>
        <cylinderGeometry args={[sx * 0.5, sx * 0.6, sy * 0.6, 8]} />
        <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
      </mesh>
      {/* Column */}
      <mesh position={[0, sy * 0.6, 0]} castShadow>
        <cylinderGeometry args={[sx * 0.3, sx * 0.35, sy * 0.5, 8]} />
        <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
      </mesh>
      {/* Gold trophy */}
      <mesh position={[0, sy * 0.9, 0]} castShadow>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial color="#FFD166" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Plaques */}
      {[-0.2, 0, 0.2].map((y, i) => (
        <mesh key={i} position={[sx * 0.5 + 0.01, sy * 0.25 + y, 0]}>
          <planeGeometry args={[0.3, 0.12]} />
          <meshStandardMaterial color={["#FFD166", "#C0C0C0", "#CD7F32"][i]} roughness={0.5} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

interface BuildingProps {
  id: string;
  name: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  roofColor?: string;
  href?: string;
  playerPosition: THREE.Vector3;
}

export default function Building({ id, name, position, size, color, roofColor, href, playerPosition }: BuildingProps) {
  const router = useRouter();
  const { triggerTransition, isTransitioning } = useTransition();
  const isNear = useMemo(() => {
    return new THREE.Vector3(...position).distanceTo(playerPosition) < INTERACT_RANGE;
  }, [position, playerPosition]);

  useEffect(() => {
    if (!isNear || isTransitioning) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "e" && href) {
        if (size[2] < 1) { router.push(href); }
        else { triggerTransition(() => { router.push(href); }); }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isNear, isTransitioning, href, router, triggerTransition, size]);

  const isBoard = size[2] < 1;
  const isLeaderboard = id === "leaderboard";
  const hasGLB = id in GLB_PATHS;

  return (
    <group position={position}>
      {isBoard ? (
        <BoardSign size={size} color={color} />
      ) : isLeaderboard ? (
        <LeaderboardMonument size={size} color={color} />
      ) : hasGLB ? (
        <Suspense fallback={<ACBuilding size={size} color={color} roofColor={roofColor} />}>
          <GLBBuilding id={id} size={size} color={color} />
        </Suspense>
      ) : (
        <ACBuilding size={size} color={color} roofColor={roofColor} />
      )}

      {/* Label — white pill, dark text */}
      <Html position={[0, size[1] + 1.8, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
        <div style={{ fontSize: "13px", color: "#2a2a2a", background: "rgba(255,255,255,0.88)", padding: "3px 10px", borderRadius: "6px", fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace", boxShadow: "0 1px 4px rgba(0,0,0,0.12)", whiteSpace: "nowrap" }}>
          {name}
        </div>
      </Html>

      {isNear && (
        <Html position={[0, size[1] + 0.8, 0]} center style={{ pointerEvents: "none" }}>
          <div className="animate-bounce" style={{ fontSize: "14px", color: "#fff", background: "#4a6fa5", padding: "5px 14px", borderRadius: "10px", fontWeight: 600, boxShadow: "0 2px 8px rgba(0,0,0,0.2)", whiteSpace: "nowrap" }}>
            Press <kbd style={{ color: "#FFD166", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>E</kbd> to {isBoard ? "view" : "enter"}
          </div>
        </Html>
      )}
    </group>
  );
}
