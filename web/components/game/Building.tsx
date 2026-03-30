"use client";

import { useState, useEffect, useRef } from "react";
import { Html } from "@react-three/drei";
import { useRouter } from "next/navigation";
import * as THREE from "three";

const INTERACT_RANGE = 4;

/**
 * Animal Crossing style building — rounded, colorful, cozy
 */
function ACBuilding({
  size,
  color,
}: {
  size: [number, number, number];
  color: string;
}) {
  const [sx, sy, sz] = size;
  const roofHeight = sy * 0.4;

  return (
    <group>
      {/* Walls */}
      <mesh position={[0, sy / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[sx, sy, sz]} />
        <meshLambertMaterial color={color} />
      </mesh>

      {/* Roof */}
      <mesh position={[0, sy + roofHeight / 2 - 0.1, 0]} castShadow>
        <coneGeometry args={[Math.max(sx, sz) * 0.75, roofHeight, 4]} />
        <meshLambertMaterial color={new THREE.Color(color).multiplyScalar(0.6)} />
      </mesh>

      {/* Door */}
      <mesh position={[0, 0.6, sz / 2 + 0.01]}>
        <planeGeometry args={[0.8, 1.2]} />
        <meshLambertMaterial color="#5a3a1a" />
      </mesh>

      {/* Windows */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (sx * 0.3), sy * 0.55, sz / 2 + 0.01]}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshLambertMaterial color="#a8d8ea" emissive="#ffeecc" emissiveIntensity={0.15} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Board/sign — for Bounty Board, Job Board etc.
 */
function BoardSign({
  size,
  color,
}: {
  size: [number, number, number];
  color: string;
}) {
  const [sx, sy] = size;

  return (
    <group>
      {/* Posts */}
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x * sx * 0.6, sy / 2, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, sy, 8]} />
          <meshLambertMaterial color="#6b5a3a" />
        </mesh>
      ))}
      {/* Board */}
      <mesh position={[0, sy * 0.65, 0]} castShadow>
        <boxGeometry args={[sx, sy * 0.5, 0.15]} />
        <meshLambertMaterial color={color} />
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
  href?: string;
  playerPosition: THREE.Vector3;
}

export default function Building({
  id,
  name,
  position,
  size,
  color,
  href,
  playerPosition,
}: BuildingProps) {
  const router = useRouter();
  const [isNear, setIsNear] = useState(false);
  const buildingCenter = useRef(new THREE.Vector3(...position));

  const dist = buildingCenter.current.distanceTo(playerPosition);
  const near = dist < INTERACT_RANGE;

  useEffect(() => {
    setIsNear(near);
  }, [near]);

  useEffect(() => {
    if (!isNear) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "e" && href) {
        router.push(href);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isNear, href, router]);

  const isBoard = size[2] < 1;

  return (
    <group position={position}>
      {isBoard ? (
        <BoardSign size={size} color={color} />
      ) : (
        <ACBuilding size={size} color={color} />
      )}

      {/* Building label */}
      <Html
        position={[0, size[1] + 1.8, 0]}
        center
        distanceFactor={12}
        style={{ pointerEvents: "none" }}
      >
        <div
          className="whitespace-nowrap font-mono"
          style={{
            fontSize: "13px",
            color: "#2a2a2a",
            background: "rgba(255, 255, 255, 0.85)",
            padding: "3px 10px",
            borderRadius: "6px",
            fontWeight: 600,
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }}
        >
          {name}
        </div>
      </Html>

      {/* Interaction prompt */}
      {isNear && (
        <Html position={[0, size[1] + 0.8, 0]} center style={{ pointerEvents: "none" }}>
          <div
            className="whitespace-nowrap animate-bounce"
            style={{
              fontSize: "14px",
              color: "#ffffff",
              background: "#4a6fa5",
              padding: "5px 14px",
              borderRadius: "8px",
              fontWeight: 600,
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            }}
          >
            Press{" "}
            <kbd className="font-mono font-bold" style={{ color: "#ffdd99" }}>
              E
            </kbd>{" "}
            to {isBoard ? "view" : "enter"}
          </div>
        </Html>
      )}
    </group>
  );
}
