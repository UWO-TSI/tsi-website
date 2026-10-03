"use client";

/**
 * A service resident at their post indoors (specs/polish/interiors.md deliverable 1), on the shared character rig like
 * the café owner: they keep a little work loop behind their counter on the shared world clock (lib/game/keepers.ts),
 * look up and wave hello as you come in, turn to you while you're near, talk (the Chat clip, the painted mouth and the
 * voice blips) when you use their station or click them, and say what the room hands them (the Oracle's quiz
 * reactions). The overhead bubble, "!" and nameplate are the residents' (residents.module.css), toggled through refs:
 * nothing here sets React state in the frame loop.
 */
import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import Character, { CHARACTER_HEIGHT, type CharacterMotion } from "./character/Character";
import { hashSeed, parseLook, randomLook, seeded } from "@/lib/game/character/look";
import { calculateCurvedHtmlPosition } from "@/lib/game/worldProjection";
import { AudioManager } from "@/lib/game/audio";
import { easeFacing } from "@/lib/game/locomotion";
import { worldNow } from "@/lib/game/worldClock";
import { hash01 } from "@/lib/game/worldFx";
import { OWNER_WALK, ownerAt, type OwnerPose } from "@/lib/game/cafe";
import { KEEPER_BUBBLE_S, KEEPER_ENTRY_S, KEEPER_NOTICE, KEEPER_POSTS, KEEPER_QUIET_S, keeperGreets, keeperYaw, talkSeconds, type KeeperRoom } from "@/lib/game/keepers";
import { PROPOSED_RESIDENTS, RESIDENT_LOOKS } from "@/lib/content/residentRoster";
import { useNPCPersonas } from "@/lib/content/loader";
import s from "./residents.module.css";

/** The bubble stack never sits lower than this above the bottom edge: the prompt lives there (as the residents'). */
const PROMPT_CLEAR = 132;
/** The "!" shows this long as they notice you, then the nameplate stays while you're near. */
const NOTICE_S = 2.4;
const labelPoint = (object: THREE.Object3D, camera: THREE.Camera, size: { width: number; height: number }) => {
  const [x, y] = calculateCurvedHtmlPosition(object, camera, size);
  return [x, y > size.height ? y : Math.min(y, size.height - PROMPT_CLEAR)];
};

interface Ui { bubble: RefObject<HTMLDivElement | null>; text: RefObject<HTMLSpanElement | null>; notice: RefObject<HTMLDivElement | null>; plate: RefObject<HTMLDivElement | null> }
/** One keeper's live state, written only by its frame loop (and `pending` by events). */
interface Runtime {
  slug: string; seed: number; lines: readonly string[]; next: number;
  /** A line to say on the next frame (a click, the room's event), and whether it opens with a wave. */
  pending: string | null; wave: boolean;
  /** The work clock runs this many seconds behind the world's: talking pauses it. */
  lag: number; talkUntil: number; bubbleUntil: number; quietUntil: number;
  entryAt: number | null; entered: boolean; near: boolean; noticedAt: number; engaged: boolean;
  /** The work routine's pose (reused every frame) and the station they last stopped at (-1 walking). */
  at: OwnerPose; station: number;
  x: number; z: number; ready: boolean; idleBeat: number; shown: number; line: string; timers: number[];
}

/** When each keeper (by slug) may say hello again: kept across visits, so walking out and back in isn't greeted twice. */
const quietBySlug = new Map<string, number>();

/** The keeper's frame, at module scope (the react compiler forbids writing through hook values). */
function step(r: Runtime, room: KeeperRoom, m: CharacterMotion, g: THREE.Group | null, ui: Ui, p: THREE.Vector3, frozen: boolean, engaged: boolean, dt: number) {
  const now = worldNow() / 1000;
  if (!frozen && r.entryAt === null) r.entryAt = now + KEEPER_ENTRY_S;
  // Using their station (its sheet open): they talk you through it, a beat of the Chat clip and the mouth.
  if (engaged && !r.engaged) { r.talkUntil = Math.max(r.talkUntil, now + 1.8); m.talk = 1.4; }
  r.engaged = engaged;
  // Talking (or serving you at their station) holds their work: the clock they work to falls behind the world's.
  const busy = now < r.talkUntil || engaged;
  if (busy) r.lag += dt;
  const at = ownerAt(now - r.lag, KEEPER_POSTS[room].stations, r.at);
  if (!r.ready || !busy) { r.x = at.x; r.z = at.z; }
  if (!r.ready) { r.ready = true; m.yaw = at.yaw; }
  const near = Math.hypot(p.x - r.x, p.z - r.z) < KEEPER_NOTICE;
  const entry = !r.entered && r.entryAt !== null && now >= r.entryAt && now >= (quietBySlug.get(r.slug) ?? 0);
  if (r.pending === null && keeperGreets(entry, near, r.near, now, r.quietUntil, busy)) {
    r.pending = r.lines[r.next++ % r.lines.length]; r.wave = true;
  }
  if (r.entryAt !== null && now >= r.entryAt) r.entered = true;
  if (near && !r.near) r.noticedAt = now;
  r.near = near;
  if (r.pending !== null) {
    const line = r.pending;
    r.pending = null; r.line = line; r.shown = -1;
    r.bubbleUntil = now + KEEPER_BUBBLE_S; r.talkUntil = Math.max(r.talkUntil, r.bubbleUntil); r.quietUntil = now + KEEPER_QUIET_S;
    quietBySlug.set(r.slug, r.quietUntil);
    m.talk = talkSeconds(line);
    if (r.wave) m.play = "Wave";
    r.wave = false;
    AudioManager.playBlip();
    r.timers.forEach(window.clearTimeout);
    r.timers = [140, 300].map(ms => window.setTimeout(() => AudioManager.playBlip(), ms));
  }
  const attend = busy || (near && !at.moving);
  // Reaching under the counter: once per stop there, and not while they're attending to you.
  const station = at.moving ? -1 : at.station;
  if (station >= 0 && !attend && station !== r.station && at.clip === "Forage") m.play = "Forage";
  r.station = station;
  // Now and then at a quiet station: a look round or a stretch (the residents' idles), seeded per keeper and beat.
  const beat = Math.floor(now / 9);
  if (!at.moving && !attend && at.clip === "Idle" && beat !== r.idleBeat) {
    r.idleBeat = beat;
    const roll = hash01(r.seed, beat);
    if (roll < 0.22) m.play = "LookAround"; else if (roll < 0.3) m.play = "StretchUp";
  }
  // Talking: the Chat clip under the mouth (after a wave); serving at the station, attentive; else the station's work.
  m.pose = now < r.talkUntil ? "Chat" : !attend && !at.moving && at.clip === "Trace" ? "Trace" : null;
  m.speed = busy ? 0 : at.moving ? OWNER_WALK : 0;
  // Walking, the way they go; otherwise their work, or you (turned no further than their counter allows).
  const want = at.moving && !busy ? at.yaw : keeperYaw(KEEPER_POSTS[room].stations[at.station].yaw, r.x, r.z, p.x, p.z, attend);
  m.yaw = easeFacing(m.yaw, want, busy ? 8 : 6, dt);
  g?.position.set(r.x, 0, r.z);
  // Which overhead pieces show, as bits (bubble, a brief "!" as they notice you, nameplate): the DOM is touched only when they change.
  const bubble = now < r.bubbleUntil;
  const state = (bubble ? 1 : 0) | (near && !bubble && now - r.noticedAt < NOTICE_S ? 2 : 0) | (near || bubble || engaged ? 4 : 0);
  if (state !== r.shown && ui.plate.current) {
    r.shown = state;
    if (bubble && ui.text.current && ui.text.current.textContent !== r.line) ui.text.current.textContent = r.line;
    show(ui.bubble.current, bubble); show(ui.notice.current, (state & 2) > 0); show(ui.plate.current, (state & 4) > 0);
  }
}
function show(el: HTMLElement | null, on: boolean) { if (el && el.hidden === on) el.hidden = !on; }
/** Module scope: a line from outside the frame loop (a click, the room's event) waits for the next frame. */
function queue(r: Runtime | null, line: string | null, wave: boolean) { if (r && line) { r.pending = line; r.wave = wave; } }
function newRuntime(slug: string, lines: readonly string[]): Runtime {
  return { slug, seed: hashSeed(slug), lines, next: 0, pending: null, wave: false, lag: 0, talkUntil: 0, bubbleUntil: 0, quietUntil: quietBySlug.get(slug) ?? 0,
    entryAt: null, entered: false, near: false, noticedAt: 0, engaged: false, at: { x: 0, z: 0, yaw: 0, clip: "Idle", moving: false, station: 0 }, station: -1,
    x: 0, z: 0, ready: false, idleBeat: -1, shown: -1, line: "", timers: [] };
}
/** A persona edit (the Residents editor) changes what they say, not where they are. */
function relines(r: Runtime | null, slug: string, lines: readonly string[]) { if (r && r.slug === slug) r.lines = lines; }

export default function Keeper({ room, player, frozen, engaged = false, sayEvent }: {
  room: KeeperRoom; player: RefObject<THREE.Vector3>;
  /** The room is still under the door fade (or held by a sheet): the hello waits until it shows. */
  frozen: boolean;
  /** Their station's sheet is open: they face you and talk you through it. */
  engaged?: boolean;
  /** A window event whose `detail.line` they say (the Oracle quiz's `tsi:oracle-keeper` reactions). */
  sayEvent?: string;
}) {
  const post = KEEPER_POSTS[room];
  // The persona holding the post (the Residents editor) wins; until one does, the proposed roster's resident.
  const { data: personas } = useNPCPersonas({ permanentOnly: true });
  const persona = personas.find(p => p.post === post.post) ?? PROPOSED_RESIDENTS.find(r => r.slug === post.slug)!;
  const look = useMemo(() => (RESIDENT_LOOKS[persona.slug] ? parseLook(RESIDENT_LOOKS[persona.slug]) : randomLook(seeded(hashSeed(persona.slug)))), [persona.slug]);
  const lines = persona.canned_dialogue?.length ? persona.canned_dialogue : PROPOSED_RESIDENTS.find(r => r.slug === post.slug)!.canned_dialogue;
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: Math.PI, lift: 0, pose: null, play: null });
  const group = useRef<THREE.Group>(null);
  const bubble = useRef<HTMLDivElement>(null), text = useRef<HTMLSpanElement>(null), notice = useRef<HTMLDivElement>(null), plate = useRef<HTMLDivElement>(null);
  const ui = useMemo<Ui>(() => ({ bubble, text, notice, plate }), []);
  const runtime = useRef<Runtime | null>(null);
  const linesRef = useRef(lines);
  useEffect(() => {
    const r = newRuntime(persona.slug, linesRef.current);
    runtime.current = r;
    return () => { r.timers.forEach(window.clearTimeout); runtime.current = null; };
  }, [persona.slug]);
  useEffect(() => { linesRef.current = lines; relines(runtime.current, persona.slug, lines); }, [persona.slug, lines]);
  useEffect(() => {
    if (!sayEvent) return;
    const on = (e: Event) => queue(runtime.current, (e as CustomEvent<{ line?: string }>).detail?.line ?? null, false);
    window.addEventListener(sayEvent, on);
    return () => window.removeEventListener(sayEvent, on);
  }, [sayEvent]);
  useFrame((_, raw) => { if (runtime.current) step(runtime.current, room, motion.current, group.current, ui, player.current, frozen, engaged, Math.min(raw, 0.1)); });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const r = runtime.current;
    queue(r, r ? r.lines[r.next++ % r.lines.length] : null, true);
  };
  const hover = (on: boolean) => (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = on ? "pointer" : "auto"; };
  return <group ref={group}>
    <group onClick={click} onPointerOver={hover(true)} onPointerOut={hover(false)}>
      <Suspense fallback={null}><Character look={look} motion={motion} walkSpeed={OWNER_WALK} /></Suspense>
    </group>
    <Html calculatePosition={labelPoint} position={[0, CHARACTER_HEIGHT + 0.3, 0]} zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
      <div className={s.stack}>
        <div ref={bubble} className={s.bubble} hidden><b>{persona.display_name}</b><span ref={text} /></div>
        <div ref={notice} className={s.notice} hidden aria-hidden="true">!</div>
        <div ref={plate} className={s.plate} hidden>{persona.display_name}<small>{post.title}</small></div>
      </div>
    </Html>
  </group>;
}
