"use client";

import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import Character, { CHARACTER_HEIGHT, CHARACTER_SCALE, type CharacterMotion } from "./character/Character";
import { hashSeed, parseLook, randomLook, seeded, type CharacterLook } from "@/lib/game/character/look";
import { seatLift } from "@/lib/game/character/clips";
import { calculateCurvedHtmlPosition } from "@/lib/game/worldProjection";
import { AudioManager } from "@/lib/game/audio";
import { easeFacing } from "@/lib/game/locomotion";
import { worldNow } from "@/lib/game/worldClock";
import { liveSunDays } from "@/lib/game/sunTimes";
import { phaseInstant } from "@/lib/game/sunPath";
import { landmark, type VillageIsland } from "@/lib/game/defaultIsland";
import { objectsOf, type Village } from "@/lib/game/villageMap";
import type { IslandPhase } from "@/lib/game/islandTime";
import { RESIDENT_STRIDE, RESIDENT_WALK, ResidentDay, daySpan, idleAt, navGrid, newPose, phaseOn, planResident, type DaySpan, type NavGrid, type ResidentPose } from "@/lib/game/residentRoutine";
import { hash01 } from "@/lib/game/worldFx";
import { RESIDENT_LOOKS } from "@/lib/content/residentRoster";
import { dropWalker, setWalker } from "@/lib/game/footprintWalkers";
import type { NPCPersona } from "@/lib/content/types";
import s from "./residents.module.css";

/**
 * The village's residents (specs/polish/living-village.md deliverables 1-2; rows 85, 105, 122) on the shared
 * character rig. Where each one is comes from their routine on the shared world clock (lib/game/residentRoutine.ts):
 * they walk a path between stops at stride speed, stop and idle (look round, stretch, gaze at the water, sit on a
 * bench, chat with whoever else is there), face where they're going, and turn to you only once they've stopped and
 * you're close. At night they go in through their door or sit on a bench under the lamp.
 *
 * Only what one viewer sees is local: turning to you, the greeting bubble, waiting while you stand in their way (they
 * catch up after, a little brisker). One frame loop drives them all; the overhead UI is plain DOM toggled by refs, so
 * nothing calls setState per frame.
 */

/** How close before they notice you: the nameplate and the "!" show, and a greeting the first time. */
const NOTICE_RANGE = 4.5;
/** Stopped residents turn to face you inside this. */
const FACE_RANGE = 3.4;
/** Two stopped residents this close chat. */
const CHAT_RANGE = 2.6;
/** The greeting bubble's life and the quiet after it. */
const BUBBLE_S = 4.2, BUBBLE_COOLDOWN_S = 22;
/** Standing this close in front of a walking resident stops them, when there's no room to step round. */
const BLOCK_RANGE = 0.95;
/** How far off their path a resident steps to pass you. */
const CLEAR_SIDE = 0.95;
/** How fast a resident who fell behind (waited for you, talked) catches up: the routine runs this much faster. */
const CATCH_UP = 0.35;
/** The bubble stack never sits lower than this above the bottom edge: the prompt lives there. */
const PROMPT_CLEAR = 132;

// Fillers (no canned_dialogue) draw from a cozy pool. Original lines, gently TSI-flavoured.
const FILLER_LINES = [
  "Nice day, eh?", "Hm hm hmm ♪", "The bridge creaks a little. I like it.", "I could watch the river all day.",
  "New folks keep arriving. It's good to see.", "The fireflies come out by the water at night.", "If you're building something, the HQ's the place.",
  "The flowers grow back if you're patient.", "Pull up a bench, stay a while.", "Quiet mornings are my favourite kind.",
];
const POST_LABEL: Record<string, string> = {
  hq_lead: "Clubhouse", shopkeeper: "Shopkeeper", cafe_owner: "Café owner", museum_curator: "Museum curator",
  wharf_keeper: "Wharf keeper", oracle_keeper: "Oracle keeper", workshop_crafter: "Workshop", villager: "Villager",
};

const labelPoint = (object: THREE.Object3D, camera: THREE.Camera, size: { width: number; height: number }) => {
  const [x, y] = calculateCurvedHtmlPosition(object, camera, size);
  return [x, Math.min(y, size.height - PROMPT_CLEAR)];
};

/** The overhead elements, as refs: drei's Html mounts them in its own root, after the figure's effects run. */
interface Ui { bubble: RefObject<HTMLDivElement | null>; text: RefObject<HTMLSpanElement | null>; notice: RefObject<HTMLDivElement | null>; plate: RefObject<HTMLDivElement | null> }
/** One resident's live state, owned by its figure and driven by the residents' frame loop. */
interface Runtime {
  id: string; seed: number; lines: readonly string[]; day: ResidentDay; gather: readonly [number, number];
  home: readonly [number, number] | null;
  pose: ResidentPose; motion: RefObject<CharacterMotion>; group: RefObject<THREE.Group | null>; visual: RefObject<THREE.Group | null>; ui: Ui;
  ready: boolean; x: number; z: number; speed: number;
  /** Their sidestep off the routine's path round someone in the way (eased in and out). */
  ox: number; oz: number; hidden: boolean; lift: number; lag: number;
  /** A walk of its own off the routine (to the ceremony, catching up after a jump): points, next index. */
  detour: [number, number][] | null; detourAt: number; detourGoal: [number, number];
  /** The way they'd face before you or a chat turn them. */
  want: number;
  noticed: boolean; bubbleUntil: number; bubbleNext: number; shown: string;
  idleKey: number; idleVisit: number; laughBeat: number; chat: Runtime | null; hopT: number; hopNext: number; greetAt: number; hovered: boolean;
  timers: number[];
}

/** The residents on stage: by id (greetings) and as a list (the frame loop, which must not allocate). */
interface Registry { map: Map<string, Runtime>; list: Runtime[] }

const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

/** Walk a detour on: toward its next point at `speed`, popping points as they're reached. Returns the step taken. */
function stepDetour(r: Runtime, speed: number, dt: number): number {
  const path = r.detour!;
  let left = speed * dt, moved = 0;
  while (left > 1e-6 && path.length) {
    const [px, pz] = path[0], d = dist(r.x, r.z, px, pz);
    if (d <= left) { r.x = px; r.z = pz; left -= d; moved += d; path.shift(); continue; }
    r.x += (px - r.x) / d * left; r.z += (pz - r.z) / d * left; moved += left; left = 0;
  }
  return moved;
}

interface Clock { span: DaySpan | null; forced: IslandPhase | null; base: number; since: number }
/**
 * The residents' frame, at module scope (the react compiler forbids writing through hook values): where each one is,
 * the chats, then each one's clip, facing, talk and overhead UI.
 */
function tick(list: readonly Runtime[], c: Clock, dt: number, p: THREE.Vector3, phase: IslandPhase, ceremony: boolean, nav: NavGrid, island: VillageIsland, monument: { x: number; z: number } | null) {
  const now = worldNow() / 1000, days = liveSunDays();
  if (!c.span || now < c.span.t0 || now >= c.span.t1) c.span = daySpan(now * 1000, days);
  // A forced phase (?time=, the options menu) runs the routine from that phase's preview time on.
  let t = now;
  if (phaseOn(c.span, now) !== phase) {
    if (c.forced !== phase) { c.forced = phase; c.since = now; c.base = phaseInstant(phase, new Date(now * 1000), days).getTime() / 1000; }
    t = c.base + (now - c.since);
  } else c.forced = null;

  // 1. Where everyone is.
  for (const r of list) {
    const pose = r.day.at(t - r.lag, days, r.pose), m = r.motion.current;
    // Where to make for when off the routine: the ceremony spot, or the routine's door or seat step, or where it is.
    const door = !ceremony && (pose.inside || pose.seat > 0) ? pose.stop?.door : null;
    const gx = ceremony ? r.gather[0] : door ? door[0] : pose.x, gz = ceremony ? r.gather[1] : door ? door[1] : pose.z;
    if (!r.ready) { r.ready = true; r.x = pose.x; r.z = pose.z; r.hidden = pose.inside; m.yaw = pose.yaw; }
    // Coming out of hiding somewhere else (a forced phase while indoors): out through their own door.
    if (r.hidden && !pose.inside && dist(r.x, r.z, pose.x, pose.z) > 0.6 && r.home) { r.x = r.home[0]; r.z = r.home[1]; }
    const onRoutine = !ceremony && !r.detour && dist(r.x, r.z, pose.x + r.ox, pose.z + r.oz) < 0.08 + (pose.speed + 1) * dt * 1.5;
    let speed = 0, yaw = pose.yaw, blocked = false;
    if (onRoutine) {
      // Someone in the way of a walking resident: they step round you off the path, or wait if there's no room.
      let tx = 0, tz = 0;
      if (pose.moving) {
        const fx = Math.sin(pose.yaw), fz = Math.cos(pose.yaw), dx = p.x - pose.x, dz = p.z - pose.z;
        const ahead = dx * fx + dz * fz, side = dx * fz - dz * fx;
        if (ahead > -0.5 && ahead < 1.8 && Math.abs(side) < CLEAR_SIDE) {
          // Away from you if there's room, else past your other side.
          const away = side >= 0 ? -1 : 1, near = CLEAR_SIDE - Math.abs(side), far = CLEAR_SIDE + Math.abs(side);
          if (nav.fits(pose.x + fz * away * near, pose.z - fx * away * near)) { tx = fz * away * near; tz = -fx * away * near; }
          else if (nav.fits(pose.x - fz * away * far, pose.z + fx * away * far)) { tx = -fz * away * far; tz = fx * away * far; }
          else blocked = dist(p.x, p.z, pose.x, pose.z) < BLOCK_RANGE && ahead > 0.1;
        }
      }
      r.ox = THREE.MathUtils.damp(r.ox, tx, 5, dt); r.oz = THREE.MathUtils.damp(r.oz, tz, 5, dt);
      if (blocked) r.lag += dt;
      else {
        const px = r.x, pz = r.z;
        r.x = pose.x + r.ox; r.z = pose.z + r.oz;
        const moved = dist(r.x, r.z, px, pz);
        speed = pose.moving ? Math.max(pose.speed, dt > 0 ? moved / dt : 0) : dt > 0 && moved > 1e-4 ? moved / dt : 0;
        if (moved > 1e-4) yaw = Math.atan2(r.x - px, r.z - pz);
      }
      r.hidden = pose.inside;
    } else if (dist(r.x, r.z, gx, gz) < 0.03) {
      // There (the ceremony spot, or a door or seat the routine is behind): step onto the routine.
      r.detour = null;
      if (!ceremony) { r.x = pose.x; r.z = pose.z; r.hidden = pose.inside; }
    } else {
      // Off the routine: walk (a path round every solid) to where it is now, or to the ceremony.
      if (!r.detour || (dist(gx, gz, r.detourGoal[0], r.detourGoal[1]) > 1 && now - r.detourAt > 0.5)) {
        r.detour = nav.path(r.x, r.z, gx, gz)?.slice(1) ?? [[gx, gz]];
        r.detourAt = now; r.detourGoal[0] = gx; r.detourGoal[1] = gz;
      }
      const px = r.x, pz = r.z, moved = stepDetour(r, RESIDENT_WALK * (ceremony ? 1.25 : 1.35), dt);
      speed = dt > 0 ? moved / dt : 0;
      if (moved > 1e-5) yaw = Math.atan2(r.x - px, r.z - pz);
      r.hidden = false;
      if (!r.detour.length) {
        r.detour = null;
        // Arrived where the routine is: step back onto it (at a door or a seat, straight into it).
        if (!ceremony && dist(r.x, r.z, gx, gz) < 0.05) { r.x = pose.x; r.z = pose.z; r.hidden = pose.inside; }
      }
    }
    if (!blocked && r.lag > 0 && !(r.bubbleUntil > now && !pose.moving)) r.lag = Math.max(0, r.lag - CATCH_UP * dt);
    if (r.bubbleUntil > now && !pose.moving) r.lag += dt; // still talking: the routine holds
    r.speed = speed;
    m.speed = speed;
    // Face the way they walk; stopped, the seat's way or the place's view (chat and you come next).
    r.want = speed > 0.05 ? yaw : onRoutine ? pose.yaw : ceremony && monument ? Math.atan2(monument.x - r.x, monument.z - r.z) : m.yaw;
    r.chat = null;
  }

  // 2. Chats: two stopped standing residents near each other face each other and talk, taking turns.
  for (const r of list) {
    if (r.speed > 0.05 || r.hidden || r.pose.seat > 0 || ceremony || r.detour) continue;
    let best: Runtime | null = null, bestD = CHAT_RANGE;
    for (const o of list) {
      if (o === r || o.speed > 0.05 || o.hidden || o.pose.seat > 0 || o.detour) continue;
      const d = dist(r.x, r.z, o.x, o.z);
      if (d < bestD) { bestD = d; best = o; }
    }
    r.chat = best;
  }

  // 3. Each one's clip, facing, talk and overhead UI. One greeting at a time: walking into a group, the first to
  // notice you speaks and the rest just look up.
  let speaking = false;
  for (const r of list) if (r.bubbleUntil > now && !r.hidden) speaking = true;
  for (const r of list) {
    const m = r.motion.current, pose = r.pose, g = r.group.current;
    const d = dist(p.x, p.z, r.x, r.z), stopped = r.speed < 0.05 && !r.detour, sitting = stopped && pose.seat > 0 && dist(r.x, r.z, pose.x, pose.z) < 0.05;
    let want = r.want;
    if (stopped && !sitting && !r.hidden) {
      if (d < FACE_RANGE) want = Math.atan2(p.x - r.x, p.z - r.z);
      else if (r.chat) want = Math.atan2(r.chat.x - r.x, r.chat.z - r.z);
    }
    m.yaw = easeFacing(m.yaw, want, r.speed > 0.05 ? 7 : 4, dt);
    m.pose = sitting ? "Sit" : null;
    // Chatting: one talks (the Chat clip, the mouth) while the other listens, swapping every few seconds; now and then a laugh.
    if (r.chat && d >= FACE_RANGE) {
      const pair = r.seed ^ r.chat.seed, turn = Math.floor(now / 3.4 + hash01(pair, 1) * 4) % 2;
      const talking = (r.seed < r.chat.seed) === (turn === 0);
      if (talking) { m.pose = "Chat"; m.talk = Math.max(m.talk ?? 0, 0.25); }
      const beat = Math.floor(now / 6.5);
      if (!talking && hash01(r.seed, beat) < 0.22 && r.laughBeat !== beat) { m.play = "Laugh"; r.laughBeat = beat; }
    } else if (stopped && !sitting && pose.stop && d >= FACE_RANGE && !ceremony) {
      // Idling at a stop: a look round, a stretch, gazing out, on the routine's own beat.
      const { clip, key } = idleAt(pose.stop, pose.visit, r.seed, pose.stayed);
      if (key !== r.idleKey || pose.visit !== r.idleVisit) {
        if (clip && key >= 0) m.play = clip;
        r.idleKey = key; r.idleVisit = pose.visit;
      }
    }
    // Greeted (a click, the ceremony's cheer): a wave (a cheer at the ceremony) and a hop.
    if (now - r.greetAt < 0.15 && r.hopT < 0) { r.hopT = 0; r.hopNext = now + 2; m.play = ceremony ? "Cheer" : sitting ? null : "Wave"; }
    // Startle when you barge right in.
    if (d < 1.05 && r.hopT < 0 && now > r.hopNext && !sitting && !r.hidden) { r.hopT = 0; r.hopNext = now + 3; }
    let hop = 0;
    if (r.hopT >= 0) { r.hopT += dt; if (r.hopT > 0.35) r.hopT = -1; else hop = Math.sin((r.hopT / 0.35) * Math.PI) * 0.38; }
    r.lift = THREE.MathUtils.damp(r.lift, sitting ? seatLift("Sit", pose.seat, CHARACTER_SCALE) : 0, 7, dt);
    m.lift = r.lift + hop;
    setWalker(r.id, r.x, r.z, !r.hidden && r.lift < 0.05);
    if (g) {
      g.visible = !r.hidden;
      g.position.set(r.x, island.ground(r.x, r.z), r.z);
    }
    const vis = r.visual.current;
    if (vis) { const k = THREE.MathUtils.damp(vis.scale.x, r.hovered ? 1.05 : 1, 12, dt); vis.scale.setScalar(k); }

    // Noticing you: the name and "!" show; the first time (and after a quiet spell) they say a line.
    const noticed = d < NOTICE_RANGE && !r.hidden;
    if (noticed && !r.noticed && now >= r.bubbleNext && !speaking) {
      speaking = true;
      const line = r.lines[Math.floor(hash01(r.seed, Math.floor(now / 30)) * r.lines.length) % r.lines.length];
      r.bubbleUntil = now + BUBBLE_S; r.bubbleNext = now + BUBBLE_COOLDOWN_S;
      if (r.ui.text.current) r.ui.text.current.textContent = line;
      r.shown = "";
      m.talk = Math.min(3.2, 0.8 + line.length * 0.045);
      if (stopped && !sitting && !r.chat) m.play = "Wave";
      AudioManager.playBlip();
      r.timers.forEach(window.clearTimeout);
      r.timers = [140, 300].map(ms => window.setTimeout(() => AudioManager.playBlip(), ms));
    }
    r.noticed = noticed;
    const bubble = r.bubbleUntil > now && !r.hidden, state = `${bubble ? "b" : ""}${noticed && !bubble ? "n" : ""}${(noticed || r.hovered) && !r.hidden ? "p" : ""}`;
    if (state !== r.shown && r.ui.plate.current) {
      r.shown = state;
      show(r.ui.bubble.current, bubble); show(r.ui.notice.current, state.includes("n")); show(r.ui.plate.current, state.includes("p"));
    }
  }
}

function enroll(reg: Registry, r: Runtime) { reg.map.set(r.id, r); reg.list = [...reg.map.values()]; }
function unenroll(reg: Registry, r: Runtime) { if (reg.map.get(r.id) === r) reg.map.delete(r.id); reg.list = [...reg.map.values()]; dropWalker(r.id); }

function show(el: HTMLElement | null, on: boolean) {
  if (el && el.hidden === on) el.hidden = !on;
}

export default function Residents({ personas, phase, ceremony, player, island, v }: {
  personas: readonly NPCPersona[]; phase: IslandPhase; ceremony: boolean; player: RefObject<THREE.Vector3>; island: VillageIsland; v: Village;
}) {
  const nav = useMemo(() => navGrid(island, v), [island, v]);
  const residents = useMemo(() => {
    const sorted = [...personas].sort((a, b) => a.slug.localeCompare(b.slug));
    const sitters = sorted.filter(p => Object.values(p.schedule ?? {}).some(x => x === "bench" || (Array.isArray(x) && x.includes("bench"))));
    const gather = objectsOf("gather", v);
    return sorted.map((persona, i) => {
      const plan = planResident(persona, i, v, island, Math.max(0, sitters.indexOf(persona)));
      const g = gather.length ? gather[i % gather.length] : null;
      const authored = RESIDENT_LOOKS[persona.slug];
      return {
        persona, plan, day: new ResidentDay(plan, nav),
        look: authored ? parseLook(authored) : randomLook(seeded(hashSeed(persona.slug))),
        gather: (g ? [g.x, g.z] : plan.home?.door ?? [0, 0]) as readonly [number, number],
      };
    });
  }, [personas, v, island, nav]);
  const registry = useRef<Registry>({ map: new Map(), list: [] });
  const monument = useMemo(() => landmark("monument", v), [v]);
  const clock = useRef<Clock>({ span: null, forced: null, base: 0, since: 0 });

  // A click (and the ceremony's cheer) greets: a wave and a hop.
  useEffect(() => {
    const onGreet = (e: Event) => {
      const r = registry.current.map.get((e as CustomEvent<{ id: string }>).detail?.id);
      if (r) r.greetAt = worldNow() / 1000;
    };
    window.addEventListener("tsi:npc-greet", onGreet);
    return () => window.removeEventListener("tsi:npc-greet", onGreet);
  }, []);

  useFrame((_, raw) => tick(registry.current.list, clock.current, Math.min(raw, 0.1), player.current, phase, ceremony, nav, island, monument), -3);

  return <>{residents.map(({ persona, day, look, gather, plan }) => (
    <Figure key={persona.id} persona={persona} day={day} look={look} gather={gather} home={plan.home?.door ?? null} seed={plan.seed} registry={registry} />
  ))}</>;
}

function Figure({ persona, day, look, gather, home, seed, registry }: {
  persona: NPCPersona; day: ResidentDay; look: CharacterLook; gather: readonly [number, number]; home: readonly [number, number] | null; seed: number;
  registry: RefObject<Registry>;
}) {
  const group = useRef<THREE.Group>(null), visual = useRef<THREE.Group>(null);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null });
  const bubble = useRef<HTMLDivElement>(null), text = useRef<HTMLSpanElement>(null), notice = useRef<HTMLDivElement>(null), plate = useRef<HTMLDivElement>(null);
  const runtime = useRef<Runtime | null>(null);
  useEffect(() => {
    const r: Runtime = {
      id: persona.id, seed, lines: persona.canned_dialogue?.length ? persona.canned_dialogue : FILLER_LINES, day, gather, home,
      pose: newPose(), motion, group, visual, ui: { bubble, text, notice, plate },
      ready: false, x: 0, z: 0, speed: 0, ox: 0, oz: 0, hidden: false, lift: 0, lag: 0, detour: null, detourAt: 0, detourGoal: [0, 0],
      want: 0, noticed: false, bubbleUntil: 0, bubbleNext: 0, shown: "-", idleKey: -1, idleVisit: -1, laughBeat: -1, chat: null, hopT: -1, hopNext: 0, greetAt: 0, hovered: false, timers: [],
    };
    runtime.current = r;
    const reg = registry.current;
    enroll(reg, r);
    return () => { r.timers.forEach(window.clearTimeout); unenroll(reg, r); runtime.current = null; };
  }, [persona, day, gather, home, seed, registry]);

  const hover = (on: boolean) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (runtime.current) runtime.current.hovered = on;
    document.body.style.cursor = on ? "pointer" : "auto";
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    window.dispatchEvent(new CustomEvent("tsi:npc-greet", { detail: { id: persona.id } }));
  };
  return <group ref={group}>
    <group ref={visual} onClick={click} onPointerOver={hover(true)} onPointerOut={hover(false)}>
      <Suspense fallback={null}><Character look={look} motion={motion} walkSpeed={RESIDENT_STRIDE} /></Suspense>
    </group>
    <Html calculatePosition={labelPoint} position={[0, CHARACTER_HEIGHT + 0.3, 0]} zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
      <div className={s.stack}>
        <div ref={bubble} className={s.bubble} hidden><b>{persona.display_name}</b><span ref={text} /></div>
        <div ref={notice} className={s.notice} hidden aria-hidden="true">!</div>
        <div ref={plate} className={s.plate} hidden>{persona.display_name}{persona.post && POST_LABEL[persona.post] && <small>{POST_LABEL[persona.post]}</small>}</div>
      </div>
    </Html>
  </group>;
}
