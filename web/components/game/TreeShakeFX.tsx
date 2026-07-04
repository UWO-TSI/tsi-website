"use client";

/**
 * TreeShakeFX (cozy marathon G1) — the ACNH tree-shake beat.
 *
 * Listens for `tsi:tree-shake` window events (fired by GameWorld's E
 * handler when the nearest interactable is a tree) and runs a burst at the
 * tree's canopy: ~12 leaf quads flutter down, and ~35% of shakes drop a
 * fruit (apple/peach/acorn) that falls, bounces, then floats up and fades
 * with a "You got..." toast. Collection persists via POST /api/collections
 * — cosmetic only, no TC, no XP (principle #3). Unauthenticated (env-off
 * dev) POSTs just 401 silently; the visual beat still plays.
 *
 * Everything is transient local state — bursts self-expire; a per-tree
 * cooldown (2.5s) stops E-mashing from stacking bursts.
 */

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";
import { AudioManager } from "@/lib/game/audio";

const CANOPY_Y = 3.1;
const LEAVES_PER_SHAKE = 12;
const FRUIT_CHANCE = 0.35;
const SHAKE_COOLDOWN_MS = 2500;

const FRUITS = [
  { key: "apple", label: "an apple", color: "#E5484D" },
  { key: "peach", label: "a peach", color: "#FFB27D" },
  { key: "acorn", label: "an acorn", color: "#8B6B4A" },
] as const;

const LEAF_COLORS = ["#6FBF4E", "#8FD46A", "#57A83D", "#A8E08A"];

interface Leaf {
  seed: number;
  x: number;
  z: number;
  color: string;
}

interface Burst {
  id: number;
  x: number;
  z: number;
  groundY: number;
  start: number;
  leaves: Leaf[];
  fruit: (typeof FRUITS)[number] | null;
  collected: boolean;
}

let burstId = 0;

export default function TreeShakeFX() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const lastShakeRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const onShake = (e: Event) => {
      const { x, z } = (e as CustomEvent<{ x: number; z: number }>).detail;
      const key = `${x}:${z}`;
      const now = performance.now();
      if (now - (lastShakeRef.current[key] ?? -Infinity) < SHAKE_COOLDOWN_MS) return;
      lastShakeRef.current[key] = now;

      const leaves: Leaf[] = Array.from({ length: LEAVES_PER_SHAKE }, (_, i) => ({
        seed: (i * 733 + x * 31 + z * 17) % 1000,
        x,
        z,
        color: LEAF_COLORS[i % LEAF_COLORS.length],
      }));
      const fruit = Math.random() < FRUIT_CHANCE
        ? FRUITS[Math.floor(Math.random() * FRUITS.length)]
        : null;

      AudioManager.playSFX("exit"); // soft door-thud reads as a trunk knock
      setBursts((b) => [
        ...b.slice(-3),
        {
          id: burstId++,
          x,
          z,
          groundY: getTerrainHeight(x, z),
          start: now,
          leaves,
          fruit,
          collected: false,
        },
      ]);
    };
    window.addEventListener("tsi:tree-shake", onShake);
    return () => window.removeEventListener("tsi:tree-shake", onShake);
  }, []);

  const expire = (id: number) =>
    setBursts((b) => b.filter((x) => x.id !== id));

  return (
    <>
      {bursts.map((b) => (
        <ShakeBurst key={b.id} burst={b} onDone={() => expire(b.id)} />
      ))}
    </>
  );
}

function ShakeBurst({ burst, onDone }: { burst: Burst; onDone: () => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const fruitRef = useRef<THREE.Mesh>(null);
  const [toast, setToast] = useState<string | null>(null);
  const doneRef = useRef(false);
  const collectedRef = useRef(false);

  useFrame(() => {
    const t = (performance.now() - burst.start) / 1000;
    const g = groupRef.current;
    if (!g) return;

    // Leaves: flutter down from the canopy over ~1.6s with sway.
    g.children.forEach((child, i) => {
      if (child.name !== "leaf") return;
      const leaf = burst.leaves[i % burst.leaves.length];
      const fall = Math.min(t / 1.6, 1);
      const sway = Math.sin(t * 5 + leaf.seed) * 0.35;
      const spread = 0.3 + (leaf.seed % 100) / 90;
      const angle = (leaf.seed % 360) * (Math.PI / 180);
      child.position.set(
        Math.cos(angle) * spread + sway * 0.4,
        CANOPY_Y - fall * (CANOPY_Y - 0.15) - 0,
        Math.sin(angle) * spread + sway * 0.2
      );
      child.rotation.z = t * 3 + leaf.seed;
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = 1 - Math.max(0, fall - 0.75) * 4;
    });

    // Fruit: fall (0-0.5s), bounce (0.5-0.9s), rest, then float+fade after
    // collection fires at 1.4s.
    const f = fruitRef.current;
    if (f && burst.fruit) {
      if (t < 0.5) {
        const k = t / 0.5;
        f.position.y = CANOPY_Y - (CANOPY_Y - 0.35) * (k * k);
      } else if (t < 0.9) {
        const k = (t - 0.5) / 0.4;
        f.position.y = 0.35 + Math.sin(k * Math.PI) * 0.55;
      } else if (t < 1.4) {
        f.position.y = 0.35;
      } else {
        const k = Math.min((t - 1.4) / 0.8, 1);
        f.position.y = 0.35 + k * 1.2;
        const m = f.material as THREE.MeshStandardMaterial;
        m.opacity = 1 - k;
        if (!collectedRef.current) {
          collectedRef.current = true;
          setToast(`You got ${burst.fruit.label}!`);
          AudioManager.playSFX("confirm");
          fetch("/api/collections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item_key: burst.fruit.key }),
          }).catch(() => {});
        }
      }
    }

    const lifetime = burst.fruit ? 3.4 : 1.9;
    if (t > lifetime && !doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  });

  return (
    <group ref={groupRef} position={[burst.x, burst.groundY, burst.z]}>
      {burst.leaves.map((leaf, i) => (
        <mesh key={i} name="leaf" position={[0, CANOPY_Y, 0]}>
          <planeGeometry args={[0.16, 0.16]} />
          <meshBasicMaterial
            color={leaf.color}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      {burst.fruit && (
        <mesh ref={fruitRef} position={[0.4, CANOPY_Y, 0.3]} castShadow>
          <sphereGeometry args={[0.22, 12, 12]} />
          <meshStandardMaterial
            color={burst.fruit.color}
            roughness={0.5}
            transparent
          />
        </mesh>
      )}
      {toast && (
        <Html
          zIndexRange={[40, 0]}
          position={[0, 2.2, 0]}
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
