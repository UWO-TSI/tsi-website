"use client";

/**
 * The level-up moment (David 2026-10-28: "chapter 1 done get enough exp to level up to level 2, should have overlay of
 * what unlocks"; r3: "maybe have your character model there and like the experience floats into the character and
 * flash frame for every experence going in ... the character jumps and grows a lil"): when the HUD's XP ring fills
 * (HudBars' LEVEL_FILLED), the kit's LevelUpMoment plays with your own character on it (the creator's studio portrait,
 * its own small canvas, up only while the moment is): each XP mote landing blips a little higher, the burst makes the
 * character jump and cheer, and the reveal fades the character out and says the new level and what it opens in the
 * middle (lib/game/levelUp.ts: only what's real; the quest's book flips, the stat points twinkle). A finished chapter's check-mark (tutorial-v2's QuestCheck, on "tsi:quest-complete") plays first; the moment
 * waits for it.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BookOpen, Sparkles } from "lucide-react";
import { AudioManager } from "@/lib/game/audio";
import { DROPS } from "@/lib/game/drops";
import { levelUnlocks } from "@/lib/game/levelUp";
import { useProgression } from "@/lib/progression/useProgression";
import { useMyLook } from "@/lib/game/character/lookStore";
import { FRAMES, Portrait } from "@/components/game/character/CreatorStage";
import type { CharacterMotion } from "@/components/game/character/Character";
import { LevelUpMoment, type LevelBeat } from "@/components/gui/flat";
import { LEVEL_FILLED } from "./HudBars";

/** The quest-complete check's length: the moment shows no sooner after it. */
const AFTER_CHECK_MS = 1600;
/** The jump: how high (m) and how long (s). */
const JUMP_M = 0.2, JUMP_S = 0.5;

/** The jump's arc on the character (`at`: when it left the ground, performance.now ms; 0 not yet). Module scope: hook values are never written in a component. */
function jumpLift(motion: CharacterMotion, at: number) {
  const t = at ? (performance.now() - at) / 1000 / JUMP_S : 1;
  motion.lift = t > 0 && t < 1 ? JUMP_M * 4 * t * (1 - t) : 0;
}
function Jump({ motion, at }: { motion: RefObject<CharacterMotion>; at: RefObject<number> }) {
  useFrame(() => jumpLift(motion.current, at.current));
  return null;
}

/** You, head to toe, on the moment's card. */
function Hero({ motion, jumpAt }: { motion: RefObject<CharacterMotion>; jumpAt: RefObject<number> }) {
  const { look } = useMyLook();
  const yaw = useRef({ now: -0.18, target: -0.18 });
  return <Canvas style={{ width: "100%", height: "100%" }} gl={{ antialias: true, alpha: true }} dpr={[1, 2]} camera={{ fov: FRAMES.body.fov, near: 0.05, far: 30 }}
    onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }} data-testid="level-up-hero">
    <Portrait look={look} framing="body" yaw={yaw} studio="white" motion={motion} />
    <Jump motion={motion} at={jumpAt} />
  </Canvas>;
}

export default function LevelUpCard() {
  const { state } = useProgression();
  const [shown, setShown] = useState<{ level: number; chapter: boolean } | null>(null);
  const checkAt = useRef(-Infinity);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: -0.18, lift: 0, pose: null, play: null });
  const jumpAt = useRef(0);
  useEffect(() => {
    let t = 0;
    const checked = () => { checkAt.current = performance.now(); };
    const filled = (e: Event) => {
      const next = (e as CustomEvent<{ level: number }>).detail.level;
      window.clearTimeout(t);
      // A chapter's level up (its check just played) opens its next quest; any other (a kill, a mission) only the level.
      const chapter = performance.now() - checkAt.current < 5000;
      t = window.setTimeout(() => { jumpAt.current = 0; setShown({ level: next, chapter }); }, Math.max(0, checkAt.current + AFTER_CHECK_MS - performance.now()));
    };
    window.addEventListener("tsi:quest-complete", checked);
    window.addEventListener(LEVEL_FILLED, filled);
    return () => { window.clearTimeout(t); window.removeEventListener("tsi:quest-complete", checked); window.removeEventListener(LEVEL_FILLED, filled); };
  }, []);
  if (!shown) return null;
  const beat = (b: LevelBeat, i: number) => {
    if (b === "mote") AudioManager.playSFX("blip1", { rate: 1 + i * 0.09, gain: 0.55 });
    else if (b === "burst") { jumpAt.current = performance.now(); motion.current.play = "Cheer"; AudioManager.playSFX("jump"); }
    else AudioManager.playSFX("confirm");
  };
  const unlocks = levelUnlocks(state.chapters, DROPS.classes).filter(u => shown.chapter || u.kind !== "quest");
  return <LevelUpMoment level={shown.level} title={`You're level ${shown.level}`} testId="level-up" onBeat={beat} onClose={() => setShown(null)}
    figure={<Hero motion={motion} jumpAt={jumpAt} />}
    items={unlocks.map(u => u.kind === "quest" ? { key: u.kind, icon: <BookOpen size={28} />, motion: "flip", title: u.title, line: u.detail }
      : { key: u.kind, icon: <Sparkles size={28} />, motion: "twinkle", title: u.title, line: u.detail })} />;
}
