"use client";

/**
 * The HQ lead on the wharf for a first login (hud-first-login §6): the shared
 * character rig in a fixed look (lib/game/welcome.ts), turned toward the
 * player, waving on the first line and moving her mouth on each one. The
 * words are in the dialogue box (NPCDialogue); she stays on the wharf until
 * the scene changes.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type * as THREE from "three";
import Character, { CHARACTER_HEIGHT, type CharacterMotion } from "./character/Character";
import { parseLook } from "@/lib/game/character/look";
import { calculateCurvedHtmlPosition } from "@/lib/game/worldProjection";
import { easeFacing } from "@/lib/game/locomotion";
import { HQ_LEAD } from "@/lib/game/welcome";
import s from "./study/study.module.css";

export default function HQLead({ at, ground, player, line }: { at: [number, number]; ground: (x: number, z: number) => number; player: React.RefObject<THREE.Vector3>; line: number | null }) {
  const look = useMemo(() => parseLook(HQ_LEAD.look), []);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: Math.PI, lift: 0, pose: null, play: null });
  useEffect(() => {
    if (line === null) return;
    if (line === 0) motion.current.play = "Wave";
    motion.current.talk = Math.min(3.2, 0.8 + (HQ_LEAD.lines[line]?.length ?? 0) * 0.045);
  }, [line]);
  useFrame((_, raw) => {
    const p = player.current, m = motion.current;
    m.yaw = easeFacing(m.yaw, Math.atan2(p.x - at[0], p.z - at[1]), 6, Math.min(raw, 0.1));
  });
  return <group position={[at[0], ground(at[0], at[1]), at[1]]}>
    <Suspense fallback={null}><Character look={look} motion={motion} /></Suspense>
    <Html calculatePosition={calculateCurvedHtmlPosition} position={[0, CHARACTER_HEIGHT + 0.35, 0]} center zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
      <div className={s.nameplate}>{HQ_LEAD.name}<small>{HQ_LEAD.post}</small></div>
    </Html>
  </group>;
}
