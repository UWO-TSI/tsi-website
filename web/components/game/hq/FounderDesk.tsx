"use client";

/**
 * The Founder's desk at HQ (row 312, specs/hq-onboarding.md; lore: the Founder built the refuge and sailed past the
 * veil, present only through what they built). On the back wall between the notice board and the lounge: a study desk,
 * its chair pushed back and turned as if someone just stood up, and above it the plaque, blank. Only David writes the
 * plaque (lib/game/arrival/hq/lines.ts FOUNDER_PLAQUE): its frame's canvas is plain until then. The member clubhouse
 * only (the applicant HQ is untouched); the walker goes round it (constrainFounder).
 */
import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Piece, pieceUrl, type InteriorStation } from "../interiorShared";
import { constrainWorkshop } from "../crafting/Workshop";

/** Room space (HQInterior: +x on screen left, the back wall at z ≈ 5.95): the desk's middle and half its footprint. */
export const FOUNDER_DESK = { x: 2.47, z: 5.48, halfX: 0.82, halfZ: 0.43 } as const;
const CHAIR = { x: 2.3, z: 4.72, half: 0.34, yaw: Math.PI + 0.42 } as const;
/** Where you stand to look at it (the station). */
export const FOUNDER_STATION: InteriorStation = { id: "founder", name: "The Founder's desk", pos: [FOUNDER_DESK.x - 0.2, 3.85], action: "founder", range: 1.35 };
/** The plaque's frame on the wall above the desk. */
const PLAQUE = { y: 2.36, z: 5.86, scale: 0.055 } as const;
const BLANK = new THREE.MeshStandardMaterial({ color: "#eadfc6", roughness: 1, metalness: 0 });

/** The clubhouse's walls, furniture and bench, plus the desk and its chair. */
export function constrainFounder(x: number, z: number, nx: number, nz: number): [number, number] {
  const c = constrainWorkshop(x, z, nx, nz);
  const desk = Math.abs(c[0] - FOUNDER_DESK.x) < FOUNDER_DESK.halfX + 0.22 && Math.abs(c[1] - FOUNDER_DESK.z) < FOUNDER_DESK.halfZ + 0.22;
  const chair = Math.abs(c[0] - CHAIR.x) < CHAIR.half + 0.2 && Math.abs(c[1] - CHAIR.z) < CHAIR.half + 0.2;
  if (desk || chair) { c[0] = x; c[1] = z; }
  return c;
}

/** The plaque: the picture frame with its canvas left plain (nothing painted, nothing written). */
function BlankPlaque() {
  const { scene } = useGLTF(pieceUrl("wall-frame"));
  const frame = useMemo(() => {
    const c = scene.clone(true);
    c.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false; mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const plain = mats.map(m => (/fabric/i.test(m.name) ? BLANK : m));
      mesh.material = Array.isArray(mesh.material) ? plain : plain[0];
    });
    return c;
  }, [scene]);
  return <primitive object={frame} position={[FOUNDER_DESK.x, PLAQUE.y, PLAQUE.z]} rotation={[0, Math.PI, 0]} scale={PLAQUE.scale} />;
}

export default function FounderDesk() {
  return <Suspense fallback={null}>
    <Piece shadows name="study-desk" position={[FOUNDER_DESK.x, 0, FOUNDER_DESK.z]} />
    <Piece shadows name="study-chair" position={[CHAIR.x, 0, CHAIR.z]} rotY={CHAIR.yaw} />
    <BlankPlaque />
  </Suspense>;
}
