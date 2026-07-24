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
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";
import { AudioManager } from "@/lib/game/audio";
import { collect } from "@/lib/game/collections";

const CANOPY_Y = 3.1;
const LEAVES_PER_SHAKE = 12;
const FRUIT_CHANCE = 0.35;
const SHAKE_COOLDOWN_MS = 2500;

const FRUITS = [
  { key: "apple", label: "an apple", color: "#E5484D" },
  { key: "peach", label: "a peach", color: "#FFB27D" },
  { key: "acorn", label: "an acorn", color: "#8B6B4A" },
  { key: "petal", label: "a cherry petal", color: "#FFB7D5" },
] as const;

// Species-aware shake results (ACNH revamp 2026-07). Index mirrors
// GameWorld's TREE_MODELS assignment: 0/1 hardwood, 2 blossom, 3 cedar.
// drops = indices into FRUITS.
const SPECIES: { leaves: string[]; drops: number[] }[] = [
  { leaves: ["#6FBF4E", "#8FD46A", "#57A83D", "#A8E08A"], drops: [0, 1] },
  { leaves: ["#6FBF4E", "#8FD46A", "#57A83D", "#A8E08A"], drops: [0, 1] },
  { leaves: ["#FFB7D5", "#FFD1E3", "#FF9EC4", "#FFC9DE"], drops: [3] },
  { leaves: ["#3D7A3D", "#2E5D2E", "#4C8A4C", "#356B35"], drops: [2] },
];

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

export default function TreeShakeFX({ playerPosRef }: { playerPosRef?: React.MutableRefObject<THREE.Vector3> }) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const lastShakeRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const onShake = (e: Event) => {
      const { x, z, species } = (e as CustomEvent<{ x: number; z: number; species?: number }>).detail;
      const key = `${x}:${z}`;
      const now = performance.now();
      if (now - (lastShakeRef.current[key] ?? -Infinity) < SHAKE_COOLDOWN_MS) return;
      lastShakeRef.current[key] = now;

      const sp = SPECIES[(species ?? 0) % SPECIES.length];
      const leaves: Leaf[] = Array.from({ length: LEAVES_PER_SHAKE }, (_, i) => ({
        seed: (i * 733 + x * 31 + z * 17) % 1000,
        x,
        z,
        color: sp.leaves[i % sp.leaves.length],
      }));
      const fruit = Math.random() < FRUIT_CHANCE
        ? FRUITS[sp.drops[Math.floor(Math.random() * sp.drops.length)]]
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
        <ShakeBurst key={b.id} burst={b} playerPosRef={playerPosRef} onDone={() => expire(b.id)} />
      ))}
    </>
  );
}

function ShakeBurst({ burst, playerPosRef, onDone }: { burst: Burst; playerPosRef?: React.MutableRefObject<THREE.Vector3>; onDone: () => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const fruitRef = useRef<THREE.Mesh>(null);
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
        // G4 (item 6): the fruit arcs to the player and pops — the ACNH
        // "into my pockets" beat — instead of floating up in place.
        const k = Math.min((t - 1.4) / 0.55, 1);
        const pp = playerPosRef?.current;
        if (pp) {
          const ease = k * k * (3 - 2 * k);
          f.position.x = THREE.MathUtils.lerp(f.position.x, pp.x - burst.x, ease);
          f.position.z = THREE.MathUtils.lerp(f.position.z, pp.z - burst.z, ease);
          f.position.y = 0.35 + Math.sin(ease * Math.PI) * 1.1 + (pp.y - burst.groundY + 0.8) * ease;
          f.scale.setScalar(1 - ease * 0.55);
        } else {
          f.position.y = 0.35 + k * 1.2;
        }
        const m = f.material as THREE.MeshStandardMaterial;
        m.opacity = 1 - Math.max(0, k - 0.75) * 4;
        if (!collectedRef.current && k >= 1) {
          collectedRef.current = true;
          window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: `You got ${burst.fruit.label}!`, icon: `/assets/acnh/icons/${burst.fruit.key}.png` } }));
          AudioManager.playSFX("confirm");
          collect(burst.fruit.key);
        }
      }
    }

    const lifetime = burst.fruit ? 2.6 : 1.9;
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
    </group>
  );
}
