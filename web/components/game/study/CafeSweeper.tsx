"use client";

/**
 * Rosa out front of the café while it is built but not open (v1, specs/v1-drop.md §2; lib/game/drops.ts `cafe`):
 * the café owner's look with her porch broom, sweeping the step and the path on the shared world clock (cafe.ts
 * SWEEP_STATIONS through `ownerAt`), so everyone sees her at the same spot. Dawn to evening; at night she's inside.
 * Walking up gets a wave and a line; E ("Talk to Rosa", `tsi:cafe-owner-talk`) gets the next. Her bubble and
 * nameplate are toggled through refs and her pose is reused: no React state and no allocation in the frame loop.
 * `cafeSweeper` says where she is for the island's prompt (DefaultIslandWorld).
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type * as THREE from "three";
import Character, { CHARACTER_HEIGHT, type CharacterMotion, type HeldView } from "../character/Character";
import { parseLook } from "@/lib/game/character/look";
import { calculateCurvedHtmlPosition } from "@/lib/game/worldProjection";
import { AudioManager } from "@/lib/game/audio";
import { easeFacing } from "@/lib/game/locomotion";
import { worldNow } from "@/lib/game/worldClock";
import { CAFE_OWNER, OWNER_WALK, SWEEP_STATIONS, SWEEPER_LINES, SWEEPER_TALK, ownerAt, type OwnerPose } from "@/lib/game/cafe";
import s from "./study.module.css";

const BROOM: HeldView = { url: "/assets/game/tools/broom.glb", hold: "shovel" };
const BUBBLE_S = 4.6, GREET_COOLDOWN_S = 30, NOTICE = 3.2;
/** A sweep: the body turns a little either way about her facing, a stroke every 1.1 s. */
const STROKE = { swing: 0.34, hz: 0.9 };

/** Where she is now, in world XZ (`on`: out front and visible). Written by her frame, read by the island's prompt. */
export const cafeSweeper = { x: 0, z: 0, on: false };

/** Module scope (the react compiler forbids writing through hook values): show or hide an overhead piece. */
function show(el: HTMLElement | null, on: boolean) { if (el) el.style.display = on ? "" : "none"; }
/** A line's mood tag ("[happy] …") is for the dialogue box; the bubble shows the words. */
const words = (line: string) => line.replace(/^\[\w+\]\s*/, "");

interface Runtime { lag: number; talkUntil: number; greetAfter: number; near: boolean; line: number; now: number; x: number; z: number; pose: OwnerPose; text: string; shown: number }

export default function CafeSweeper({ cafe, ground, player, night }: {
  /** The café landmark's placement. */
  cafe: { x: number; z: number; yaw: number; scale: number };
  ground: (x: number, z: number) => number; player: React.RefObject<THREE.Vector3>; night: boolean;
}) {
  const look = useMemo(() => parseLook(CAFE_OWNER.look), []);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: Math.PI, lift: 0, pose: null, play: null });
  const group = useRef<THREE.Group>(null);
  const bubbleEl = useRef<HTMLDivElement>(null), plateEl = useRef<HTMLDivElement>(null);
  const r = useRef<Runtime>({ lag: 0, talkUntil: 0, greetAfter: 0, near: false, line: 0, now: 0, x: 0, z: 0,
    pose: { x: 0, z: 0, yaw: 0, clip: "Idle", moving: false, station: 0 }, text: "", shown: -1 });
  const blips = useRef<number[]>([]);
  useEffect(() => {
    // Dev (evidence scripts): where she is.
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __sweeper: cafeSweeper });
    return () => { blips.current.forEach(window.clearTimeout); cafeSweeper.on = false; };
  }, []);
  useEffect(() => { if (night) cafeSweeper.on = false; }, [night]);

  const say = useMemo(() => () => {
    const o = r.current, text = words(SWEEPER_LINES[o.line % SWEEPER_LINES.length]);
    o.line++;
    if (o.now >= o.talkUntil) motion.current.play = "Wave";
    o.talkUntil = o.now + BUBBLE_S;
    o.text = text; o.shown = -1;
    motion.current.talk = Math.min(3.2, 0.8 + text.length * 0.045);
    AudioManager.playBlip();
    blips.current.forEach(window.clearTimeout);
    blips.current = [140, 300].map(ms => window.setTimeout(() => AudioManager.playBlip(), ms));
  }, []);
  useEffect(() => {
    if (night) return;
    const talk = () => say();
    window.addEventListener("tsi:cafe-owner-talk", talk);
    return () => window.removeEventListener("tsi:cafe-owner-talk", talk);
  }, [say, night]);

  useFrame((_, raw) => {
    if (night) return;
    const delta = Math.min(raw, 0.1), o = r.current, m = motion.current, p = player.current;
    o.now = worldNow() / 1000;
    const talking = o.now < o.talkUntil;
    if (talking) o.lag += delta;
    const at = ownerAt(o.now - o.lag, SWEEP_STATIONS, o.pose);
    // Café frame → world: turned by the café's yaw, scaled with it.
    const c = Math.cos(cafe.yaw), sn = Math.sin(cafe.yaw), lx = at.x * cafe.scale, lz = at.z * cafe.scale;
    const wx = cafe.x + lx * c + lz * sn, wz = cafe.z - lx * sn + lz * c;
    const toYou = Math.hypot(p.x - wx, p.z - wz), near = toYou < NOTICE;
    if (near && !o.near && o.now > o.greetAfter && !talking) { o.greetAfter = o.now + GREET_COOLDOWN_S; say(); }
    o.near = near;
    const sweeping = !talking && !at.moving && at.clip === "Sweep";
    m.speed = talking ? 0 : at.moving ? OWNER_WALK : 0;
    if (!talking) { o.x = wx; o.z = wz; }
    const base = at.yaw + cafe.yaw, stroke = sweeping ? STROKE.swing * Math.sin(o.now * Math.PI * 2 * STROKE.hz) : 0;
    const face = talking || (near && !at.moving && !sweeping) ? Math.atan2(p.x - o.x, p.z - o.z) : base + stroke;
    m.yaw = easeFacing(m.yaw, face, talking ? 8 : sweeping ? 14 : 6, delta);
    group.current?.position.set(o.x, ground(o.x, o.z), o.z);
    cafeSweeper.x = o.x; cafeSweeper.z = o.z; cafeSweeper.on = true;
    const bubble = o.now < o.talkUntil, state = (bubble ? 1 : 0) | (toYou < SWEEPER_TALK + 0.6 || bubble ? 2 : 0);
    if (state !== o.shown && plateEl.current) {
      o.shown = state;
      if (bubble && bubbleEl.current && bubbleEl.current.textContent !== o.text) bubbleEl.current.textContent = o.text;
      show(bubbleEl.current, bubble); show(plateEl.current, (state & 2) > 0);
    }
  });

  if (night) return null;
  return <group ref={group}>
    <Suspense fallback={null}><Character look={look} motion={motion} walkSpeed={OWNER_WALK} held={BROOM} /></Suspense>
    <Html calculatePosition={calculateCurvedHtmlPosition} position={[0, CHARACTER_HEIGHT + 1.15, 0]} center zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
      <div ref={bubbleEl} className={s.bubble} style={{ display: "none" }} />
    </Html>
    <Html calculatePosition={calculateCurvedHtmlPosition} position={[0, CHARACTER_HEIGHT + 0.35, 0]} center zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
      <div ref={plateEl} className={s.nameplate} style={{ display: "none" }}>{CAFE_OWNER.name}<small>Café owner</small></div>
    </Html>
  </group>;
}
