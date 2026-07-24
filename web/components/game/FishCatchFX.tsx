"use client";

/**
 * FishCatchFX (ACNH revamp 2026-07) — the catch beat, in-world.
 *
 * FishingOverlay owns the cast/wait/bite machine in DOM; when it lands a
 * catch it dispatches `tsi:fish-caught` with the species' model path. This
 * layer (inside the Canvas) holds the fish GLB above the player for a
 * couple of seconds — the ACNH "show off the catch" pose. The models come
 * out of the pipeline hanging vertically, which reads exactly right.
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const SHOW_MS = 2400;

function CaughtFish({ url, raw }: { url: string; raw?: boolean }) {
  const { scene } = useGLTF(url);
  const clone = scene.clone(true);
  // Dump imports ship raw (10× game scale, Z-forward): apply GAME_CALIBRATION.
  return (
    <group scale={raw ? 0.1 : 1} rotation-x={raw ? Math.PI / 2 : 0}>
      <primitive object={clone} />
    </group>
  );
}

export default function FishCatchFX({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
  const [show, setShow] = useState<{ model: string; start: number; raw?: boolean } | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const onCatch = (e: Event) => {
      const { model, raw } = (e as CustomEvent<{ key: string; model?: string; raw?: boolean }>).detail;
      if (!model) return;
      setShow({ model, start: performance.now(), raw });
    };
    window.addEventListener("tsi:fish-caught", onCatch);
    return () => window.removeEventListener("tsi:fish-caught", onCatch);
  }, []);

  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => setShow(null), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [show]);

  useFrame(() => {
    if (!show || !groupRef.current) return;
    const p = playerPosRef.current;
    const age = (performance.now() - show.start) / 1000;
    // Rise a touch, slow celebratory spin, gentle bob.
    groupRef.current.position.set(p.x, p.y + 2.1 + Math.min(age * 0.6, 0.35) + Math.sin(age * 3) * 0.04, p.z);
    groupRef.current.rotation.y = age * 1.6;
  });

  if (!show) return null;
  return (
    <group ref={groupRef}>
      <Suspense fallback={null}>
        <CaughtFish url={show.model} raw={show.raw} />
      </Suspense>
    </group>
  );
}
