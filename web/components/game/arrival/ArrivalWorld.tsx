"use client";

/**
 * The arrival inside the island's canvas (specs/v1-drop.md §1.4-1.5): the crossing's director (the five golden-hour
 * shots on the boat as it comes in from far out, reusing the world, the wharf's boat and its trip), Bram at the tiller,
 * the drops running off you in the close-up; then on the pier the walk-along tutorial: Bram walking you up the pier,
 * over the fish crate, to the fishing spot, down the main street to each building's front and to the plaza, saying his
 * lines and, when you stall, a gentle hint in his speech bubble (lib/game/arrival/tutorial.ts).
 *
 * Reads the arrival's runtime (arrivalStore) each frame; nothing here sets React state in the frame loop (the bubble is
 * toggled through refs, as the residents').
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import Character, { CHARACTER_HEIGHT, type CharacterMotion } from "../character/Character";
import { readSwell } from "../wharf/Boat";
import { useMoveParticles } from "../movement/moveFx";
import { parseLook } from "@/lib/game/character/look";
import { RESIDENT_LOOKS } from "@/lib/content/residentRoster";
import { calculateCurvedHtmlPosition } from "@/lib/game/worldProjection";
import { easeFacing } from "@/lib/game/locomotion";
import { AudioManager } from "@/lib/game/audio";
import { worldNow } from "@/lib/game/worldClock";
import { myTrip } from "@/lib/game/myTrip";
import { CROSS_TIME, boatPose, newBoatPose } from "@/lib/game/boatTrip";
import { BOAT, dockToWorld, floatBoat, newFloat, worldToDock, type Dock } from "@/lib/game/wharf";
import { landmark, landmarkPoint, type VillageIsland } from "@/lib/game/defaultIsland";
import type { Village } from "@/lib/game/villageMap";
import { navGrid } from "@/lib/game/residentRoutine";
import { disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import { FACE as PFACE, type ParticlePool, type Recipe } from "@/lib/game/fx/particles";
import { arrivalChanged, arrivalEvent, arrivalRun, useArrivalPhase } from "@/lib/game/arrival/arrivalStore";
import { crossingShot } from "@/lib/game/arrival/sequence";
import { crossingCamera, type CameraOut, type CrossingPoints } from "@/lib/game/arrival/crossing";
import { TUTORIAL_ORDER, newTutorial, stepTutorial, type TutorialStepId, type TutorialTargets } from "@/lib/game/arrival/tutorial";
import { BRAM, ROD_HANDOVER, hintLine, type HintKeys } from "@/lib/game/arrival/lines";
import type { WheelItem } from "@/lib/game/toolWheel";
import rs from "../residents.module.css";

const CRATE_URL = "/assets/game/wharf/crate.glb";
useGLTF.preload(CRATE_URL);
/**
 * The fish crate across the pier (art/wharf/build_crate.py), in the dock's frame: it fills the deck between the rails,
 * so the way up the pier is over it. Its solid footprint spans the whole deck (WHARF_DECK_LOCAL x ±0.9) and its lid is
 * `h` up: over the step-up (0.3), under a jump (1.28).
 */
export const CRATE = { x: 0, z: -0.95, hw: 0.97, hd: 0.3, h: 0.5 } as const;
/** Where the walk-along stands its marks, in the dock's frame: past the crate, the fishing spot at the pier's land end. */
const PIER_MARKS = { pastCrate: { x: 0.05, z: CRATE.z + 0.62 }, fish: { x: -0.4, z: 0.6 } };
/** Bram on the pier: beside the boat as you land, his way up the pier (over the crate), where he waits to fish. */
const BRAM_PIER = { landing: { x: -0.5, z: -1.95 }, beforeCrate: { x: 0.05, z: CRATE.z - 0.6 }, afterCrate: { x: 0.05, z: CRATE.z + 0.55 }, fishing: { x: 0.42, z: 0.95 } };
/** At the tiller during the crossing (the boat's frame). */
const BRAM_ABOARD = { x: 0.08, z: -0.62 };

/** The island's walking with the crate on the pier: its lid is the top there. */
export function withCrate(island: VillageIsland, dock: Dock): VillageIsland {
  const at = { x: 0, z: 0 };
  const inCrate = (x: number, z: number) => { worldToDock(dock, x, z, at); return Math.abs(at.x - CRATE.x) < CRATE.hw && Math.abs(at.z - CRATE.z) < CRATE.hd; };
  return { ...island, top: (x, z) => (inCrate(x, z) ? island.top(x, z) + CRATE.h : island.top(x, z)) };
}

const BRAM_LOOK = parseLook(RESIDENT_LOOKS["wharf-keeper"]);
const PROMPT_CLEAR = 132;
const labelPoint = (object: THREE.Object3D, camera: THREE.Camera, size: { width: number; height: number }) => {
  const p = calculateCurvedHtmlPosition(object, camera, size);
  if (p[1] <= size.height) p[1] = Math.min(p[1], size.height - PROMPT_CLEAR);
  return p;
};

export default function ArrivalWorld({ v, island, player, dock, held, keys }: {
  v: Village; island: VillageIsland; player: React.RefObject<THREE.Vector3>; dock: Dock;
  held: WheelItem | null; keys: HintKeys;
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
  if (!phase) return null;
  const crossing = phase === "clearing" || phase === "crossing";
  const ashore = phase === "landing" || phase === "tutorial";
  return <>
    {crossing && <CrossingDirector dock={dock} player={player} />}
    {crossing && <BramAboard dock={dock} />}
    {(crossing || ashore) && <Suspense fallback={null}><PierCrate dock={dock} /></Suspense>}
    {ashore && <BramGuide v={v} island={island} player={player} dock={dock} keys={keys} />}
  </>;
}

// ── The crossing ───────────────────────────────────────────────────────────────────────────────────────────────────
/** A drop running off your hair or chin in the close-up. */
const DRIP: Recipe = { sprite: "droplets", count: [1, 1], life: [0.5, 0.65], size: [0.07, 0.1], grow: 0.85, speed: [0, 0.04], spread: Math.PI, up: [-0.25, -0.05], gravity: 7,
  drag: 0, wind: 0, alpha: 0.9, face: PFACE.billboard, jitter: 0.11 };

/** Where the crossing's boat floats now (world), from the trip and the shared swell, as the boat draws it. */
const _pose = newBoatPose(), _float = newFloat(), _w = { x: 0, z: 0 }, _at = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, "YXZ"), _one = new THREE.Vector3(1, 1, 1);
function boatWorld(dock: Dock, out: { x: number; y: number; z: number; yaw: number; matrix: THREE.Matrix4 }) {
  const trip = myTrip.current;
  if (!trip?.crossing) return false;
  boatPose(trip, worldNow(), _pose);
  const swell = readSwell();
  floatBoat(dock, _pose, swell.t, swell, _float);
  dockToWorld(dock, _pose.x + _float.sway, _pose.z, _w);
  out.x = _w.x; out.z = _w.z; out.y = _float.y; out.yaw = _pose.yaw + dock.yaw;
  out.matrix.compose(_at.set(_w.x, _float.y - BOAT.draft, _w.z), _q.setFromEuler(_e.set(_float.pitch, out.yaw, _float.roll, "YXZ")), _one);
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
  crossingCamera(shot.id, shot.k, st.boat, points, st.cam);
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

/** The fish crate on the pier. */
function PierCrate({ dock }: { dock: Dock }) {
  const { scene } = useGLTF(CRATE_URL);
  const model = useMemo(() => prepareModel(scene, CRATE_URL, undefined, "solid"), [scene]);
  useEffect(() => () => disposeModelMaterials(model), [model]);
  return <group position={[dock.x, 0, dock.z]} rotation={[0, dock.yaw, 0]}>
    <primitive object={model} position={[CRATE.x, 0, CRATE.z]} rotation={[0, 0.03, 0]} />
  </group>;
}

// ── The walk-along ────────────────────────────────────────────────────────────────────────────────────────────────
interface Guide {
  x: number; z: number; y: number;
  /** The way he's walking: points (world) and which leg he's on; a leg flagged `hop` is the crate. */
  path: { x: number; z: number; hop?: boolean }[]; leg: number; goal: string;
  hop: number | null; from: { x: number; z: number };
  /** His bubble: the line, until when (performance.now s). */
  line: string; until: number; shown: string;
  /** The rod handed over (the fishing step). */
  handed: boolean;
  started: boolean;
}
const BRAM_WALK = 3.1, BRAM_JOG = 6.2, HOP_S = 0.6;
const lineSeconds = (line: string) => Math.max(3.2, 1.4 + line.length * 0.05);

type GuideWorld = { targets: TutorialTargets; pier: Record<"landing" | "before" | "after" | "fishing", { x: number; z: number }> };
interface GuideFrame {
  g: Guide; m: CharacterMotion; p: THREE.Vector3; world: GuideWorld; nav: ReturnType<typeof navGrid>; island: VillageIsland; dock: Dock; keys: HintKeys;
  group: THREE.Group | null; bubble: HTMLDivElement | null; text: HTMLSpanElement | null;
}
/**
 * One frame of the walk-along, module scope (the react compiler forbids writing through hook values): the tutorial's
 * step (its cues), where Bram is going for it and his walk there, his bubble.
 */
function guideFrame(f: GuideFrame, dt: number) {
  const { g, m, p, world, nav, island, dock } = f, now = performance.now() / 1000, a = arrivalRun.current;
  if (!a) return;
  const say = (line: string) => {
    g.line = line; g.until = now + lineSeconds(line);
    m.talk = Math.min(3.2, 0.8 + line.length * 0.045);
    AudioManager.playBlip();
    window.setTimeout(() => AudioManager.playBlip(), 150);
    window.setTimeout(() => AudioManager.playBlip(), 310);
  };
  // The tutorial's own frame: its lines, hints, glyphs and end.
  if (a.phase === "tutorial") {
    if (!arrivalRun.tutorial) arrivalRun.tutorial = newTutorial(now, { x: p.x, z: p.z });
    const s = arrivalRun.tutorial;
    const before = s.step;
    for (const cue of stepTutorial(s, { now, player: { x: p.x, z: p.z }, targets: world.targets, events: arrivalRun.events.splice(0) })) {
      if (cue.kind === "say") {
        if (cue.step === "fish" && !g.handed) { g.handed = true; m.play = "HoldUp"; say(`${ROD_HANDOVER} ${cue.line}`); }
        else say(cue.line);
      } else if (cue.kind === "hint") say(hintLine(cue, f.keys));
      else if (cue.kind === "glyph") { arrivalRun.glyph = { key: cue.glyph, at: performance.now() }; arrivalChanged(); }
      else if (cue.kind === "done") { arrivalRun.signals.toured = true; m.play = "Wave"; }
    }
    if (s.step !== before) arrivalChanged();
  }
  // Where he's going for this step: beside the boat until you start walking, up the pier and over the crate, the
  // fishing spot, then each building's front and the plaza, on a path round every solid.
  const tut = arrivalRun.tutorial;
  const step: TutorialStepId = a.phase === "tutorial" && tut ? TUTORIAL_ORDER[Math.min(tut.step, TUTORIAL_ORDER.length - 1)] : "dock";
  if (step === "dock" && tut && Math.hypot(p.x - tut.start.x, p.z - tut.start.z) > 0.4) g.started = true;
  const goalKey = step === "dock" ? (g.started ? "pier-up" : "landing") : step === "crate" ? "pier-up" : step === "fish" || step === "bag" ? "fishing" : step;
  if (goalKey !== g.goal) {
    g.goal = goalKey; g.leg = 0;
    const W = world.pier, below = worldToDock(dock, g.x, g.z, { x: 0, z: 0 }).z < CRATE.z + CRATE.hd;
    if (goalKey === "landing") g.path = [W.landing];
    else if (goalKey === "pier-up") g.path = below ? [W.before, { ...W.after, hop: true }] : [W.after];
    else if (goalKey === "fishing") g.path = [...(below ? [W.before, { ...W.after, hop: true }] : []), W.fishing];
    else {
      const t = world.targets[step as keyof TutorialTargets];
      const to = t ? { x: t.x + 1.2, z: t.z - 0.6 } : { x: g.x, z: g.z };
      const way = nav.path(g.x, g.z, to.x, to.z);
      g.path = way ? way.slice(1).map(([x, z]) => ({ x, z })) : [to];
    }
  }
  // Walk the way: he keeps up when you run ahead and waits when you fall far behind; the crate is a hop over its lid.
  let speed = 0;
  const next = g.path[g.leg];
  if (g.hop !== null) {
    g.hop = Math.min(1, g.hop + dt / HOP_S);
    const k = g.hop;
    g.x = g.from.x + (next.x - g.from.x) * k; g.z = g.from.z + (next.z - g.from.z) * k;
    m.lift = Math.sin(Math.PI * k) * (CRATE.h + 0.3);
    if (k >= 1) { g.hop = null; g.leg++; m.lift = 0; }
  } else if (next) {
    const goal = g.path[g.path.length - 1], gap = Math.hypot(p.x - g.x, p.z - g.z);
    const ahead = Math.hypot(p.x - goal.x, p.z - goal.z) < Math.hypot(g.x - goal.x, g.z - goal.z);
    speed = ahead && gap > 3.5 ? BRAM_JOG : gap > 6.5 ? 0 : BRAM_WALK;
    if (next.hop) { g.hop = 0; g.from = { x: g.x, z: g.z }; m.play = "Jump"; m.yaw = Math.atan2(next.x - g.x, next.z - g.z); speed = 0; }
    else {
      const dx = next.x - g.x, dz = next.z - g.z, d = Math.hypot(dx, dz);
      if (d <= Math.max(0.02, speed * dt)) { g.x = next.x; g.z = next.z; g.leg++; }
      else if (speed > 0) { g.x += (dx / d) * speed * dt; g.z += (dz / d) * speed * dt; m.yaw = easeFacing(m.yaw, Math.atan2(dx, dz), 8, dt); }
    }
  }
  m.speed = g.hop !== null ? 0 : speed;
  // Standing: facing you (or the water while you fish).
  if (speed === 0 && g.hop === null) m.yaw = easeFacing(m.yaw, Math.atan2(p.x - g.x, p.z - g.z), 6, dt);
  g.y = island.top(g.x, g.z);
  f.group?.position.set(g.x, g.y, g.z);
  // The bubble: shown while a line is up; the DOM touched only when it changes.
  const line = now < g.until ? g.line : "";
  if (line !== g.shown) {
    g.shown = line;
    if (f.text) f.text.textContent = line;
    if (f.bubble) f.bubble.hidden = !line;
  }
}

function BramGuide({ v, island, player, dock, keys }: { v: Village; island: VillageIsland; player: React.RefObject<THREE.Vector3>; dock: Dock; keys: HintKeys }) {
  const group = useRef<THREE.Group>(null);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null });
  const bubble = useRef<HTMLDivElement>(null), text = useRef<HTMLSpanElement>(null);
  const nav = useMemo(() => navGrid(island, v), [island, v]);
  const keysRef = useRef(keys);
  useEffect(() => { keysRef.current = keys; }, [keys]);
  const world = useMemo(() => {
    const d = (p: { x: number; z: number }) => dockToWorld(dock, p.x, p.z, { x: 0, z: 0 });
    const front = (id: "museum" | "shop" | "hq" | "cafe") => { const p = landmarkPoint(id, "exit", v); return p ? { x: p[0], z: p[1] } : null; };
    const plaza = landmark("plaza", v);
    const targets: TutorialTargets = { crate: d(PIER_MARKS.pastCrate), fish: d(PIER_MARKS.fish), plaza: plaza ? { x: plaza.x, z: plaza.z } : undefined };
    for (const id of ["museum", "shop", "hq", "cafe"] as const) targets[id] = front(id) ?? undefined;
    return { targets, pier: { landing: d(BRAM_PIER.landing), before: d(BRAM_PIER.beforeCrate), after: d(BRAM_PIER.afterCrate), fishing: d(BRAM_PIER.fishing) } };
  }, [dock, v]);
  // Dev (evidence scripts): where the steps want you.
  useEffect(() => { if (process.env.NODE_ENV !== "production") Object.assign(window, { __arrivalTargets: () => world.targets }); }, [world]);
  const g = useMemo<Guide>(() => ({ x: world.pier.landing.x, z: world.pier.landing.z, y: 0, path: [], leg: 0, goal: "", hop: null, from: { x: 0, z: 0 }, line: "", until: 0, shown: "", handed: false, started: false }), [world]);

  useFrame((_, raw) => guideFrame({ g, m: motion.current, p: player.current, world, nav, island, dock, keys: keysRef.current, group: group.current, bubble: bubble.current, text: text.current }, Math.min(raw, 0.1)), -2);
  return <group ref={group}>
    <Suspense fallback={null}><Character look={BRAM_LOOK} motion={motion} /></Suspense>
    <Html calculatePosition={labelPoint} position={[0, CHARACTER_HEIGHT + 0.3, 0]} zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
      <div className={rs.stack} data-testid="bram-bubble">
        <div ref={bubble} className={rs.bubble} hidden><b>{BRAM.name}</b><span ref={text} /></div>
        <div className={rs.plate}>{BRAM.name}<small>{BRAM.title}</small></div>
      </div>
    </Html>
  </group>;
}
