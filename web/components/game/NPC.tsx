"use client";

import { useRef, useState, useMemo } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";
import type { NPCPersona } from "@/lib/game/contentTypes";

/**
 * NPC (sprint D5) — placeholder billboard quad for a non-player character.
 *
 * Renders a colored quad facing the camera at the given XZ position,
 * sampled onto the terrain height. Click fires onClick (GameWorld wires
 * this to setActiveNPC, which opens the D4 chat overlay).
 *
 * Real sprites swap in by replacing the quad material with a textured plane
 * once `persona.sprite_url` is populated. Until then we hue-hash the slug so
 * each NPC has a distinct, stable color across sessions.
 */

interface NPCProps {
  persona: NPCPersona;
  position: [number, number, number];
  onClick: () => void;
}

const QUAD_WIDTH = 1.2;
const QUAD_HEIGHT = 1.6;
const NAMEPLATE_OFFSET = QUAD_HEIGHT / 2 + 0.5;

// Hue from slug → consistent color per NPC, deterministic across sessions.
function slugToHue(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) % 360;
  }
  return Math.abs(h);
}

export default function NPC({ persona, position, onClick }: NPCProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Ground-sample y at mount (and lock in). Wander is intentionally skipped
  // this sprint per scope — static NPCs are fine, polish later.
  const grounded: [number, number, number] = useMemo(() => {
    return [position[0], getTerrainHeight(position[0], position[2]), position[2]];
  }, [position]);

  const hue = useMemo(() => slugToHue(persona.slug), [persona.slug]);
  const fillColor = useMemo(() => `hsl(${hue}, 50%, 60%)`, [hue]);
  const rimColor = useMemo(() => `hsl(${hue}, 55%, 35%)`, [hue]);

  // Smooth hover scale via damped lerp in useFrame.
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const target = hovered ? 1.05 : 1;
    const next = THREE.MathUtils.damp(meshRef.current.scale.x, target, 12, delta);
    meshRef.current.scale.set(next, next, next);
  });

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  };
  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = "auto";
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <group ref={groupRef} position={grounded}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        {/* Rim (slightly larger, darker — sits behind fill) */}
        <mesh position={[0, QUAD_HEIGHT / 2, -0.001]}>
          <planeGeometry args={[QUAD_WIDTH + 0.08, QUAD_HEIGHT + 0.08]} />
          <meshBasicMaterial
            color={rimColor}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {/* Fill quad — clickable */}
        <mesh
          ref={meshRef}
          position={[0, QUAD_HEIGHT / 2, 0]}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <planeGeometry args={[QUAD_WIDTH, QUAD_HEIGHT]} />
          <meshBasicMaterial
            color={fillColor}
            transparent
            opacity={hovered ? 1 : 0.95}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </Billboard>

      {/* Ground shadow disc — keeps NPCs grounded visually */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[QUAD_WIDTH * 0.45, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} depthWrite={false} />
      </mesh>

      {/* Nameplate */}
      <Html
        position={[0, NAMEPLATE_OFFSET + QUAD_HEIGHT, 0]}
        center
        style={{ pointerEvents: "none" }}
        distanceFactor={10}
      >
        <div
          className="whitespace-nowrap text-center"
          style={{
            background: "rgba(15, 15, 16, 0.7)",
            padding: "2px 8px",
            borderRadius: "4px",
            border: hovered ? "1px solid rgba(255,255,255,0.4)" : "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#f1ffff",
              fontFamily: "'IBM Plex Mono', monospace",
              lineHeight: 1.2,
            }}
          >
            {persona.display_name}
          </div>
        </div>
      </Html>
    </group>
  );
}
