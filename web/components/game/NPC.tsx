"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
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
import { benchHeld, landmark, type VillageIsland } from "@/lib/game/defaultIsland";
import { objectsOf, type Village } from "@/lib/game/villageMap";
import type { IslandPhase } from "@/lib/game/islandTime";
import { RESIDENT_STRIDE, RESIDENT_WALK, ResidentDay, daySpan, idleAt, navGrid, newPose, phaseOn, planResidents, seatChoice, type DaySpan, type IdleClip, type NavGrid, type ResidentPose } from "@/lib/game/residentRoutine";
import { torontoHour } from "@/lib/game/islandTime";
import { hash01 } from "@/lib/game/worldFx";
import { RESIDENT_LOOKS } from "@/lib/content/residentRoster";
import { dropWalker, setWalker } from "@/lib/game/footprintWalkers";
import { orbit } from "@/lib/game/orbitCamera";
import { TALK_CLICK_RANGE, TALK_PITCH, TALK_RANGE, beginTalk, endTalk, leaveTalk, nearestTalker, requestTalk, routineLag, setTalkNear, startTalk, talkCameraYaw, talkChanged, talkStore, talkTyping } from "@/lib/game/residentTalk";
import { fillName, lineTime, linesNow, pickConversation, talkFor } from "@/lib/content/talk";
import type { FaceOverride } from "@/lib/game/character/face";
import { useStepDust } from "./movement/moveFx";
import type { NPCPersona } from "@/lib/content/types";
import { remoteNear, remoteSeatTaken, useOthersIn } from "./net/active";
import { residentsHome } from "./net/thinning";
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
 *
 * Talking (specs/polish/reachability.md deliverable 1; lib/game/residentTalk.ts): walk up and press E, or click or tap
 * them, and they stop where they are, turn to you with a "!" and talk in the dialogue box (TalkBox): the Chat clip and
 * their painted mouth while a line types out, the line's expression on their face, a wave goodbye. Their routine holds
 * while you talk and catches up after, from the spot they stopped.
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
/** The bubble stack never sits lower than this above the bottom edge: the prompt lives there. */
const PROMPT_CLEAR = 132;
/** A player this close to a bench slot is sitting in it (a bench is solid: standing, you can't get nearer). */
const SLOT_NEAR = 0.4;

// Fillers (no canned_dialogue) draw from a cozy pool. Original lines, gently TSI-flavoured.
const FILLER_LINES = [
  "Nice day, eh?", "Hm hm hmm ♪", "The bridge creaks a little. I like it.", "I could watch the river all day.",
  "New folks keep arriving. It's good to see.", "The fireflies come out by the water at night.", "If you're building something, the HQ's the place.",
  "The flowers grow back if you're patient.", "Pull up a bench, stay a while.", "Quiet mornings are my favourite kind.",
];
const POST_LABEL: Record<string, string> = {
  hq_lead: "HQ", shopkeeper: "Shopkeeper", cafe_owner: "Café owner", museum_curator: "Museum curator",
  wharf_keeper: "Wharf keeper", oracle_keeper: "Oracle keeper", workshop_crafter: "Workshop", villager: "Villager",
};

/** Over the head, lifted clear of the prompt band; a resident below the bottom edge (off screen) takes the label with them. */
const labelPoint = (object: THREE.Object3D, camera: THREE.Camera, size: { width: number; height: number }) => {
  const [x, y] = calculateCurvedHtmlPosition(object, camera, size);
  return [x, y > size.height ? y : Math.min(y, size.height - PROMPT_CLEAR)];
};

/** The overhead elements, as refs: drei's Html mounts them in its own root, after the figure's effects run. */
interface Ui { bubble: RefObject<HTMLDivElement | null>; text: RefObject<HTMLSpanElement | null>; notice: RefObject<HTMLDivElement | null>; plate: RefObject<HTMLDivElement | null> }
/** One resident's live state, owned by its figure and driven by the residents' frame loop. */
interface Runtime {
  id: string; slug: string; seed: number; lines: readonly string[]; day: ResidentDay; gather: readonly [number, number];
  /** Who they are in the dialogue box, and the row their conversations come from (lib/content/talk.ts, picked by the time of day). */
  name: string; post: string | null; persona: NPCPersona;
  /** In a talk with you last frame, the phase and line it was at (their wave and face follow it), and the face they make. */
  talking: boolean; talkAt: string; face: FaceOverride;
  home: readonly [number, number] | null;
  pose: ResidentPose; motion: RefObject<CharacterMotion>; group: RefObject<THREE.Group | null>; visual: RefObject<THREE.Group | null>; ui: Ui;
  ready: boolean; x: number; z: number; speed: number;
  /** Their sidestep off the routine's path round someone in the way (eased in and out). */
  ox: number; oz: number; hidden: boolean; lift: number; lag: number;
  /** A walk of its own off the routine (to the ceremony, catching up after a jump): points, next index. */
  detour: [number, number][] | null; detourAt: number; detourGoal: [number, number];
  /** The way they'd face before you or a chat turn them. */
  want: number;
  noticed: boolean; bubbleUntil: number; bubbleNext: number; shown: number;
  /** The line being said (written into the bubble whenever it shows: drei's Html may mount after the greeting). */
  line: string;
  idleKey: number; idleVisit: number; laughBeat: number; chat: Runtime | null; hopT: number; hopNext: number; greetAt: number; hovered: boolean;
  timers: number[];
  /**
   * The bench seat model (defaultIsland BENCH_SLOTS): the slot they sit in or are taking (`bench:<id>#0|1`, "" none),
   * which they took this visit (seatChoice: 0 theirs, 1 the bench's other slot, 2 standing by) and the visit.
   */
  seatKey: string; seatPick: 0 | 1 | 2; seatVisit: number;
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

const _idle: { clip: IdleClip; key: number } = { clip: null, key: -1 };

/** The frame's view for the module-scope checks below (nothing is allocated per frame): who's asking, everyone, you. */
const seen = { self: null as Runtime | null, list: [] as readonly Runtime[], px: 0, pz: 0 };
/** Someone else holds a bench slot: a player's seat claim, a player in it (you, or a remote whose claim is on its way), or another resident. */
function slotHeld(key: string, x: number, z: number): boolean {
  if (remoteSeatTaken(key) || remoteNear(x, z, SLOT_NEAR) || dist(seen.px, seen.pz, x, z) < SLOT_NEAR) return true;
  for (const o of seen.list) if (o !== seen.self && o.seatKey === key) return true;
  return false;
}
interface Clock { span: DaySpan | null; forced: IslandPhase | null; base: number; since: number }
/** Talks so far this visit by resident (slug): each one after the first is their next conversation (row 92: nothing is counted on the server). */
const talksBySlug = new Map<string, number>();
/** Over the shoulder while you talk, and back the way it was after. */
const face = (detail: { x: number; z: number } | null) => window.dispatchEvent(new CustomEvent("tsi:face", { detail }));

/** A talk asked for (E, a click or tap) starts here, where their position and lines are: E's is in reach; a click from farther away gets a wave. */
function startRequested(list: readonly Runtime[], c: Clock, p: THREE.Vector3, now: number, playerName: string | null, ceremony: boolean, phase: IslandPhase, t: number) {
  const req = talkStore.request;
  talkStore.request = null;
  if (!req || talkStore.active) return;
  let r: Runtime | null = null;
  for (const x of list) if (x.id === req.id) r = x;
  if (!r || r.hidden || ceremony) return;
  const d = dist(p.x, p.z, r.x, r.z);
  if (d > (req.click ? TALK_CLICK_RANGE : TALK_RANGE + 0.6)) { if (req.click) r.greetAt = now; return; }
  const n = talksBySlug.get(r.slug) ?? 0;
  talksBySlug.set(r.slug, n + 1);
  // What they'd say now (a morning conversation only in the morning).
  const talk = talkFor(r.persona, { phase, hour: torontoHour(new Date(t * 1000)) });
  const conv = talk[pickConversation(talk.length, r.slug, c.span?.key ?? "", n)] ?? [];
  startTalk(beginTalk({ id: r.id, slug: r.slug, name: r.name, post: r.post, seed: r.seed }, conv.map(l => ({ text: fillName(l.text, playerName), face: l.face })), performance.now() / 1000));
  talkStore.cameraYaw = orbit.target.yaw; talkStore.cameraPitch = orbit.target.pitch;
  orbit.target.yaw = talkCameraYaw(p.x, p.z, r.x, r.z, orbit.target.yaw);
  orbit.target.pitch = Math.min(orbit.target.pitch, TALK_PITCH);
  face({ x: r.x, z: r.z });
}
/**
 * The residents' frame, at module scope (the react compiler forbids writing through hook values): where each one is,
 * the chats, then each one's clip, facing, talk and overhead UI.
 */
function tick(list: readonly Runtime[], c: Clock, dt: number, p: THREE.Vector3, phase: IslandPhase, ceremony: boolean, nav: NavGrid, island: VillageIsland, monument: { x: number; z: number } | null, away: string | null, playerName: string | null,
  home: ReadonlySet<string>) {
  const now = worldNow() / 1000, days = liveSunDays();
  seen.list = list; seen.px = p.x; seen.pz = p.z;
  // The club's ceremony calls everyone to the monument: a talk going on says goodbye.
  const talk = talkStore.active;
  if (talk && ceremony && talk.phase !== "closing" && talk.phase !== "ended") { leaveTalk(talk, performance.now() / 1000); talkChanged(); }
  const talkingId = talk && talk.phase !== "ended" ? talk.id : null, typing = talkTyping(talk);
  if (!c.span || now < c.span.t0 || now >= c.span.t1) c.span = daySpan(now * 1000, days);
  // A forced phase (?time=, the options menu) runs the routine from that phase's preview time on.
  let t = now;
  if (phaseOn(c.span, now) !== phase) {
    if (c.forced !== phase) { c.forced = phase; c.since = now; c.base = phaseInstant(phase, new Date(now * 1000), days).getTime() / 1000; }
    t = c.base + (now - c.since);
  } else c.forced = null;
  if (talkStore.request) startRequested(list, c, p, now, playerName, ceremony, phase, t);

  // 1. Where everyone is.
  for (const r of list) {
    const talking = r.id === talkingId;
    const pose = r.day.at(t - r.lag, days, r.pose), m = r.motion.current, st = pose.stop;
    seen.self = r;
    // One seat model (world audit item 3): sitting down, or about to, in a slot someone else holds (a player's claim,
    // a player or bot in it, another resident), they take the bench's other slot, or stand at their seat's step.
    let seatDoor = st?.door ?? null;
    r.seatKey = "";
    if (st?.seatKey && !ceremony && (pose.seat > 0 || (pose.moving && dist(pose.x, pose.z, st.at[0], st.at[1]) < 1.1))) {
      if (pose.visit !== r.seatVisit) { r.seatVisit = pose.visit; r.seatPick = 0; }
      if (!talking) r.seatPick = seatChoice(st, slotHeld, r.seatPick);
      if (r.seatPick === 1 && st.alt) { pose.x = st.alt.at[0]; pose.z = st.alt.at[1]; pose.seat = st.seat ?? 0; seatDoor = st.alt.door; r.seatKey = st.alt.key; }
      else if (r.seatPick === 2 && st.door) { pose.x = st.door[0]; pose.z = st.door[1]; pose.seat = 0; pose.yaw = st.yaw + Math.PI; seatDoor = null; }
      else r.seatKey = st.seatKey;
      if (r.seatPick) { pose.moving = false; pose.speed = 0; }
    }
    // Players filling the village send this flavour villager home (multiplayer §5.8): in through their own door, out
    // again as it empties. A talk goes on first; the ceremony calls everyone out; already in by their routine, they stay.
    const homeward = home.has(r.slug) && !talking && !ceremony && !(r.hidden && pose.inside);
    // Where to make for when off the routine: the ceremony spot, home, or the routine's door or seat step, or where it is.
    const door = homeward ? r.home : !ceremony && (pose.inside || pose.seat > 0) ? seatDoor : null;
    const gx = ceremony ? r.gather[0] : door ? door[0] : pose.x, gz = ceremony ? r.gather[1] : door ? door[1] : pose.z;
    if (!r.ready) { r.ready = true; r.x = pose.x; r.z = pose.z; r.hidden = pose.inside; m.yaw = pose.yaw; if (homeward && r.home) { r.x = r.home[0]; r.z = r.home[1]; r.hidden = true; } }
    // Coming out of hiding somewhere else (a forced phase while indoors, the village emptying): out through their own door.
    if (r.hidden && !pose.inside && dist(r.x, r.z, pose.x, pose.z) > 0.6 && r.home) { r.x = r.home[0]; r.z = r.home[1]; }
    const onRoutine = !homeward && !ceremony && !r.detour && dist(r.x, r.z, pose.x + r.ox, pose.z + r.oz) < 0.08 + (pose.speed + 1) * dt * 1.5;
    let speed = 0, yaw = pose.yaw, blocked = false;
    // Talking with you: they stand where they stopped (the routine and any walk of their own hold) until you part.
    if (talking) speed = 0;
    else if (onRoutine) {
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
      if (!blocked) {
        const px = r.x, pz = r.z;
        r.x = pose.x + r.ox; r.z = pose.z + r.oz;
        const moved = dist(r.x, r.z, px, pz);
        speed = pose.moving ? Math.max(pose.speed, dt > 0 ? moved / dt : 0) : dt > 0 && moved > 1e-4 ? moved / dt : 0;
        if (moved > 1e-4) yaw = Math.atan2(r.x - px, r.z - pz);
      }
      r.hidden = pose.inside;
    } else if (dist(r.x, r.z, gx, gz) < 0.03) {
      // There (the ceremony spot, home, or a door or seat the routine is behind): in, or step onto the routine.
      r.detour = null;
      if (homeward) r.hidden = true;
      else if (!ceremony) { r.x = pose.x; r.z = pose.z; r.hidden = pose.inside; }
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
        // Arrived where the routine is: step back onto it (at a door or a seat, straight into it); home: in.
        if (homeward && dist(r.x, r.z, gx, gz) < 0.05) r.hidden = true;
        else if (!ceremony && dist(r.x, r.z, gx, gz) < 0.05) { r.x = pose.x; r.z = pose.z; r.hidden = pose.inside; }
      }
    }
    // Waiting for you, talking with you, or saying hello where they stand: the routine holds; after, it catches up.
    r.lag = routineLag(r.lag, blocked || talking || (r.bubbleUntil > now && !pose.moving), dt);
    r.speed = speed;
    m.speed = speed;
    // Face the way they walk; stopped, the seat's way or the place's view (chat and you come next).
    r.want = speed > 0.05 ? yaw : onRoutine ? pose.yaw : ceremony && monument ? Math.atan2(monument.x - r.x, monument.z - r.z) : m.yaw;
    r.chat = null;
    if (r.slug === away) r.hidden = true;
  }

  // 2. Chats: two stopped standing residents near each other face each other and talk, taking turns.
  for (const r of list) {
    if (r.speed > 0.05 || r.hidden || r.pose.seat > 0 || ceremony || r.detour || r.id === talkingId) continue;
    let best: Runtime | null = null, bestD = CHAT_RANGE;
    for (const o of list) {
      if (o === r || o.speed > 0.05 || o.hidden || o.pose.seat > 0 || o.detour || o.id === talkingId) continue;
      const d = dist(r.x, r.z, o.x, o.z);
      if (d < bestD) { bestD = d; best = o; }
    }
    r.chat = best;
  }

  // Who E would talk to: the nearest one you can see in reach (none while you're talking, or at the ceremony).
  const near = talkingId || ceremony ? -1 : nearestTalker(list, p.x, p.z);
  if (near < 0) setTalkNear(null, "", Infinity);
  else setTalkNear(list[near].id, list[near].name, dist(p.x, p.z, list[near].x, list[near].z));

  // 3. Each one's clip, facing, talk and overhead UI. One greeting at a time: walking into a group, the first to
  // notice you speaks and the rest just look up; nobody starts one while you're talking with someone.
  // Only the nearest resident who notices you shows the "!" and their name (a bench of three would stack them).
  let speaking = !!talkingId, sx = 0, sz = 0, nearest: Runtime | null = null, nearestD = NOTICE_RANGE;
  // The slots residents sit in, for the bench prompt (benchSeat): rewritten each frame.
  benchHeld.clear();
  for (const r of list) {
    if (r.bubbleUntil > now && !r.hidden) { speaking = true; sx = r.x; sz = r.z; }
    const d = dist(p.x, p.z, r.x, r.z);
    if (!r.hidden && d < nearestD) { nearestD = d; nearest = r; }
  }
  for (const r of list) {
    const m = r.motion.current, pose = r.pose, g = r.group.current, talking = r.id === talkingId;
    const d = dist(p.x, p.z, r.x, r.z), stopped = r.speed < 0.05 && !r.detour, sitting = (stopped || talking) && pose.seat > 0 && dist(r.x, r.z, pose.x, pose.z) < 0.05;
    let want = r.want;
    if ((stopped || talking) && !sitting && !r.hidden) {
      if (d < FACE_RANGE || talking) want = Math.atan2(p.x - r.x, p.z - r.z);
      else if (r.chat) want = Math.atan2(r.chat.x - r.x, r.chat.z - r.z);
    }
    m.yaw = easeFacing(m.yaw, want, talking ? 8 : r.speed > 0.05 ? 7 : 4, dt);
    m.pose = sitting ? "Sit" : null;
    if (sitting && r.seatKey) benchHeld.add(r.seatKey);
    if (talking) {
      // Talking with you: the Chat clip and the mouth while a line types out, the line's face; a wave goodbye. Seated, they stay seated.
      const at = `${talk!.phase}:${talk!.index}`;
      if (at !== r.talkAt) {
        if (!r.talking) { r.bubbleUntil = 0; m.play = null; m.stop = true; }
        if (talk!.phase === "closing" && !sitting) m.play = "Wave";
        r.talkAt = at;
      }
      r.talking = true;
      if (typing && !sitting) m.pose = "Chat";
      if (typing) m.talk = Math.max(m.talk ?? 0, 0.15);
      r.face.expression = talk!.phase === "closing" ? "happy" : talk!.phase === "speaking" ? talk!.lines[talk!.index].face ?? "neutral" : "neutral";
      m.face = r.face;
    } else if (r.talking) {
      // Parted: their own face again, a quiet spell before they greet you, and the camera back where it was.
      r.talking = false; r.talkAt = ""; m.face = null; m.talk = 0;
      r.bubbleNext = Math.max(r.bubbleNext, now + BUBBLE_COOLDOWN_S);
      if (talkStore.cameraYaw !== null) { orbit.target.yaw = talkStore.cameraYaw; talkStore.cameraYaw = null; }
      if (talkStore.cameraPitch !== null) { orbit.target.pitch = talkStore.cameraPitch; talkStore.cameraPitch = null; }
      face(null);
    } else if (r.chat && d >= FACE_RANGE) {
      const pair = r.seed ^ r.chat.seed, turn = Math.floor(now / 3.4 + hash01(pair, 1) * 4) % 2;
      const talking = (r.seed < r.chat.seed) === (turn === 0);
      if (talking) { m.pose = "Chat"; m.talk = Math.max(m.talk ?? 0, 0.25); }
      const beat = Math.floor(now / 6.5);
      if (!talking && hash01(r.seed, beat) < 0.22 && r.laughBeat !== beat) { m.play = "Laugh"; r.laughBeat = beat; }
    } else if (stopped && !sitting && pose.stop && d >= FACE_RANGE && !ceremony) {
      // Idling at a stop: a look round, a stretch, gazing out, on the routine's own beat.
      const idle = idleAt(pose.stop, pose.visit, r.seed, pose.stayed, _idle);
      if (idle.key !== r.idleKey || pose.visit !== r.idleVisit) {
        if (idle.clip && idle.key >= 0) m.play = idle.clip;
        r.idleKey = idle.key; r.idleVisit = pose.visit;
      }
    }
    // Greeted (a click, the ceremony's cheer): a wave (a cheer at the ceremony) and a hop.
    if (now - r.greetAt < 0.15 && r.hopT < 0) { r.hopT = 0; r.hopNext = now + 2; m.play = ceremony ? "Cheer" : sitting ? null : "Wave"; }
    // Startle when you barge right in (not while you're talking with them).
    if (d < 1.05 && r.hopT < 0 && now > r.hopNext && !sitting && !r.hidden && !talking) { r.hopT = 0; r.hopNext = now + 3; }
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
      // A line for the time of day ("Morning!" only in the morning), its time tag left off.
      const said = linesNow(r.lines, phase, torontoHour(new Date(t * 1000))), lines = said.length ? said : FILLER_LINES;
      const line = lineTime(lines[Math.floor(hash01(r.seed, Math.floor(now / 30)) * lines.length) % lines.length]).text;
      r.bubbleUntil = now + BUBBLE_S; r.bubbleNext = now + BUBBLE_COOLDOWN_S;
      r.line = line;
      r.shown = -1;
      m.talk = Math.min(3.2, 0.8 + line.length * 0.045);
      if (stopped && !sitting && !r.chat) m.play = "Wave";
      AudioManager.playBlip();
      r.timers.forEach(window.clearTimeout);
      r.timers = [140, 300].map(ms => window.setTimeout(() => AudioManager.playBlip(), ms));
    }
    r.noticed = noticed;
    // Which overhead pieces show, as bits (bubble, "!", nameplate): the DOM is touched only when they change.
    // Right beside someone who's speaking, a resident's own "!" and nameplate step aside so they never cover the bubble.
    // In a talk the box carries the name and is the only voice: the one you talk to shows only a "!" as they turn to
    // you, and everyone else's bubbles, "!" and names wait until you part.
    const bubble = r.bubbleUntil > now && !r.hidden, crowded = speaking && !bubble && dist(r.x, r.z, sx, sz) < 2.5;
    const first = r === nearest;
    const state = talking ? (talk!.phase === "turning" ? 2 : 0) : talkingId ? 0
      : (bubble ? 1 : 0) | (noticed && first && !bubble && !crowded ? 2 : 0) | (((noticed && first) || r.hovered) && !r.hidden && !crowded ? 4 : 0);
    if (state !== r.shown && r.ui.plate.current) {
      r.shown = state;
      if ((state & 1) && r.ui.text.current && r.ui.text.current.textContent !== r.line) r.ui.text.current.textContent = r.line;
      show(r.ui.bubble.current, (state & 1) > 0); show(r.ui.notice.current, (state & 2) > 0); show(r.ui.plate.current, (state & 4) > 0);
    }
  }
}

function enroll(reg: Registry, r: Runtime) { reg.map.set(r.id, r); reg.list = [...reg.map.values()]; }
function unenroll(reg: Registry, r: Runtime) { if (reg.map.get(r.id) === r) reg.map.delete(r.id); reg.list = [...reg.map.values()]; dropWalker(r.id); }

function show(el: HTMLElement | null, on: boolean) {
  if (el && el.hidden === on) el.hidden = !on;
}

export default function Residents({ personas, phase, ceremony, player, island, v, away = null, playerName = null }: {
  personas: readonly NPCPersona[]; phase: IslandPhase; ceremony: boolean; player: RefObject<THREE.Vector3>; island: VillageIsland; v: Village;
  /** A resident (slug) who is somewhere else for now (the HQ lead greeting a first login on the wharf): out of sight, routine running. */
  away?: string | null;
  /** The member's island name, for the `{name}` in what residents say to them. */
  playerName?: string | null;
}) {
  const nav = useMemo(() => navGrid(island, v), [island, v]);
  // Dev only: `?residents=N` keeps the first N (by slug), for performance checks like CharacterCrowd's `?crowd=N`.
  const [cap] = useState(() => (process.env.NODE_ENV !== "production" && typeof window !== "undefined" ? Number(new URLSearchParams(window.location.search).get("residents") ?? Infinity) : Infinity));
  const residents = useMemo(() => {
    const sorted = [...personas].sort((a, b) => a.slug.localeCompare(b.slug)).slice(0, cap);
    const plans = planResidents(sorted, v, island), gather = objectsOf("gather", v);
    return sorted.map((persona, i) => {
      const plan = plans[i];
      const g = gather.length ? gather[i % gather.length] : null;
      const authored = RESIDENT_LOOKS[persona.slug];
      return {
        persona, plan, day: new ResidentDay(plan, nav),
        look: authored ? parseLook(authored) : randomLook(seeded(hashSeed(persona.slug))),
        gather: (g ? [g.x, g.z] : plan.home?.door ?? [0, 0]) as readonly [number, number],
      };
    });
  }, [personas, v, island, nav, cap]);
  const registry = useRef<Registry>({ map: new Map(), list: [] });
  const monument = useMemo(() => landmark("monument", v), [v]);
  const clock = useRef<Clock>({ span: null, forced: null, base: 0, since: 0 });
  // The other players in the village (room state, 0 offline or alone): flavour villagers walk home as it fills.
  const others = useOthersIn("village");
  const home = useMemo(() => residentsHome(personas, others), [personas, others]);

  // A click (and the ceremony's cheer) greets: a wave and a hop.
  useEffect(() => {
    const onGreet = (e: Event) => {
      const r = registry.current.map.get((e as CustomEvent<{ id: string }>).detail?.id);
      if (r) r.greetAt = worldNow() / 1000;
    };
    window.addEventListener("tsi:npc-greet", onGreet);
    return () => window.removeEventListener("tsi:npc-greet", onGreet);
  }, []);

  useFrame((_, raw) => tick(registry.current.list, clock.current, Math.min(raw, 0.1), player.current, phase, ceremony, nav, island, monument, away, playerName, home), -3);
  // Leaving the village (a door, the boat) ends any talk and the prompt with it, and frees the benches.
  useEffect(() => () => { if (talkStore.active) endTalk(); setTalkNear(null, "", Infinity); benchHeld.clear(); }, []);
  // Dev (evidence scripts): where everyone is, to walk up to one.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    Object.assign(window, { __residents: () => registry.current.list.map(r => ({ id: r.id, slug: r.slug, name: r.name, x: r.x, z: r.z, hidden: r.hidden, speed: r.speed, lag: r.lag, seat: r.seatKey })) });
  }, []);

  return <>{residents.map(({ persona, day, look, gather, plan }) => (
    <Figure key={persona.id} persona={persona} day={day} look={look} gather={gather} home={plan.home?.door ?? null} seed={plan.seed} registry={registry} island={island} />
  ))}</>;
}

function Figure({ persona, day, look, gather, home, seed, registry, island }: {
  persona: NPCPersona; day: ResidentDay; look: CharacterLook; gather: readonly [number, number]; home: readonly [number, number] | null; seed: number;
  registry: RefObject<Registry>; island: VillageIsland;
}) {
  const group = useRef<THREE.Group>(null), visual = useRef<THREE.Group>(null);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null });
  // Their steps kick up the ground's dust (specs/movement-feel.md milestone 2), quieter than yours.
  useStepDust(motion, group, island);
  const bubble = useRef<HTMLDivElement>(null), text = useRef<HTMLSpanElement>(null), notice = useRef<HTMLDivElement>(null), plate = useRef<HTMLDivElement>(null);
  const runtime = useRef<Runtime | null>(null);
  useEffect(() => {
    const r: Runtime = {
      id: persona.id, slug: persona.slug, seed, lines: persona.canned_dialogue?.length ? persona.canned_dialogue : FILLER_LINES, day, gather, home,
      name: persona.display_name, post: persona.post ?? null, persona, talking: false, talkAt: "", face: { expression: "neutral" },
      pose: newPose(), motion, group, visual, ui: { bubble, text, notice, plate },
      ready: false, x: 0, z: 0, speed: 0, ox: 0, oz: 0, hidden: false, lift: 0, lag: 0, detour: null, detourAt: 0, detourGoal: [0, 0],
      want: 0, line: "", noticed: false, bubbleUntil: 0, bubbleNext: 0, shown: -1, idleKey: -1, idleVisit: -1, laughBeat: -1, chat: null, hopT: -1, hopNext: 0, greetAt: 0, hovered: false, timers: [],
      seatKey: "", seatPick: 0, seatVisit: -1,
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
  // A click or tap talks to them when you're near enough (the residents' frame decides: from farther they wave back).
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    requestTalk(persona.id, true);
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
