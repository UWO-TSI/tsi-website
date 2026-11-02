"use client";

/**
 * Dev only: `?crowd=N` puts N random-look characters beside the player for
 * look reviews and the performance target (>= 12 on screen at 30 FPS).
 * They stand in an arc facing the camera; add `&stroll=1` to walk them in a
 * circle, `&clip=Wave` to loop a clip on all of them, `&clip=all` to give
 * each one a different catalogue clip (labelled) for the clip review.
 * `&armed=1` marks the ruins gate as open so the equipped weapon shows on the back.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { calculateCurvedHtmlPosition } from "@/lib/game/worldProjection";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Character, { type CharacterMotion, type ClipName } from "./Character";
import { CLIPS, CLIP_BY_NAME, randomLook, seeded } from "@/lib/game/character/look";
import { combat, publishCombat } from "@/lib/game/combat/runtime";
import { useStepDust, type StepWorld } from "../movement/moveFx";

function Walker({ i, n, player, origin, ground, stepWorld, stroll, clip, label }: { i: number; n: number; player: React.RefObject<THREE.Vector3>; origin: THREE.Vector3 | null; ground: (x: number, z: number) => number; stepWorld?: StepWorld; stroll: boolean; clip: ClipName | null; label: boolean }) {
  const look = useMemo(() => randomLook(seeded(1000 + i * 17)), [i]);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: Math.PI, lift: 0, pose: null, play: null });
  const replay = useRef(0);
  const group = useRef<THREE.Group>(null);
  useStepDust(motion, group, stepWorld);
  const t = useRef(i / n * Math.PI * 2);
  const home = useRef<THREE.Vector3 | null>(null);
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const center = home.current ??= origin ?? player.current.clone();
    let x: number, z: number;
    if (stroll) {
      t.current += delta * 0.35;
      const r = 3.2 + (i % 3) * 1.1;
      x = center.x + Math.cos(t.current + i) * r; z = center.z + Math.sin(t.current + i) * r;
      motion.current.speed = 0.35 * r;
      motion.current.yaw = Math.atan2(-Math.sin(t.current + i), Math.cos(t.current + i));
    } else {
      // Rows of up to 8 facing the camera: the first between the player and the camera, the rest stepping back past the player.
      const row = Math.floor(i / 8), cols = Math.min(8, n - row * 8), k = (i % 8) - (cols - 1) / 2;
      x = center.x - k * 1.25; z = center.z - 1.6 + row * 2.1;
    }
    g.position.set(x, ground(x, z), z);
    // Loops hold as poses; one-shots replay after a short rest so every frame of the review shows motion.
    if (clip && (replay.current -= delta) <= 0) { motion.current.play = clip; replay.current = (CLIP_BY_NAME.get(clip)?.length ?? 1) + 0.6; }
  });
  return <group ref={group}>
    <Suspense fallback={null}><Character look={look} motion={motion} walkSpeed={2.6} /></Suspense>
    {label && <Html calculatePosition={calculateCurvedHtmlPosition} position={[0, 1.7, 0]} center zIndexRange={[5, 0]}><span style={{ font: "600 11px sans-serif", background: "#fffbefdd", padding: "1px 6px", borderRadius: 8, color: "#243e50", whiteSpace: "nowrap" }}>{clip}</span></Html>}
  </group>;
}

export default function CharacterCrowd({ player, ground, stepWorld }: { player: React.RefObject<THREE.Vector3>; ground: (x: number, z: number) => number; stepWorld?: StepWorld }) {
  const [params] = useState(() => (process.env.NODE_ENV !== "production" && typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams()));
  const n = Math.min(40, Number(params.get("crowd")) || 0);
  useEffect(() => {
    if (params.get("armed") !== "1") return;
    // After the progression fetch has set the real gate state.
    const t = window.setTimeout(() => { combat.rt.player.armed = true; publishCombat(); }, 4000);
    return () => window.clearTimeout(t);
  }, [params]);
  const clip = params.get("clip") as ClipName | null;
  const at = params.get("at")?.split(",").map(Number);
  const [origin] = useState(() => (at?.length === 2 && at.every(Number.isFinite) ? new THREE.Vector3(at[0], 0, at[1]) : null));
  if (!n) return null;
  const all = clip === ("all" as ClipName);
  return <>{Array.from({ length: n }, (_, i) => <Walker key={i} i={i} n={n} player={player} origin={origin} ground={ground} stepWorld={stepWorld} stroll={params.get("stroll") === "1"} label={all}
    clip={all ? CLIPS[i % CLIPS.length].name as ClipName : clip && CLIP_BY_NAME.has(clip) ? clip : null} />)}</>;
}
