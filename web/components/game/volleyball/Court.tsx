"use client";

/**
 * The volleyball court's light view (specs/minigames/beach-volleyball.md, "Two views"): what everyone walking by sees,
 * and all it costs them. The line tapes draped on the sand (one mesh, one draw) and the net: the low-poly net in the
 * world, the high-def one only for the player in a match (the bible's two versions, chosen by view). No ball, no bots,
 * no physics, no HUD: those are VolleyMatch's, mounted for the player in the match alone.
 */
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { GLBProp } from "../NatureModels";
import { COURT, toWorld } from "@/lib/game/volleyball/court";
import type { CourtSpot } from "@/lib/game/volleyball/session";

export const NET_URL = { world: "/assets/game/props/volleyball-net.glb", close: "/assets/game/props/volleyball-net-hd.glb" } as const;
/** The tapes: 5 cm real, a touch wider so they read from the path. */
const TAPE = 0.06, STEP = 0.4;

/** The four line tapes as one ribbon mesh in the court's frame, following the sand. */
export function courtLines(spot: CourtSpot, ground: (x: number, z: number) => number): THREE.BufferGeometry {
  const hw = COURT.halfWidth, hl = COURT.halfLength, pos: number[] = [], idx: number[] = [];
  const y = (x: number, z: number) => { const [wx, wz] = toWorld(spot, x, z); return ground(wx, wz) - spot.y + 0.012; };
  // Each tape from a to b, its width to the court's inside (the lines are inside the court's size).
  const tape = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / STEP));
    for (let i = 0; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n, x2 = x + nx * TAPE, z2 = z + nz * TAPE, v = pos.length / 3;
      pos.push(x, y(x, z), z, x2, y(x2, z2), z2);
      if (i) idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
    }
  };
  tape(-hw, -hl, -hw, hl, 1, 0);
  tape(hw, -hl, hw, hl, -1, 0);
  tape(-hw, -hl, hw, -hl, 0, 1);
  tape(-hw, hl, hw, hl, 0, -1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export default function Court({ spot, ground, close }: { spot: CourtSpot; ground: (x: number, z: number) => number; close: boolean }) {
  const lines = useMemo(() => courtLines(spot, ground), [spot, ground]);
  return (
    <group position={[spot.x, spot.y, spot.z]} rotation={[0, spot.yaw, 0]}>
      <mesh geometry={lines} receiveShadow>
        <meshStandardMaterial color="#f4f1e6" roughness={1} polygonOffset polygonOffsetFactor={-2} side={THREE.DoubleSide} />
      </mesh>
      {/* The high-def net loads on the match's start; until then (a moment) the world's net stands in. */}
      <Suspense fallback={<GLBProp url={NET_URL.world} />}><GLBProp url={close ? NET_URL.close : NET_URL.world} /></Suspense>
    </group>
  );
}
