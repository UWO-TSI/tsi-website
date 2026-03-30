"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { Html, useFBX } from "@react-three/drei";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { useTransition } from "./TransitionOverlay";

const INTERACT_RANGE = 3;

/**
 * Loads an FBX model from public/assets/ and renders it.
 * Applies NearestFilter to all textures for PS1 look.
 */
function FBXModel({ path, scale = 1 }: { path: string; scale?: number }) {
  const fbx = useFBX(path);

  // Apply PS1 texture filtering to all materials
  fbx.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const mat of materials) {
        const stdMat = mat as THREE.MeshStandardMaterial;
        if (stdMat.map) {
          stdMat.map.minFilter = THREE.NearestFilter;
          stdMat.map.magFilter = THREE.NearestFilter;
          stdMat.map.generateMipmaps = false;
        }
        stdMat.roughness = Math.max(stdMat.roughness ?? 0.8, 0.7);
      }
    }
  });

  return <primitive object={fbx} scale={scale} />;
}

/**
 * Placeholder geometry for when FBX model is loading or unavailable.
 */
function PlaceholderBox({
  size,
  color,
  isBoard,
}: {
  size: [number, number, number];
  color: string;
  isBoard: boolean;
}) {
  const [sx, sy, sz] = size;

  if (isBoard) {
    return (
      <group>
        <mesh position={[0, sy / 2, 0]}>
          <cylinderGeometry args={[0.08, 0.08, sy, 6]} />
          <meshStandardMaterial color="#5c4a3a" roughness={0.9} />
        </mesh>
        <mesh position={[0, sy * 0.75, 0]}>
          <boxGeometry args={[sx, sy * 0.6, sz]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      <mesh position={[0, sy / 2, 0]} castShadow>
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, sy + 0.3, 0]}>
        <boxGeometry args={[sx + 0.4, 0.6, sz + 0.4]} />
        <meshStandardMaterial color={color} roughness={0.7} emissive={color} emissiveIntensity={0.05} />
      </mesh>
      <mesh position={[0, 0.6, sz / 2 + 0.01]}>
        <planeGeometry args={[0.8, 1.2]} />
        <meshStandardMaterial color="#2a1a0a" roughness={1} />
      </mesh>
    </group>
  );
}

interface BuildingProps {
  id: string;
  name: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  modelPath?: string;
  modelScale?: number;
  href?: string;
  playerPosition: THREE.Vector3;
}

export default function Building({
  id,
  name,
  position,
  size,
  color,
  modelPath,
  modelScale = 0.01,
  href,
  playerPosition,
}: BuildingProps) {
  const router = useRouter();
  const { triggerTransition, isTransitioning } = useTransition();
  const [isNear, setIsNear] = useState(false);
  const buildingCenter = useRef(new THREE.Vector3(...position));

  const dist = buildingCenter.current.distanceTo(playerPosition);
  const near = dist < INTERACT_RANGE;

  useEffect(() => {
    setIsNear(near);
  }, [near]);

  useEffect(() => {
    if (!isNear || isTransitioning) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "e" && href) {
        // Buildings with interiors: fade-to-black transition
        // Boards/objects: direct navigation (overlay handled at page level)
        const isBoard = size[2] < 1;
        if (isBoard) {
          router.push(href);
        } else {
          triggerTransition(() => {
            router.push(href);
          });
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isNear, isTransitioning, href, router, triggerTransition, size]);

  const isBoard = size[2] < 1;

  return (
    <group position={position}>
      {/* Placeholder geometry — FBX models disabled until textures are bundled properly */}
      <PlaceholderBox size={size} color={color} isBoard={isBoard} />

      {/* Building label */}
      <Html
        position={[0, size[1] + 1.5, 0]}
        center
        distanceFactor={10}
        style={{ pointerEvents: "none" }}
      >
        <div
          className="whitespace-nowrap font-mono"
          style={{
            fontSize: "12px",
            color: "#f1ffff",
            background: "rgba(15, 15, 16, 0.7)",
            padding: "2px 8px",
            borderRadius: "4px",
          }}
        >
          {name}
        </div>
      </Html>

      {/* Interaction prompt */}
      {isNear && (
        <Html position={[0, size[1] + 0.5, 0]} center style={{ pointerEvents: "none" }}>
          <div
            className="whitespace-nowrap animate-pulse"
            style={{
              fontSize: "14px",
              color: "#f1ffff",
              background: "#111827",
              border: "1px solid rgba(241, 255, 255, 0.12)",
              padding: "4px 12px",
              borderRadius: "8px",
              transform: "translateY(-4px)",
            }}
          >
            Press{" "}
            <kbd className="font-mono font-bold" style={{ color: "#22d3ee" }}>
              E
            </kbd>{" "}
            to {isBoard ? "view" : "enter"}
          </div>
        </Html>
      )}
    </group>
  );
}
