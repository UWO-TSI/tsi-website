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
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";
import { AudioManager } from "@/lib/game/audio";

const FLOWERS = [
  { key: "flower_red", label: "a red flower", color: "#E85050" },
  { key: "flower_purple", label: "a purple flower", color: "#A96BD8" },
  { key: "flower_yellow", label: "a yellow flower", color: "#FFD166" },
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
      const { x, z } = (e as CustomEvent<{ x: number; z: number }>).detail;
      const flower = FLOWERS[Math.abs(Math.round(x + z)) % FLOWERS.length];
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
  const [toast, setToast] = useState<string | null>(pick.flower ? `You picked ${pick.flower.label}!` : null);

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
      if (toast) setToast(null);
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
      {toast && (
        <Html
          zIndexRange={[40, 0]}
          position={[0, 1.8, 0]}
          center
          style={{ pointerEvents: "none" }}
          distanceFactor={10}
        >
          <div
            style={{
              padding: "6px 12px",
              background: "#FFFDF5",
              color: "#4A4034",
              border: "2px solid #E8DFC8",
              borderRadius: 12,
              fontFamily: "var(--font-highlight, sans-serif)",
              fontSize: 12,
              whiteSpace: "nowrap",
              boxShadow: "0 3px 10px rgba(60, 45, 20, 0.18)",
            }}
          >
            {toast}
          </div>
        </Html>
      )}
    </group>
  );
}
