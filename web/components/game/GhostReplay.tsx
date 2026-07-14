"use client";

import { useMemo } from "react";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";
import { clampToCoast } from "@/lib/game/coast";
import type { GhostPosition } from "@/lib/game/useGhostPositions";

/**
 * GhostReplay (sprint E5) — semi-transparent stand-in for members who
 * were recently in the world. Renders at their most-recent recorded
 * position from the last 24h. Static (no drift) this sprint; polish later.
 */

const QUAD_WIDTH = 1.2;
const QUAD_HEIGHT = 1.6;

function userIdToHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return Math.abs(h);
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "moments ago";
  if (hours < 24) return `${hours}h ago`;
  return "1d ago";
}

export default function GhostReplay({ ghost }: { ghost: GhostPosition }) {
  const grounded = useMemo<[number, number, number]>(() => {
    // Positions recorded before the organic coast (or near the old square
    // clamp's corners) can sit past the new shoreline — pull them back in.
    const [gx, gz] = clampToCoast(ghost.world_x, ghost.world_z, 50.6);
    return [gx, getTerrainHeight(gx, gz), gz];
  }, [ghost.world_x, ghost.world_z]);

  const hue = useMemo(() => userIdToHue(ghost.user_id), [ghost.user_id]);
  // Desaturated vs NPC (50% → 20%) so ghosts read as faded/past.
  const fillColor = useMemo(() => `hsl(${hue}, 20%, 55%)`, [hue]);
  const subtitle = useMemo(() => `last seen ${relativeTime(ghost.recorded_at)}`, [ghost.recorded_at]);

  return (
    <group position={grounded}>
      <Billboard follow>
        <mesh position={[0, QUAD_HEIGHT / 2, 0]}>
          <planeGeometry args={[QUAD_WIDTH, QUAD_HEIGHT]} />
          <meshBasicMaterial
            color={fillColor}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
      <Html zIndexRange={[40, 0]}
        position={[0, QUAD_HEIGHT + 0.6, 0]}
        center
        style={{ pointerEvents: "none" }}
        distanceFactor={10}
      >
        <div
          style={{
            background: "rgba(15, 15, 16, 0.55)",
            padding: "2px 6px",
            borderRadius: "3px",
            opacity: 0.7,
            fontFamily: "'IBM Plex Mono', monospace",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "11px", color: "#c9d1d6", lineHeight: 1.2 }}>
            {ghost.display_name}
          </div>
          <div style={{ fontSize: "9px", color: "#8a939a", lineHeight: 1.2 }}>
            {subtitle}
          </div>
        </div>
      </Html>
    </group>
  );
}
