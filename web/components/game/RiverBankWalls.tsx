"use client";

/**
 * RiverBankWalls (river v2, 2026-07-14) — crisp ACNH-style banks.
 *
 * The dump's river kit turned out to be cliff-terrain cups (full rims +
 * 11u under-shafts that waffle when assembled on a spline — see
 * AGENT_LOG river-v2 recon). Instead: two procedural ribbons extruded
 * along the actual river spline —
 *   - a dark soil WALL face from just above ground down into the carve
 *   - a grass LIP overhanging the wall toward the water
 * They follow every bend exactly, cost 1 draw call each side-pair, and
 * pair with the lowered water level (River WATER_Y −0.2) + deepened
 * terrain carve for real bank presence.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { sampleRiverPoint } from "./River";
import { riverWidthScale } from "./terrain";

const SEGMENTS = 200; // river v3: dense enough to track the width-profile gradients
const EDGE = 2.1; // wall offset from spline center (past the water ribbon, inside the 2.2 carve)
const WALL_TOP = 0.04;
const WALL_BOTTOM = -1.05; // tucks under the V1 carve floor (-0.95)
const LIP_INNER = 1.62; // lip overhangs from EDGE toward the channel
const LIP_Y = 0.05;
const X_LIMIT = 50.8; // stop at the mouths (waterfalls own the exits)

function buildBankGeometry(): { wall: THREE.BufferGeometry; lip: THREE.BufferGeometry } {
  const wallPos: number[] = [];
  const wallIdx: number[] = [];
  const lipPos: number[] = [];
  const lipIdx: number[] = [];

  for (const side of [-1, 1]) {
    let strip = -1; // index base of the current contiguous strip
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      const { position: p, tangent } = sampleRiverPoint(t);
      if (Math.abs(p.x) > X_LIMIT) {
        strip = -1;
        continue;
      }
      const nx = -tangent.z * side;
      const nz = tangent.x * side;
      const wScale = riverWidthScale(p.x);
      const ex = p.x + nx * EDGE * wScale;
      const ez = p.z + nz * EDGE * wScale;
      const lx = p.x + nx * LIP_INNER * wScale;
      const lz = p.z + nz * LIP_INNER * wScale;

      const wBase = wallPos.length / 3;
      wallPos.push(ex, WALL_TOP, ez, ex, WALL_BOTTOM, ez);
      const lBase = lipPos.length / 3;
      lipPos.push(ex, LIP_Y, ez, lx, LIP_Y, lz);

      if (strip >= 0) {
        // wall quad (two tris) between previous and current cross-sections
        wallIdx.push(wBase - 2, wBase, wBase - 1, wBase, wBase + 1, wBase - 1);
        lipIdx.push(lBase - 2, lBase, lBase - 1, lBase, lBase + 1, lBase - 1);
      }
      strip = wBase;
    }
  }

  const wall = new THREE.BufferGeometry();
  wall.setAttribute("position", new THREE.Float32BufferAttribute(wallPos, 3));
  wall.setIndex(wallIdx);
  wall.computeVertexNormals();
  const lip = new THREE.BufferGeometry();
  lip.setAttribute("position", new THREE.Float32BufferAttribute(lipPos, 3));
  lip.setIndex(lipIdx);
  lip.computeVertexNormals();
  return { wall, lip };
}

export default function RiverBankWalls() {
  const { wall, lip } = useMemo(() => buildBankGeometry(), []);
  return (
    <group>
      <mesh geometry={wall} receiveShadow>
        <meshStandardMaterial color="#6B5138" roughness={0.95} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={lip} receiveShadow>
        <meshStandardMaterial color="#5FA83D" roughness={0.92} metalness={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
