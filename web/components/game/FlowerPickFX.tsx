"use client";

/**
 * FlowerPickFX (cozy marathon G4) — the pick beat.
 *
 * Listens for `tsi:flower-pick` window events (fired by GameWorld's E handler
 * when the nearest interactable is a flower cluster). At the cluster's XZ it
 * plays a short petal burst that floats up and fades, a soft chime, and a
 * "You picked a flower!" toast. The item_key is chosen from the cluster
 * position's parity so a given patch tends to yield the same color. Persists
 * via POST /api/collections — cosmetic only, no TC/XP (principle #3).
 *
 * The cluster's disappearance/respawn is owned by the flowerPicks store; this
 * layer is purely the celebratory FX + the collect call.
 */

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";
import { AudioManager } from "@/lib/game/audio";

// ACNH revamp 2026-07: species-true collection. Index-aligned with
// GameWorld's FLOWER_MODELS (cluster's lead model = (clusterIdx) % 8).
// Legacy generic keys (flower_red/purple/yellow) retired pre-launch.
const FLOWERS = [
  { key: "flower_cosmos", label: "a pink cosmos", color: "#FF8CB0" },
  { key: "flower_lily", label: "a white lily", color: "#F5F5F5" },
  { key: "flower_hyacinth", label: "a blue hyacinth", color: "#6BA3D6" },
  { key: "flower_mum", label: "a yellow mum", color: "#FFD166" },
  { key: "flower_rose", label: "a red rose", color: "#E85050" },
  { key: "flower_tulip", label: "an orange tulip", color: "#FF9944" },
  { key: "flower_pansy", label: "a purple pansy", color: "#9B6BB0" },
  { key: "flower_windflower", label: "a windflower", color: "#FF6B8A" },
] as const;

const PETALS = 10;

interface Pick {
  id: number;
  x: number;
  z: number;
  groundY: number;
  start: number;
  flower: (typeof FLOWERS)[number];
}

let pickId = 0;

export default function FlowerPickFX() {
  const [picks, setPicks] = useState<Pick[]>([]);

  useEffect(() => {
    const onPick = (e: Event) => {
      const { x, z, idx } = (e as CustomEvent<{ x: number; z: number; idx?: number }>).detail;
      const flower = FLOWERS[(idx ?? Math.abs(Math.round(x + z))) % FLOWERS.length];
      AudioManager.playSFX("confirm");
      const pk: Pick = {
        id: pickId++,
        x,
        z,
        groundY: getTerrainHeight(x, z),
        start: performance.now(),
        flower,
      };
      setPicks((p) => [...p.slice(-3), pk]);
      fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_key: flower.key }),
      }).catch(() => {});
    };
    window.addEventListener("tsi:flower-pick", onPick);
    return () => window.removeEventListener("tsi:flower-pick", onPick);
  }, []);

  const expire = (id: number) => setPicks((p) => p.filter((x) => x.id !== id));

  return (
    <>
      {picks.map((pk) => (
        <PickBurst key={pk.id} pick={pk} onDone={() => expire(pk.id)} />
      ))}
    </>
  );
}

function PickBurst({ pick, onDone }: { pick: Pick; onDone: () => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const doneRef = useRef(false);
  // G3: toast routed through the unified hub (fires once on mount).
  useEffect(() => {
    if (pick.flower) {
      window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: `You picked ${pick.flower.label}!` } }));
    }
  }, [pick.flower]);

  useFrame(() => {
    const t = (performance.now() - pick.start) / 1000;
    const g = groupRef.current;
    if (g) {
      g.children.forEach((child, i) => {
        if (child.name !== "petal") return;
        const angle = (i / PETALS) * Math.PI * 2;
        const rise = Math.min(t / 1.2, 1);
        const spread = 0.15 + rise * 0.5;
        child.position.set(
          Math.cos(angle + t) * spread,
          0.3 + rise * 1.1,
          Math.sin(angle + t) * spread
        );
        child.rotation.z = t * 4 + i;
        const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        m.opacity = 1 - rise;
      });
    }
    if (t > 1.6) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    }
  });

  return (
    <group ref={groupRef} position={[pick.x, pick.groundY, pick.z]}>
      {Array.from({ length: PETALS }).map((_, i) => (
        <mesh key={i} name="petal" position={[0, 0.3, 0]}>
          <planeGeometry args={[0.12, 0.12]} />
          <meshBasicMaterial
            color={pick.flower.color}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
