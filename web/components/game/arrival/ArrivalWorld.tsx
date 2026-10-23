"use client";

/**
 * The arrival inside the island's canvas (specs/v1-drop.md §1.4-1.5): the crossing's director (the five golden-hour
 * shots on the boat as it comes in from far out, reusing the world, the wharf's boat and its trip), Bram at the tiller,
 * the drops running off you in the close-up; then on the pier the walk-along v2 (playtest round 1): Bram walks the
 * world's route (lib/game/arrival/routes) stop by stop with a "!" over his head and waits; you talk to him (E), he tells
 * you about the place and walks on: the dock and its crate, the museum, the shop, HQ, the café, the beach (his rod, a
 * catch), then what you've collected. When you stall, a gentle hint in his speech bubble (lib/game/arrival/tutorial.ts).
 *
 * Reads the arrival's runtime (arrivalStore) each frame; nothing here sets React state in the frame loop (the bubble is
 * toggled through refs, as the residents').
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import Character, { CHARACTER_HEIGHT, type CharacterMotion } from "../character/Character";
import { tripBoatFloat } from "../wharf/useTripBoat";
import { useMoveParticles } from "../movement/moveFx";
import { parseLook } from "@/lib/game/character/look";
import { RESIDENT_LOOKS } from "@/lib/content/residentRoster";
import { calculateCurvedHtmlPosition } from "@/lib/game/worldProjection";
import { easeFacing } from "@/lib/game/locomotion";
import { AudioManager } from "@/lib/game/audio";
import { worldNow } from "@/lib/game/worldClock";
import { myTrip } from "@/lib/game/myTrip";
import { CROSS_TIME, boatPose, newBoatPose } from "@/lib/game/boatTrip";
import { BOAT, dockToWorld, floatBoat, newFloat, type Dock } from "@/lib/game/wharf";
import { liveWaves } from "@/lib/game/waves";
import { landmark, landmarkPoint, type VillageIsland } from "@/lib/game/defaultIsland";
import type { Village } from "@/lib/game/villageMap";
import { navGrid } from "@/lib/game/residentRoutine";
import { disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import { FACE as PFACE, type ParticlePool, type Recipe } from "@/lib/game/fx/particles";
import { arrivalChanged, arrivalEvent, arrivalRun, useArrivalPhase } from "@/lib/game/arrival/arrivalStore";
import { crossingShot } from "@/lib/game/arrival/sequence";
import { crossingCamera, type CameraOut, type CrossingPoints } from "@/lib/game/arrival/crossing";
import { ACTIVE_WORLD_BEND } from "@/lib/game/curvedWorld";
import { awaitsTalk, newTutorial, stepTutorial } from "@/lib/game/arrival/tutorial";
import { resolvePlace, resolveRoute, type PlaceWorld, type ResolvedStop, type TutorialRoute, type XZ } from "@/lib/game/arrival/route";
import { routeFor } from "@/lib/game/arrival/routes";
import { GAME_WORLD } from "@/lib/game/world/active";
import { BRAM, fillKeys, hintLine, type HintKeys } from "@/lib/game/arrival/lines";
import type { WheelItem } from "@/lib/game/toolWheel";
import { worldLabels } from "@/lib/game/labelLayout";
import { residentTag } from "@/lib/game/nameTags";
import rs from "../residents.module.css";
import tags from "../nameTags.module.css";
import aw from "./ArrivalWorld.module.css";

const CRATE_URL = "/assets/game/wharf/crate.glb";
useGLTF.preload(CRATE_URL);
/**
 * A fish crate (art/wharf/build_crate.py) where the route puts one (lib/game/arrival/routes: the village's fills the
 * pier's deck between the rails, so the way up the pier is over it). Its solid footprint, half extents across and
 * along, and its lid `h` up: over the step-up (0.3), under a jump (1.28).
 */
export const CRATE = { hw: 0.97, hd: 0.3, h: 0.5 } as const;
/** At the tiller during the crossing (the boat's frame). */
const BRAM_ABOARD = { x: 0.08, z: -0.62 };

/** The places a world resolves the route's against: its wharf (the dock frame) and its landmarks' points. */
export function placeWorld(dock: Dock | null, v: Village): PlaceWorld {
  return {
    dock: dock && { x: dock.x, z: dock.z, yaw: dock.yaw },
    landmark: (id, point) => {
      if (point) { const p = landmarkPoint(id, point, v); return p ? { x: p[0], z: p[1] } : null; }
      const l = landmark(id, v);
      return l ? { x: l.x, z: l.z } : null;
    },
  };
}
/** The route's crates in world XZ, each with its turn (a dock-frame crate turns with the dock). */
export function crateSpots(route: TutorialRoute, w: PlaceWorld): (XZ & { yaw: number })[] {
  return route.crates.flatMap(c => {
    const at = resolvePlace(c.at, w);
    return at ? [{ ...at, yaw: (c.yaw ?? 0) + ("dock" in c.at && w.dock ? w.dock.yaw : 0) }] : [];
  });
}
/** The island's walking with the route's crates on it: each crate's lid is the top there. */
export function withCrates(island: VillageIsland, crates: readonly (XZ & { yaw: number })[]): VillageIsland {
  if (!crates.length) return island;
  const inCrate = (x: number, z: number) => crates.some(c => {
    const dx = x - c.x, dz = z - c.z, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
    return Math.abs(dx * cs - dz * sn) < CRATE.hw && Math.abs(dx * sn + dz * cs) < CRATE.hd;
  });
  return { ...island, top: (x, z) => (inCrate(x, z) ? island.top(x, z) + CRATE.h : island.top(x, z)) };
}

const BRAM_LOOK = parseLook(RESIDENT_LOOKS["wharf-keeper"]);
const PROMPT_CLEAR = 132;
/** Bram's bubble stays on screen: never under the prompt lane, and on a narrow screen never off its sides (it's up to 230 px wide). */
const BUBBLE_HALF = 120;
const labelPoint = (object: THREE.Object3D, camera: THREE.Camera, size: { width: number; height: number }) => {
  const p = calculateCurvedHtmlPosition(object, camera, size);
  if (p[1] <= size.height) p[1] = Math.min(p[1], size.height - PROMPT_CLEAR);
  if (p[0] > -BUBBLE_HALF && p[0] < size.width + BUBBLE_HALF) p[0] = Math.min(Math.max(p[0], BUBBLE_HALF), size.width - BUBBLE_HALF);
  return p;
};

export default function ArrivalWorld({ v, island, player, dock, held, keys, world = GAME_WORLD }: {
  v: Village; island: VillageIsland; player: React.RefObject<THREE.Vector3>; dock: Dock;
  held: WheelItem | null; keys: HintKeys;
  /** Whose route Bram walks (lib/game/arrival/routes). */
  world?: string;
}) {
  const phase = useArrivalPhase();
  // The rod out (the fishing step's hint changes), a cast, a catch: what the tutorial waits for.
  const rod = held?.kind === "rod";
  useEffect(() => { if (rod) arrivalEvent("rodHeld"); }, [rod]);
  useEffect(() => {
    const cast = () => arrivalEvent("cast"), caught = () => arrivalEvent("caught");
    window.addEventListener("tsi:fish-cast", cast);
    window.addEventListener("tsi:fish-caught", caught);
    return () => { window.removeEventListener("tsi:fish-cast", cast); window.removeEventListener("tsi:fish-caught", caught); };
  }, []);
  const route = routeFor(world);
  const pw = useMemo(() => placeWorld(dock, v), [dock, v]);
  const crates = useMemo(() => crateSpots(route, pw), [route, pw]);
  if (!phase) return null;
  const crossing = phase === "clearing" || phase === "crossing";
  const ashore = phase === "landing" || phase === "tutorial";
  return <>
    {crossing && <CrossingDirector dock={dock} player={player} />}
    {crossing && <BramAboard dock={dock} />}
    {(crossing || ashore) && <Suspense fallback={null}><Crates spots={crates} /></Suspense>}
    {ashore && <BramGuide v={v} island={island} player={player} dock={dock} keys={keys} route={route} places={pw} />}
  </>;
}

// ── The crossing ───────────────────────────────────────────────────────────────────────────────────────────────────
/** A drop running off your hair or chin in the close-up. */
const DRIP: Recipe = { sprite: "droplets", count: [1, 1], life: [0.5, 0.65], size: [0.07, 0.1], grow: 0.85, speed: [0, 0.04], spread: Math.PI, up: [-0.25, -0.05], gravity: 7,
  drag: 0, wind: 0, alpha: 0.9, face: PFACE.billboard, jitter: 0.11 };

/** Where the crossing's boat floats now (world), from the trip and the waves, as the boat draws it (its ride as last placed). */
const _pose = newBoatPose(), _float = newFloat(), _w = { x: 0, z: 0 }, _at = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, "YXZ"), _one = new THREE.Vector3(1, 1, 1);
function boatWorld(dock: Dock, out: { x: number; y: number; z: number; yaw: number; matrix: THREE.Matrix4 }) {
  const trip = myTrip.current;
  if (!trip?.crossing) return false;
  const now = worldNow();
  boatPose(trip, now, _pose);
  const f = tripBoatFloat.at > now - 250 ? tripBoatFloat.float : floatBoat(dock, _pose, liveWaves, _float);
  dockToWorld(dock, _pose.x + f.sway, _pose.z, _w);
  out.x = _w.x; out.z = _w.z; out.y = f.y; out.yaw = _pose.yaw + dock.yaw;
  out.matrix.compose(_at.set(_w.x, f.y - BOAT.draft, _w.z), _q.setFromEuler(_e.set(f.pitch, out.yaw, f.roll, "YXZ")), _one);
  return true;
}

type DirectorState = { boat: { x: number; y: number; z: number; yaw: number; matrix: THREE.Matrix4 }; cam: CameraOut; drip: number; seed: number };
/** One frame of the crossing's shots, module scope (the react compiler forbids writing through hook values). */
function directShot(cam: THREE.PerspectiveCamera, dock: Dock, points: CrossingPoints, st: DirectorState, pool: ParticlePool, p: THREE.Vector3, dt: number) {
  const trip = myTrip.current;
  if (!trip?.crossing || (trip.phase !== "load" && trip.phase !== "cross" && trip.phase !== "dock")) return;
  if (!boatWorld(dock, st.boat)) return;
  const t = trip.phase === "cross" ? (worldNow() - trip.at) / 1000 : trip.phase === "dock" ? CROSS_TIME + (worldNow() - trip.at) / 1000 : 0;
  const shot = crossingShot(t);
  crossingCamera(shot.id, shot.k, st.boat, points, st.cam, ACTIVE_WORLD_BEND);
  cam.position.set(st.cam.pos[0], st.cam.pos[1], st.cam.pos[2]);
  cam.lookAt(st.cam.look[0], st.cam.look[1], st.cam.look[2]);
  if (Math.abs(cam.fov - st.cam.fov) > 1e-3) { cam.fov = st.cam.fov; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld();
  // You, dripping: drops off your hair and chin, a few a second, while the close-up holds.
  if (shot.id === "closeup" && (st.drip -= dt) <= 0) {
    st.drip = 0.09 + Math.random() * 0.12;
    pool.burst(DRIP, p.x, p.y + 1.18, p.z, p.y + 0.4, 0, 0, 1, 0xd4ecf7, st.seed++);
  }
}

function CrossingDirector({ dock, player }: { dock: Dock; player: React.RefObject<THREE.Vector3> }) {
  const { camera } = useThree();
  const pool = useMoveParticles().pool;
  const st = useMemo<DirectorState>(() => ({ boat: { x: 0, y: 0, z: 0, yaw: 0, matrix: new THREE.Matrix4() }, cam: { pos: [0, 0, 0], look: [0, 0, 0], fov: 40 }, drip: 0, seed: 1 }), []);
  const points = useMemo<CrossingPoints>(() => {
    const tip = dockToWorld(dock, 0, -3.5, { x: 0, z: 0 });
    const hq = landmark("hq");
    return { island: { x: (hq?.x ?? 0) * 0.5, z: (hq?.z ?? 0) * 0.5 }, wharf: tip };
  }, [dock]);
  // After the follow camera (-3) and the boat (-5): the shot wins this frame. Released at the landing (the trip cuts to the walking view).
  useFrame((_, raw) => directShot(camera as THREE.PerspectiveCamera, dock, points, st, pool, player.current, Math.min(raw, 0.1)), -2.5);
  return null;
}

/** Bram at the tiller, riding the boat. */
function BramAboard({ dock }: { dock: Dock }) {
  const group = useRef<THREE.Group>(null);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: "Idle", play: null });
  const st = useMemo(() => ({ boat: { x: 0, y: 0, z: 0, yaw: 0, matrix: new THREE.Matrix4() }, local: new THREE.Matrix4().makeTranslation(BRAM_ABOARD.x, BOAT.floor, BRAM_ABOARD.z) }), []);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.visible = boatWorld(dock, st.boat);
    if (!g.visible) return;
    g.matrix.multiplyMatrices(st.boat.matrix, st.local);
    g.matrixWorldNeedsUpdate = true;
  }, -4);
  return <group ref={group} matrixAutoUpdate={false}><Suspense fallback={null}><Character look={BRAM_LOOK} motion={motion} /></Suspense></group>;
}

/** The route's fish crates. */
function Crates({ spots }: { spots: readonly (XZ & { yaw: number })[] }) {
  const { scene } = useGLTF(CRATE_URL);
  const models = useMemo(() => spots.map(() => prepareModel(scene, CRATE_URL, undefined, "solid")), [scene, spots]);
  useEffect(() => () => models.forEach(disposeModelMaterials), [models]);
  return <>{spots.map((c, i) => <primitive key={i} object={models[i]} position={[c.x, 0, c.z]} rotation={[0, c.yaw, 0]} />)}</>;
}

// ── The walk-along ────────────────────────────────────────────────────────────────────────────────────────────────
interface Guide {
  x: number; z: number; y: number;
  /** The way he's walking: points (world) and which leg he's on; a leg flagged `hop` is over a crate. */
  path: (XZ & { hop?: boolean })[]; leg: number; goal: string;
  hop: number | null; from: XZ;
  /** His bubble: the line, until when (performance.now s). */
  line: string; until: number; shown: string;
  /** The "!" shown now. */
  mark: boolean;
  /** The walk is over: his last word waits for your collection to close, then he waves and it ends. */
  ending: boolean; waved: boolean;
}
const BRAM_WALK = 3.1, BRAM_JOG = 6.2, HOP_S = 0.6;
/** He leads; this far behind him you've lost him, and he waits for you to catch up. */
const WAIT_GAP = 9;
/** At his stand (or past the last leg): within this he's there and can be talked to. */
const THERE = 0.6;
const lineSeconds = (line: string) => Math.max(3.2, 1.4 + line.length * 0.05);

interface GuideFrame {
  g: Guide; m: CharacterMotion; p: THREE.Vector3; stops: ResolvedStop[]; nav: ReturnType<typeof navGrid>; island: VillageIsland; keys: HintKeys;
  group: THREE.Group | null; bubble: HTMLDivElement | null; text: HTMLSpanElement | null; mark: HTMLDivElement | null;
}
/** The way to a goal: its fixed waypoints, then round every solid to the end (a straight line where the grid has none). */
function wayTo(g: Guide, nav: ReturnType<typeof navGrid>, via: readonly (XZ & { hop?: boolean })[], to: XZ | null) {
  const path: (XZ & { hop?: boolean })[] = [...via];
  if (to) {
    const from = path.at(-1) ?? g;
    const way = nav.path(from.x, from.z, to.x, to.z);
    path.push(...(way ? way.slice(1).map(([x, z]) => ({ x, z })) : []), to);
  }
  return path;
}
/**
 * One frame of the walk-along, module scope (the react compiler forbids writing through hook values): the tutorial's
 * frame (its cues), where Bram is going for the stop and stage, his walk there, his bubble and his "!".
 */
function guideFrame(f: GuideFrame, dt: number) {
  const { g, m, p, stops, nav, island } = f, now = performance.now() / 1000, a = arrivalRun.current;
  if (!a) return;
  const say = (line: string) => {
    g.line = fillKeys(line, f.keys); g.until = now + lineSeconds(g.line);
    m.talk = Math.min(3.2, 0.8 + g.line.length * 0.045);
    AudioManager.playBlip();
    window.setTimeout(() => AudioManager.playBlip(), 150);
    window.setTimeout(() => AudioManager.playBlip(), 310);
  };
  // The tutorial's own frame: its lines, hints, the hand-over, glyphs and the end.
  if (a.phase === "tutorial") {
    if (!arrivalRun.tutorial) arrivalRun.tutorial = newTutorial(now);
    const s = arrivalRun.tutorial;
    const before = `${s.stop}:${s.stage}`;
    for (const cue of stepTutorial(s, { now, player: { x: p.x, z: p.z }, bram: g, stops, events: arrivalRun.events.splice(0) })) {
      if (cue.kind === "say") say(cue.line);
      else if (cue.kind === "hint") say(hintLine(cue, f.keys));
      else if (cue.kind === "give") m.play = "HoldUp";
      else if (cue.kind === "glyph") arrivalRun.glyph = { key: cue.glyph, at: performance.now() };
      else if (cue.kind === "done") g.ending = true;
      if (cue.kind === "give" || cue.kind === "glyph") arrivalChanged();
    }
    if (`${s.stop}:${s.stage}` !== before) arrivalChanged();
  }
  // The end: his last word holds while your collection (or any sheet) is open; once it's closed he says it, waves, and
  // when it's been said the walk is over (the reward, the flag).
  if (g.ending) {
    if (document.querySelector('[role="dialog"]')) g.until = now + lineSeconds(g.line);
    else {
      if (!g.waved) { g.waved = true; m.play = "Wave"; }
      if (now >= g.until) { g.ending = false; arrivalRun.signals.toured = true; }
    }
  }
  // Where he's going: his stop's stand (via its waypoints) while he waits to be talked to; a reach task's wait (the
  // crate's hop); otherwise he stays where he is.
  const tut = arrivalRun.tutorial, i = Math.min(tut?.stop ?? 0, stops.length - 1), stop = stops[i], stage = tut?.done ? "done" : tut?.stage ?? "await";
  const goalKey = `${i}:${stage === "task" ? "task" : stage === "await" ? "stand" : "stay"}`;
  if (goalKey !== g.goal && stop) {
    g.goal = goalKey; g.leg = 0;
    if (stage === "await") g.path = wayTo(g, nav, stop.via, stop.stand);
    else if (stage === "task" && stop.task?.kind === "reach") g.path = wayTo(g, nav, stop.task.wait, null);
    else g.path = [];
  }
  // Walk the way: he leads and waits when you fall far behind; a hop is over a crate's lid.
  let speed = 0;
  const next = g.path[g.leg], gap = Math.hypot(p.x - g.x, p.z - g.z);
  if (g.hop !== null && next) {
    g.hop = Math.min(1, g.hop + dt / HOP_S);
    const k = g.hop;
    g.x = g.from.x + (next.x - g.from.x) * k; g.z = g.from.z + (next.z - g.from.z) * k;
    m.lift = Math.sin(Math.PI * k) * (CRATE.h + 0.3);
    if (k >= 1) { g.hop = null; g.leg++; m.lift = 0; }
  } else if (next) {
    const goal = g.path[g.path.length - 1];
    const ahead = Math.hypot(p.x - goal.x, p.z - goal.z) < Math.hypot(g.x - goal.x, g.z - goal.z);
    speed = ahead && gap > 3.5 ? BRAM_JOG : gap > WAIT_GAP ? 0 : BRAM_WALK;
    if (next.hop) { g.hop = 0; g.from = { x: g.x, z: g.z }; m.play = "Jump"; m.yaw = Math.atan2(next.x - g.x, next.z - g.z); speed = 0; }
    else {
      const dx = next.x - g.x, dz = next.z - g.z, d = Math.hypot(dx, dz);
      if (d <= Math.max(0.02, speed * dt)) { g.x = next.x; g.z = next.z; g.leg++; }
      else if (speed > 0) { g.x += (dx / d) * speed * dt; g.z += (dz / d) * speed * dt; m.yaw = easeFacing(m.yaw, Math.atan2(dx, dz), 8, dt); }
    }
  }
  m.speed = g.hop !== null ? 0 : speed;
  // Standing: facing you.
  if (speed === 0 && g.hop === null) m.yaw = easeFacing(m.yaw, Math.atan2(p.x - g.x, p.z - g.z), 6, dt);
  g.y = island.top(g.x, g.z);
  f.group?.position.set(g.x, g.y, g.z);
  // E talks to him once he's at his stop with the "!" (and moves his lines on while he talks).
  const there = !!stop && g.leg >= g.path.length && g.hop === null && Math.hypot(g.x - stop.stand.x, g.z - stop.stand.z) <= THERE;
  arrivalRun.bram.x = g.x; arrivalRun.bram.z = g.z;
  arrivalRun.bram.talkable = a.phase === "tutorial" && ((awaitsTalk(tut) && there) || stage === "talk");
  // The bubble and the "!": the DOM touched only when they change; the "!" steps aside while he speaks.
  const line = now < g.until ? g.line : "";
  if (line !== g.shown) {
    g.shown = line;
    if (f.text) f.text.textContent = line;
    if (f.bubble) f.bubble.hidden = !line;
  }
  const mark = a.phase === "tutorial" && awaitsTalk(tut) && !line;
  if (mark !== g.mark) { g.mark = mark; if (f.mark) f.mark.hidden = !mark; }
}

function BramGuide({ v, island, player, dock, keys, route, places }: {
  v: Village; island: VillageIsland; player: React.RefObject<THREE.Vector3>; dock: Dock; keys: HintKeys; route: TutorialRoute; places: PlaceWorld;
}) {
  const group = useRef<THREE.Group>(null);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null });
  const bubble = useRef<HTMLDivElement>(null), text = useRef<HTMLSpanElement>(null), plate = useRef<HTMLDivElement>(null), mark = useRef<HTMLDivElement>(null);
  const nav = useMemo(() => navGrid(island, v), [island, v]);
  const keysRef = useRef(keys);
  useEffect(() => { keysRef.current = keys; }, [keys]);
  // The route in this world's places (he starts at the first stop: beside the boat as you land).
  const stops = useMemo(() => resolveRoute(route, places, { x: dock.x, z: dock.z }), [route, places, dock]);
  useEffect(() => { arrivalRun.stops = stops; arrivalChanged(); }, [stops]);
  // His name over his head, as every resident's (lib/game/nameTags.ts), through the label layout.
  useEffect(() => worldLabels.add(residentTag(out => { const g = group.current; if (!g) return false; out.set(g.position.x, g.position.y + CHARACTER_HEIGHT + 0.3, g.position.z); return true; }, () => plate.current)), []);
  // Dev (evidence scripts): the resolved stops, where Bram is, the tutorial's state.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    Object.assign(window, { __arrivalStops: () => stops, __bram: () => ({ ...arrivalRun.bram }), __tutorial: () => (arrivalRun.tutorial ? { ...arrivalRun.tutorial } : null) });
  }, [stops]);
  const g = useMemo<Guide>(() => ({ x: stops[0]?.stand.x ?? dock.x, z: stops[0]?.stand.z ?? dock.z, y: 0, path: [], leg: 0, goal: "", hop: null, from: { x: 0, z: 0 }, line: "", until: 0, shown: "", mark: false, ending: false, waved: false }), [stops, dock]);

  useFrame((_, raw) => guideFrame({ g, m: motion.current, p: player.current, stops, nav, island, keys: keysRef.current, group: group.current, bubble: bubble.current, text: text.current, mark: mark.current }, Math.min(raw, 0.1)), -2);
  return <group ref={group}>
    <Suspense fallback={null}><Character look={BRAM_LOOK} motion={motion} /></Suspense>
    <Html calculatePosition={labelPoint} position={[0, CHARACTER_HEIGHT + 0.3, 0]} zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
      <div className={rs.stack} data-testid="bram-bubble">
        <div ref={mark} className={aw.quest} hidden aria-hidden="true" data-testid="bram-quest-mark">!</div>
        <div ref={bubble} className={rs.bubble} hidden><b>{BRAM.name}</b><span ref={text} /></div>
        <div ref={plate} className={tags.tag} data-resident hidden><span className={tags.name}>{BRAM.name}</span></div>
      </div>
    </Html>
  </group>;
}
