"use client";

/**
 * ToolFlourish (2026-07-13) — the ACNH tool beat.
 *
 * Real net/rod props from Tools/ appear in the player's hands for the
 * moment of use: `tsi:critter-catch` swings the net in an overhead arc,
 * `tsi:fish-start` plays the rod cast. Purely cosmetic garnish over the
 * existing event flows; one group, hidden when idle.
 */

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const NET_URL = "/assets/acnh/props/tool-net.glb";
const ROD_URL = "/assets/acnh/props/tool-rod.glb";
useGLTF.preload(NET_URL);
useGLTF.preload(ROD_URL);

const SWING_S = 0.55;
const CAST_S = 0.9;

// module frame state (same pattern as Critters)
const flourish: { tool: "net" | "rod" | null; start: number } = { tool: null, start: 0 };

function ToolModel({ url, tint }: { url: string; tint?: string }) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    if (tint) {
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          const mat = (m.material as THREE.MeshStandardMaterial).clone();
          if (!mat.map) mat.color = new THREE.Color(tint);
          m.material = mat;
        }
      });
    }
    return c;
  }, [scene, tint]);
  return <primitive object={clone} />;
}

export default function ToolFlourish({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
  const groupRef = useRef<THREE.Group>(null);
  const netRef = useRef<THREE.Group>(null);
  const rodRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const onNet = () => { flourish.tool = "net"; flourish.start = performance.now(); };
    const onRod = () => { flourish.tool = "rod"; flourish.start = performance.now(); };
    window.addEventListener("tsi:critter-catch", onNet);
    window.addEventListener("tsi:fish-start", onRod);
    return () => {
      window.removeEventListener("tsi:critter-catch", onNet);
      window.removeEventListener("tsi:fish-start", onRod);
    };
  }, []);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const dur = flourish.tool === "rod" ? CAST_S : SWING_S;
    const k = flourish.tool ? (performance.now() - flourish.start) / (dur * 1000) : 2;
    if (!flourish.tool || k >= 1) {
      g.visible = false;
      if (k >= 1) flourish.tool = null;
      return;
    }
    const pp = playerPosRef.current;
    g.visible = true;
    g.position.set(pp.x + 0.45, pp.y + 0.85, pp.z + 0.15);
    if (netRef.current) netRef.current.visible = flourish.tool === "net";
    if (rodRef.current) rodRef.current.visible = flourish.tool === "rod";
    if (flourish.tool === "net" && netRef.current) {
      // overhead arc: raise then slam forward
      const e = k * k * (3 - 2 * k);
      netRef.current.rotation.x = -1.9 + e * 2.5;
    }
    if (flourish.tool === "rod" && rodRef.current) {
      // cast: pull back (0-0.35), fling forward (0.35-0.6), hold
      const back = Math.min(k / 0.35, 1);
      const fling = THREE.MathUtils.clamp((k - 0.35) / 0.25, 0, 1);
      rodRef.current.rotation.x = -0.4 - back * 1.1 + fling * 1.9;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <Suspense fallback={null}>
        <group ref={netRef} scale={[0.09, 0.09, 0.09]} rotation={[0, 0, 0]}>
          <ToolModel url={NET_URL} tint="#5A8FD0" />
        </group>
        <group ref={rodRef} scale={[0.09, 0.09, 0.09]}>
          <ToolModel url={ROD_URL} />
        </group>
      </Suspense>
    </group>
  );
}
