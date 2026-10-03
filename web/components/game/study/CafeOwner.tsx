"use client";

/**
 * The café owner behind the counter (cafe-polish §6): the shared character rig
 * in her fixed look, working a loop of stations from the shared world clock
 * (lib/game/cafe.ts ownerAt), greeting you with a wave and a line when you
 * walk up to the counter, and answering E ("Talk to …", `tsi:cafe-owner-talk`)
 * with her next line. The resident dialogue overlay comes in a later UI pass.
 * Her bubble and nameplate are toggled through refs and her routine's pose is
 * reused: nothing here sets React state or allocates in the frame loop
 * (interiors polish §6).
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type * as THREE from "three";
import Character, { CHARACTER_HEIGHT, type CharacterMotion } from "../character/Character";
import { parseLook } from "@/lib/game/character/look";
import { calculateCurvedHtmlPosition } from "@/lib/game/worldProjection";
import { AudioManager } from "@/lib/game/audio";
import { easeFacing } from "@/lib/game/locomotion";
import { CAFE_OWNER, OWNER_STATIONS, OWNER_TALK, OWNER_WALK, ownerAt, type OwnerPose } from "@/lib/game/cafe";
import s from "./study.module.css";

const BUBBLE_S = 4.6, GREET_COOLDOWN_S = 25, NOTICE = 3.4;

interface Runtime {
  lag: number; talkUntil: number; greetAfter: number; near: boolean; line: number; station: number; now: number; x: number; z: number;
  pose: OwnerPose; text: string; shown: number;
}
/** Module scope (the react compiler forbids writing through hook values): show or hide an overhead piece. */
function show(el: HTMLElement | null, on: boolean) { if (el) el.style.display = on ? "" : "none"; }

export default function CafeOwner({ player, name = CAFE_OWNER.name, lines = CAFE_OWNER.lines }: { player: React.RefObject<THREE.Vector3>; name?: string; lines?: readonly string[] }) {
  const look = useMemo(() => parseLook(CAFE_OWNER.look), []);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: Math.PI, lift: 0, pose: null, play: null });
  const group = useRef<THREE.Group>(null);
  const bubbleEl = useRef<HTMLDivElement>(null), plateEl = useRef<HTMLDivElement>(null);
  // Talking pauses her routine: the clock she works to runs this many seconds behind the world's.
  const r = useRef<Runtime>({ lag: 0, talkUntil: 0, greetAfter: 0, near: false, line: 0, station: -1, now: 0, x: 0, z: 0,
    pose: { x: 0, z: 0, yaw: 0, clip: "Idle", moving: false, station: 0 }, text: "", shown: -1 });
  const blips = useRef<number[]>([]);
  useEffect(() => () => blips.current.forEach(window.clearTimeout), []);

  // Say the next line: a wave if she wasn't already talking, the talking mouth and voice blips.
  const say = useMemo(() => () => {
    const o = r.current, text = lines[o.line % lines.length];
    o.line++;
    if (o.now >= o.talkUntil) motion.current.play = "Wave";
    o.talkUntil = o.now + BUBBLE_S;
    o.text = text; o.shown = -1;
    motion.current.talk = Math.min(3.2, 0.8 + text.length * 0.045);
    AudioManager.playBlip();
    blips.current.forEach(window.clearTimeout);
    blips.current = [140, 300].map(ms => window.setTimeout(() => AudioManager.playBlip(), ms));
  }, [lines]);
  useEffect(() => {
    const talk = () => say();
    window.addEventListener("tsi:cafe-owner-talk", talk);
    return () => window.removeEventListener("tsi:cafe-owner-talk", talk);
  }, [say]);

  useFrame((_, raw) => {
    const delta = Math.min(raw, 0.1), o = r.current, m = motion.current, p = player.current;
    o.now = Date.now() / 1000;
    const talking = o.now < o.talkUntil;
    if (talking) o.lag += delta;
    const at = ownerAt(o.now - o.lag, OWNER_STATIONS, o.pose);
    const toTalk = Math.hypot(p.x - OWNER_TALK.at[0], p.z - OWNER_TALK.at[1]);
    // Walking up to the counter: a hello, at most every GREET_COOLDOWN_S.
    const near = toTalk < NOTICE;
    if (near && !o.near && o.now > o.greetAfter && !talking) { o.greetAfter = o.now + GREET_COOLDOWN_S; say(); }
    o.near = near;
    // Station clips: Trace works the machine, Forage reaches under the counter once per visit.
    const station = at.moving ? -1 : at.station;
    if (station >= 0 && station !== o.station && at.clip === "Forage" && !talking) m.play = "Forage";
    o.station = station;
    m.pose = !talking && !at.moving && at.clip === "Trace" ? "Trace" : null;
    m.speed = talking ? 0 : at.moving ? OWNER_WALK : 0;
    if (!talking) { o.x = at.x; o.z = at.z; }
    const face = talking || (near && !at.moving) ? Math.atan2(p.x - o.x, p.z - o.z) : at.yaw;
    m.yaw = easeFacing(m.yaw, face, talking ? 8 : 6, delta);
    group.current?.position.set(o.x, 0, o.z);
    // The bubble while she talks, her nameplate while you're near or she talks: the DOM only when that changes.
    const bubble = o.now < o.talkUntil, state = (bubble ? 1 : 0) | (near || bubble ? 2 : 0);
    if (state !== o.shown && plateEl.current) {
      o.shown = state;
      if (bubble && bubbleEl.current && bubbleEl.current.textContent !== o.text) bubbleEl.current.textContent = o.text;
      show(bubbleEl.current, bubble); show(plateEl.current, (state & 2) > 0);
    }
  });

  return <group ref={group}>
    <Suspense fallback={null}><Character look={look} motion={motion} walkSpeed={OWNER_WALK} /></Suspense>
    <Html calculatePosition={calculateCurvedHtmlPosition} position={[0, CHARACTER_HEIGHT + 1.15, 0]} center zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
      <div ref={bubbleEl} className={s.bubble} style={{ display: "none" }} />
    </Html>
    <Html calculatePosition={calculateCurvedHtmlPosition} position={[0, CHARACTER_HEIGHT + 0.35, 0]} center zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
      <div ref={plateEl} className={s.nameplate} style={{ display: "none" }}>{name}<small>Café owner</small></div>
    </Html>
  </group>;
}
