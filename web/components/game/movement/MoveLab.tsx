"use client";

/**
 * /lab/move — the movement lab (specs/movement.md, build order 2). The test
 * course on the real grid terrain, the real character and the follow camera's
 * framing, the movement sim, and a live tuning panel with every feel value,
 * presets (and dash presets to compare) and "Copy JSON", so David tunes the
 * feel himself; a lap timer is the skill readout. Dev only (the /lab layout
 * 404s in production).
 *
 * The leaf glider (specs/glider.md) has its own lane north of the lap, an
 * "owns the leaf glider" toggle and a Glide group with presets.
 *
 * The slide (specs/movement-slide.md) has its lane north-east of the lap (a
 * dash-slide straight to a water gap, a ramp launch, a long ramp, a terrain
 * slope), Slide and Momentum groups with presets, and a speed readout that
 * says whether the momentum is kept or bleeding, with a trace of the last 3 s.
 *
 * URL: ?at=x,z starts somewhere else, ?touch=1 shows the touch controls on a
 * desktop, ?panel=0 hides the panel and the signs, ?zoom=0.6 brings the camera closer (evidence frames).
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import GridWorld from "../grid/GridWorld";
import GridOcean from "../grid/GridOcean";
import PostFX from "../PostFX";
import SunShadows from "../SunShadows";
import LookMaterials from "../LookMaterials";
import { ACNHParts, CHALET_VARIANTS } from "../ACNHBuilding";
import { sceneryOf } from "../NatureModels";
import { InstancedModels } from "../InstancedNature";
import { IslandAtmosphere, useFollowCamera, type TreeSpot } from "../IslandAtmosphere";
import PlayerAvatar from "../PlayerAvatar";
import TouchControls from "./TouchControls";
import { BASE_FOV, MOVE_JUICE, type MoveJuice, type MoveTelemetry } from "./moveFx";
import { PACK_URL } from "@/lib/game/fx/pack";
import { ISLAND_TERRAIN, islandLight, withSeason } from "@/lib/game/islandLighting";
import { seasonLook } from "@/lib/game/seasonalLook";
import { CURRENT, lookFx } from "@/lib/game/lookPreset";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { islandOf } from "@/lib/game/defaultIsland";
import { objectsOf } from "@/lib/game/villageMap";
import { COURSE_GATES, COURSE_SIGNS, COURSE_SPAWN, GLIDE_SPAWN, NEW_LAP, SLIDE_SPAWN, course, gateAt, lapStep, type Lap } from "@/lib/game/movement/course";
import { MOVE_TUNING, createMoveState, stepMove, topSpeed, NO_INPUT, STEP, type MoveInput, type MoveTuning, type MoveWorld } from "@/lib/game/movement/sim";
import { MOVE_ACTIONS, crouchKey, keyName, remapMove, useKeyboardLocked, useMoveKeys, useNextKey, type MoveAction } from "@/lib/game/movement/keys";
import { useSoundUnlock } from "@/lib/game/useAudio";
import { useCoarsePointer } from "@/lib/game/useMediaQuery";

const SUMMER = { season: "summer" as const, weights: { spring: 0, summer: 1, autumn: 0, winter: 0 } };
const LOOK = seasonLook(SUMMER, {});
const LIGHT = withSeason(islandLight(CURRENT, "day"), LOOK);
const TERRAIN = { ...ISLAND_TERRAIN, grass: LOOK.grass };
const STORE = "tsi.moveLab.v4"; // v4: the slide and David's momentum model (2026-10-01) start from the defaults

// ── The tuning panel's table: every value, its range, its group ────
type Range = [min: number, max: number, step: number];
const GROUPS: { name: string; keys: [keyof MoveTuning, ...Range][] }[] = [
  { name: "Ground", keys: [["walkSpeed", 3, 12, 0.1], ["sneakSpeed", 1, 5, 0.1], ["sprintSpeed", 7, 18, 0.1], ["sprintBuild", 0.05, 2.5, 0.05], ["groundResponse", 2, 30, 0.5],
    ["stopResponse", 2, 30, 0.5], ["overspeedDecay", 0, 20, 0.5], ["turnAtSpeed", 1, 30, 0.5], ["skidSpeed", 2, 20, 0.5], ["skidAngle", 60, 180, 5], ["skidDecel", 5, 100, 1], ["stepUp", 0.05, 0.6, 0.01]] },
  { name: "Jump", keys: [["jumpHeight", 0.3, 2, 0.05], ["jumpApexTime", 0.1, 0.5, 0.01], ["fallGravity", 0.5, 3, 0.05], ["jumpCutGravity", 1, 5, 0.1], ["apexHangSpeed", 0, 4, 0.1],
    ["apexHangGravity", 0.1, 1, 0.05], ["maxFallSpeed", 5, 40, 1], ["coyoteTime", 0, 0.3, 0.01], ["jumpBuffer", 0, 0.3, 0.01], ["airControl", 0, 1, 0.05]] },
  { name: "Bunny-hop and long jump", keys: [["hopBoost", 0, 2, 0.05], ["hopChainMax", 0, 6, 1], ["longJumpAt", 0.5, 1.2, 0.01], ["longJumpHeight", 0.2, 1.5, 0.05],
    ["longJumpApexTime", 0.08, 0.4, 0.01], ["longJumpBoost", 1, 1.4, 0.01]] },
  { name: "Dash (Q)", keys: [["dashSpeed", 5, 40, 0.5], ["dashTime", 0.05, 0.5, 0.01], ["dashExit", 0, 1, 0.05], ["dashEase", 0, 4, 0.25], ["dashCooldown", 0, 2, 0.05], ["airDashes", 0, 3, 1],
    ["airDashLift", 0, 6, 0.25], ["dashJumpWindow", 0, 0.4, 0.01]] },
  { name: "Climb and drops", keys: [["grabReach", 0.3, 2, 0.05], ["grabRise", 0, 10, 0.5], ["mantleTime", 0.1, 1, 0.02], ["rollDrop", 0.3, 4, 0.1], ["rollSpeed", 0, 15, 0.5], ["rollTime", 0.1, 1, 0.02],
    ["recoverDrop", 0.5, 6, 0.1], ["recoverTime", 0, 1, 0.02]] },
  { name: "Glide (leaf)", keys: [["glideSpeed", 3, 16, 0.1], ["glideSink", 0.5, 5, 0.05], ["glideEase", 0.5, 12, 0.25], ["glideOpen", 1, 20, 0.5], ["glideTurn", 0.5, 8, 0.25]] },
  { name: "Slide", keys: [["slideEnterAt", 1, 1.6, 0.01], ["slideEndAt", 0.5, 1.4, 0.01], ["slideFriction", 0, 12, 0.1], ["slideSlope", 0, 40, 0.5], ["slideTurn", 0.5, 8, 0.1],
    ["slideJumpHeight", 0.2, 1.2, 0.05], ["slideJumpApexTime", 0.1, 0.4, 0.01], ["techBoost", 0, 2, 0.05]] },
  { name: "Momentum", keys: [["keepGrace", 0, 0.4, 0.01], ["momentumCeiling", 12, 30, 0.5], ["downhillCeiling", 0, 20, 0.5], ["ceilingBleed", 5, 80, 1]] },
];
const JUICE_KEYS: [keyof MoveJuice, ...Range][] = [["camLead", 0, 0.4, 0.01], ["fovKick", 0, 10, 0.5], ["dashKick", 0, 8, 0.5], ["squash", 0, 2, 0.05],
  ["anticipation", 0, 2, 0.05], ["footsteps", 0, 2, 0.05], ["takeoff", 0, 2, 0.05], ["landing", 0, 2, 0.05], ["camDip", 0, 3, 0.1],
  ["dashBurst", 0, 2, 0.05], ["streaks", 0, 2, 0.05], ["afterimage", 0, 1, 1], ["cooldown", 0, 2, 0.05],
  ["slideTrail", 0, 2, 0.05], ["slideBurst", 0, 2, 0.05], ["slideKick", 0, 6, 0.25], ["slideDrop", 0, 0.5, 0.01], ["prints", 0, 1.5, 0.05]];
/** Dash shapes to compare (row 250), about the same reach each: only the dash values change. */
const DASH_PRESETS: Record<string, Partial<MoveTuning>> = {
  // The shipped dash (MOVE_TUNING), so "current preset" keeps matching when the defaults are retuned.
  Burst: (({ dashSpeed, dashTime, dashExit, dashEase, dashCooldown, airDashLift }) => ({ dashSpeed, dashTime, dashExit, dashEase, dashCooldown, airDashLift }))(MOVE_TUNING),
  Glide: { dashSpeed: 13.5, dashTime: 0.21, dashExit: 0.8, dashEase: 1, dashCooldown: 0.45, airDashLift: 1 },
  Blink: { dashSpeed: 28, dashTime: 0.16, dashExit: 0.38, dashEase: 3, dashCooldown: 0.6, airDashLift: 0 },
  "First cut": { dashSpeed: 14, dashTime: 0.18, dashExit: 0.7, dashEase: 0, dashCooldown: 0.45, airDashLift: 0 },
};
/** Glide shapes to compare (specs/glider.md): only the glide values change. */
const GLIDE_PRESETS: Record<string, Partial<MoveTuning>> = {
  Leaf: (({ glideSpeed, glideSink, glideEase, glideOpen, glideTurn }) => ({ glideSpeed, glideSink, glideEase, glideOpen, glideTurn }))(MOVE_TUNING),
  Floaty: { glideSpeed: 8, glideSink: 1.6, glideEase: 2.5, glideOpen: 6, glideTurn: 2.5 }, // the spec's first numbers: ~15 tiles
  Brisk: { glideSpeed: 10.5, glideSink: 2.8, glideEase: 5, glideOpen: 10, glideTurn: 3.5 },
};
/** Slide shapes to compare (specs/movement-slide.md): only the slide values change. */
const SLIDE_PRESETS: Record<string, Partial<MoveTuning>> = {
  Slick: (({ slideFriction, slideSlope, slideTurn, slideJumpHeight, slideJumpApexTime, techBoost }) => ({ slideFriction, slideSlope, slideTurn, slideJumpHeight, slideJumpApexTime, techBoost }))(MOVE_TUNING),
  Short: { slideFriction: 6, slideSlope: 16, slideTurn: 3, slideJumpHeight: 0.6, slideJumpApexTime: 0.22, techBoost: 0.3 },
  Long: { slideFriction: 2.2, slideSlope: 26, slideTurn: 1.7, slideJumpHeight: 0.5, slideJumpApexTime: 0.3, techBoost: 0.5 },
};
/** How strict the momentum is (David, 2026-10-01): the grace and the bleed on plain ground. */
const MOMENTUM_PRESETS: Record<string, Partial<MoveTuning>> = {
  Kept: (({ keepGrace, overspeedDecay, momentumCeiling }) => ({ keepGrace, overspeedDecay, momentumCeiling }))(MOVE_TUNING),
  Forgiving: { keepGrace: 0.22, overspeedDecay: 10, momentumCeiling: 18 },
  Strict: { keepGrace: 0.06, overspeedDecay: 30, momentumCeiling: 18 },
  "Before (fade)": { keepGrace: 0, overspeedDecay: 5, momentumCeiling: 18, dashExit: 0.55 },
};
const PRESETS: Record<string, Partial<MoveTuning>> = {
  Juicy: {},
  Cozy: { sprintSpeed: 10.5, jumpHeight: 0.85, jumpApexTime: 0.26, fallGravity: 1.3, hopBoost: 0.4, hopChainMax: 2, ...DASH_PRESETS.Glide, airControl: 0.45, skidSpeed: 7, turnAtSpeed: 9 },
  Snappy: { jumpApexTime: 0.19, fallGravity: 1.8, jumpCutGravity: 3, airControl: 0.5, sprintBuild: 0.6, dashCooldown: 0.4, turnAtSpeed: 10, mantleTime: 0.26 },
  "Today's walk": { sprintSpeed: 13.69, sprintBuild: 0.05, turnAtSpeed: 30, skidSpeed: 99, hopBoost: 0, hopChainMax: 0, longJumpAt: 9 },
};
const label = (k: string) => k.replace(/([A-Z])/g, " $1").toLowerCase();

/** Each move by the numbers under a tuning, measured by running the sim on flat ground. */
function measure(t: MoveTuning) {
  const flat: MoveWorld = { top: () => 0, wet: () => false };
  const run = (setup: Partial<MoveInput>, seconds: number, jumpAt: number | null, dashAt: number | null) => {
    let s = createMoveState(0, 0, flat), peak = 0, air = 0, z0 = 0, landed: number | null = null, top = 0;
    for (let i = 0; i < Math.round(seconds / STEP); i++) {
      const time = i * STEP;
      if (jumpAt !== null && Math.abs(time - jumpAt) < STEP / 2) z0 = s.z;
      // Space held from the press while rising, let go coming down; sprint only up to the takeoff: the landing must not bunny-hop on.
      const sprint = !!setup.sprint && (jumpAt === null || time < jumpAt + STEP);
      s = stepMove(s, { ...NO_INPUT, ...setup, sprint, jump: jumpAt !== null && time >= jumpAt && (s.mode !== "air" || s.vy > 0), jumpPressed: jumpAt !== null && Math.abs(time - jumpAt) < STEP / 2, dashPressed: dashAt !== null && Math.abs(time - dashAt) < STEP / 2 }, STEP, flat, t);
      top = Math.max(top, Math.hypot(s.vx, s.vz));
      if (jumpAt !== null && time >= jumpAt) {
        if (s.mode === "air") { air += STEP; peak = Math.max(peak, s.y); } else if (air > 0 && landed === null) landed = s.z - z0;
      }
    }
    return { peak, air, distance: landed ?? 0, top, z: s.z };
  };
  const stand = run({}, 1.5, 0.1, null), walk = run({ z: 1 }, 2, 1, null), long = run({ z: 1, sprint: true }, 4.5, 3.5, null);
  const dash = run({ z: 1 }, t.dashTime, null, 0), dashJump = run({ z: 1 }, 2, 0.1, 0.05);
  // The glider: walk off a 1.5u cliff with a jump at its edge, Space again at the top, held, stick forward.
  const cliff: MoveWorld = { top: (_x, z) => (z <= 0.5 ? 1.5 : 0), wet: () => false }, g = { ...t, glider: 1 };
  let c = createMoveState(0, -3, cliff), phase = 0;
  for (let i = 0; i < 1200 && !(phase === 3 && c.mode === "ground"); i++) {
    const up = phase === 0 && c.z >= 0.3, press = phase === 2;
    if (up) phase = 1; else if (phase === 1 && c.vy <= 0) phase = 2; else if (press) phase = 3;
    c = stepMove(c, { ...NO_INPUT, z: 1, jump: phase === 1 || phase === 3, jumpPressed: up || press }, STEP, cliff, g);
  }
  // Sprint, then hold Space: how fast the bunny-hop gets, and how soon.
  let s = createMoveState(0, 0, flat), top = 0, toTop = 0;
  for (let i = 0; i < 960; i++) {
    s = stepMove(s, { ...NO_INPUT, z: 1, sprint: true, jump: i >= 360, jumpPressed: i === 360 }, STEP, flat, t);
    const v = Math.hypot(s.vx, s.vz);
    if (i >= 360 && v > top + 1e-6) { top = v; toTop = (i - 360) * STEP; }
  }
  // The slide: from a full sprint, how long and how far; a slide-jump off it and off a dash-slide.
  const slideFrom = (dash: boolean) => {
    let q = createMoveState(0, 0, flat), time = 0, z0 = 0, sliding = false, slideTime = 0, slideDist = 0, jumpDist = 0;
    for (let i = 0; i < 1200; i++, time += STEP) {
      const sneak = time >= 2.5, press = dash && Math.abs(time - 2.5) < STEP / 2;
      q = stepMove(q, { ...NO_INPUT, z: 1, sprint: time < 2.5, sneak, dashPressed: press }, STEP, flat, t);
      if (!sliding && q.mode === "slide") { sliding = true; z0 = q.z; slideTime = time; }
      if (sliding && q.mode !== "slide") { slideTime = time - slideTime; slideDist = q.z - z0; break; }
    }
    // A slide-jump a fifth of a second into the slide.
    let j = createMoveState(0, 0, flat), jz = 0, left = false;
    for (let i = 0, time2 = 0; i < 1200; i++, time2 += STEP) {
      const inSlide = j.mode === "slide" && j.modeT > 0.2 && !left;
      if (inSlide) { left = true; jz = j.z; }
      j = stepMove(j, { ...NO_INPUT, z: 1, sprint: time2 < 2.5, sneak: time2 >= 2.5, dashPressed: dash && Math.abs(time2 - 2.5) < STEP / 2, jump: inSlide, jumpPressed: inSlide }, STEP, flat, t);
      if (left && j.mode !== "air" && j.mode !== "slide") { jumpDist = j.z - jz; break; }
      if (left && j.mode === "slide" && j.modeT === STEP) { jumpDist = j.z - jz; break; }
    }
    return { slideTime, slideDist, jumpDist };
  };
  const slide = slideFrom(false), dashSlide = slideFrom(true);
  return { jump: stand.peak, air: stand.air, walkJump: walk.distance, longJump: long.distance, dash: dash.z, dashJump: dashJump.distance, top, toTop, glide: c.z - 0.5, slide, dashSlide };
}

/** The last 3 s of speed, 20 samples a second, with how the momentum stood (0 none, 1 kept, 2 bleeding): the readout's trace. */
const TRACE = 60;
interface Trace { speed: Float32Array; state: Uint8Array; next: number; t: number }
function tickLap(l: { lap: Lap; now: number }, p: MoveTelemetry, dt: number, trace: Trace) {
  l.now += dt;
  l.lap = lapStep(l.lap, p.y > -1 ? gateAt(p.x, p.z) : -1, l.now);
  trace.t += dt;
  while (trace.t >= 0.05) {
    trace.t -= 0.05;
    trace.speed[trace.next] = p.speed;
    trace.state[trace.next] = p.momentum === "kept" ? 1 : p.momentum === "bleeding" ? 2 : 0;
    trace.next = (trace.next + 1) % TRACE;
  }
}
/** Lap timing on sim time (slow motion slows the clock too), and the speed trace. */
function LapTracker({ telemetry, lap, timeScale, trace }: { telemetry: React.RefObject<MoveTelemetry>; lap: React.RefObject<{ lap: Lap; now: number }>; timeScale: number; trace: React.RefObject<Trace> }) {
  useFrame((_, delta) => {
    tickLap(lap.current, telemetry.current, Math.min(delta, 0.1) * timeScale, trace.current);
  });
  return null;
}
const TRACE_COLOR = ["#7fd1c0", "#FFD166", "#ef8a62"];
/** The trace as an SVG: speed over the last 3 s against the sprint and the ceiling, coloured kept (gold) or bleeding (coral). */
function SpeedTrace({ trace, sprint, ceiling }: { trace: Trace; sprint: number; ceiling: number }) {
  const W = 200, H = 46, top = ceiling * 1.15, y = (v: number) => H - (Math.min(v, top) / top) * H;
  const segs: { d: string; c: number }[] = [];
  for (let i = 1; i < TRACE; i++) {
    const a = (trace.next + i - 1) % TRACE, b = (trace.next + i) % TRACE;
    segs.push({ d: `M${((i - 1) / (TRACE - 1)) * W},${y(trace.speed[a]).toFixed(1)}L${(i / (TRACE - 1)) * W},${y(trace.speed[b]).toFixed(1)}`, c: trace.state[b] });
  }
  return <svg width={W} height={H} style={{ display: "block", margin: "4px 0" }} aria-label="Speed over the last 3 seconds">
    <line x1={0} x2={W} y1={y(ceiling)} y2={y(ceiling)} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 3" />
    <line x1={0} x2={W} y1={y(sprint)} y2={y(sprint)} stroke="rgba(255,255,255,0.18)" />
    {segs.map((s, i) => <path key={i} d={s.d} stroke={TRACE_COLOR[s.c]} strokeWidth={2} fill="none" />)}
  </svg>;
}

function CourseScene({ world, tuning, juice, spawn, telemetry, timeScale, lap, trace, walkSpeed, lite, shadows, zoom, signs }: {
  world: ReturnType<typeof islandOf>; tuning: MoveTuning; juice: MoveJuice; spawn: [number, number];
  telemetry: React.RefObject<MoveTelemetry>;
  timeScale: number; lap: React.RefObject<{ lap: Lap; now: number }>; trace: React.RefObject<Trace>; walkSpeed: number; lite: boolean; shadows: boolean; zoom: number; signs: boolean;
}) {
  const v = course();
  const camTarget = useRef(new THREE.Vector3(spawn[0], 0, spawn[1]));
  useFollowCamera(camTarget, zoom, null);
  const start = useMemo((): [number, number, number] => [spawn[0], 0, spawn[1]], [spawn]);
  const trees = useMemo(() => objectsOf("tree", v).map((o): TreeSpot => ({ x: o.x, z: o.z, seed: o.seed ?? 0 })), [v]);
  const scenery = useMemo(() => sceneryOf(v, world.ground, "summer"), [v, world]);
  const cafe = objectsOf("landmark", v).find(o => o.id === "cafe")!;
  return <>
    <IslandAtmosphere phase="day" light={LIGHT} look={LOOK} weather="clear" liteMode={lite} castShadows={shadows} ground={world.ground}
      cloudSize={[44, 52]} shadowExtent={30} fireflyAnchors={[]} trees={trees} />
    <GridWorld map={v.map} field={v.field} light={LIGHT} palette={TERRAIN} windScale={lite ? 0 : 1} />
    <GridOcean map={v.map} lite={lite} />
    <InstancedModels items={scenery} />
    <group position={[cafe.x, 0, cafe.z]}><ACNHParts parts={CHALET_VARIANTS.brown} /></group>
    {signs && COURSE_SIGNS.map(s => <Html key={s.text} position={[s.x, world.ground(s.x, s.z) + 2.4, s.z]} center distanceFactor={12} zIndexRange={[3, 0]}>
      <div style={{ background: "rgba(15,15,16,0.62)", color: "#f1ffff", padding: "2px 8px", borderRadius: 4, font: "600 12px ui-monospace, Menlo, monospace", whiteSpace: "nowrap", pointerEvents: "none" }}>{s.text}</div>
    </Html>)}
    <PlayerAvatar world={world} groundHeight={world.ground} groundSurface={world.surface} spawnPosition={start} showNameplate={false}
      camTarget={camTarget} tuning={tuning} juice={juice} telemetry={telemetry} timeScale={timeScale} walkSpeed={walkSpeed} />
    <LapTracker telemetry={telemetry} lap={lap} timeScale={timeScale} trace={trace} />
  </>;
}

const box: React.CSSProperties = { background: "rgba(11,14,20,0.82)", color: "#f1ffff", borderRadius: 8, font: "12px ui-monospace, Menlo, monospace" };

export default function MoveLab() {
  const [graphics] = useGraphicsSettings();
  const params = useMemo(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search), []);
  const [spawn, setSpawn] = useState((): [number, number] => {
    const at = params.get("at")?.split(",").map(Number);
    return at && at.length === 2 && at.every(Number.isFinite) ? [at[0], at[1]] : COURSE_SPAWN;
  });
  // Owning the leaf glider is a flag on the sim, not a feel value: the presets leave it alone.
  const [glider, setGlider] = useState(params.get("glider") !== "0");
  const world = useMemo(() => islandOf(course()), []);
  const [tuning, setTuning] = useState<MoveTuning>(MOVE_TUNING);
  const [juice, setJuice] = useState<MoveJuice>(MOVE_JUICE);
  const [preset, setPreset] = useState("Juicy");
  const [slow, setSlow] = useState(1);
  const bindings = useMoveKeys(), crouchNow = crouchKey(bindings, useKeyboardLocked());
  const [listening, setListening] = useState<MoveAction | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const coarse = useCoarsePointer(), touch = params.get("touch") === "1" || coarse;
  const [narrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 720);
  // The panel starts closed on a phone (it would cover the course).
  const [panel, setPanel] = useState(params.get("panel") ? params.get("panel") !== "0" : !touch);
  const [hud, setHud] = useState<{ t: MoveTelemetry; lap: Lap; now: number; trace: Trace } | null>(null);
  const [respawn, setRespawn] = useState(0);
  const telemetry = useRef<MoveTelemetry>({ x: 0, y: 0, z: 0, speed: 0, mode: "ground", hops: 0, dashReady: true, long: false, momentum: "", slideJump: false });
  const lap = useRef<{ lap: Lap; now: number }>({ lap: NEW_LAP, now: 0 });
  const trace = useRef<Trace>({ speed: new Float32Array(TRACE), state: new Uint8Array(TRACE), next: 0, t: 0 });
  useSoundUnlock();

  // The panel's values survive a reload (this browser only); Copy JSON is how they reach the repo.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is read once after mount (the page renders on the server first)
      if (saved?.move) { setTuning({ ...MOVE_TUNING, ...saved.move }); setJuice({ ...MOVE_JUICE, ...saved.juice }); setPreset(saved.preset ?? "Custom"); }
    } catch { /* defaults */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify({ move: tuning, juice, preset })); } catch { /* session only */ } }, [tuning, juice, preset]);
  useEffect(() => {
    const id = window.setInterval(() => {
      const tr = trace.current;
      setHud({ t: { ...telemetry.current }, lap: lap.current.lap, now: lap.current.now, trace: { speed: tr.speed.slice(), state: tr.state.slice(), next: tr.next, t: 0 } });
    }, 100);
    return () => window.clearInterval(id);
  }, []);
  // Remap: the next key press binds.
  useNextKey(listening !== null, key => {
    const r = remapMove(bindings, listening!, key);
    setNote(r.ok ? null : r.error);
    if (r.ok) setListening(null);
  }, () => { setListening(null); setNote(null); });

  const numbers = useMemo(() => measure(tuning), [tuning]);
  const simTuning = useMemo(() => ({ ...tuning, glider: glider ? 1 : 0 }), [tuning, glider]);
  const set = (k: keyof MoveTuning, value: number) => { setTuning(t => ({ ...t, [k]: value })); setPreset("Custom"); };
  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(JSON.stringify({ move: tuning, juice }, null, 2)).then(() => setNote("Copied the tuning JSON."), () => setNote("Clipboard blocked: select the JSON below."));
  }, [tuning, juice]);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
  const h = hud, top = topSpeed(tuning), hopBase = tuning.sprintSpeed * tuning.longJumpBoost;
  const presetOf = (presets: Record<string, Partial<MoveTuning>>) => Object.keys(presets).find(p => Object.entries(presets[p]).every(([k, v]) => tuning[k as keyof MoveTuning] === v));
  const dashPreset = presetOf(DASH_PRESETS), glidePreset = presetOf(GLIDE_PRESETS), slidePreset = presetOf(SLIDE_PRESETS), momentumPreset = presetOf(MOMENTUM_PRESETS);

  return <div style={{ position: "fixed", inset: "40px 0 0 0", background: "#0b0e14", overflow: "hidden" }}>
    <Canvas tabIndex={0} role="application" aria-label="Movement lab course" gl={{ antialias: false, powerPreference: "high-performance" }} dpr={graphics.pixelated ? 0.5 : [1, 1.5]}
      style={{ imageRendering: graphics.pixelated ? "pixelated" : "auto" }} camera={{ position: [spawn[0], 8, spawn[1] - 11], fov: BASE_FOV, near: 0.1, far: 120 }}
      shadows={graphics.shadows && !graphics.liteMode ? "percentage" : false}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
      <Suspense fallback={null}>
        <CourseScene key={respawn} world={world} tuning={simTuning} juice={juice} spawn={spawn} telemetry={telemetry}
          timeScale={slow} lap={lap} trace={trace} walkSpeed={tuning.walkSpeed} lite={graphics.liteMode} shadows={graphics.shadows && !graphics.liteMode} zoom={Number(params.get("zoom")) || 1} signs={params.get("panel") !== "0"} />
        <PostFX antialias={!graphics.liteMode && !graphics.pixelated} grade={LIGHT.grade} fx={lookFx(CURRENT, !graphics.liteMode)} />
        <LookMaterials preset={CURRENT} />
        <SunShadows />
      </Suspense>
    </Canvas>

    {/* Speed, chain and dash readout */}
    {h && <div data-testid="move-hud" style={{ ...box, position: "absolute", left: 12, top: 12, padding: "10px 12px", minWidth: 210 }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{h.t.speed.toFixed(1)} <span style={{ fontSize: 11, color: "#8a939a" }}>u/s</span></div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.12)", borderRadius: 3, margin: "4px 0 8px" }}>
        <div style={{ height: 6, width: `${Math.min(100, (h.t.speed / top) * 100)}%`, background: h.t.speed > tuning.sprintSpeed * 1.01 ? "#FFD166" : "#7fd1c0", borderRadius: 3 }} />
      </div>
      {/* A pip per hop's worth of speed over the long jump: they fill as the held hops build and drain as the speed bleeds off. */}
      {tuning.hopChainMax > 0 && <div style={{ display: "flex", alignItems: "center", gap: 4 }}>Bunny-hop {Array.from({ length: tuning.hopChainMax }, (_, i) =>
        <span key={i} style={{ display: "inline-block", width: 14, height: 10, borderRadius: 2, background: h.t.speed >= hopBase + (i + 1) * tuning.hopBoost - 0.05 ? "#FFD166" : "rgba(255,255,255,0.18)" }} />)}
        {h.t.speed >= top - 0.05 && <span style={{ color: "#FFD166", fontWeight: 700 }}>max</span>}</div>}
      <div style={{ color: "#8a939a", fontSize: 11 }}>sprint and hold Space to bunny-hop</div>
      {/* Momentum (David, 2026-10-01): kept through tech, bleeding on plain ground; the trace shows the last 3 s against the sprint and the ceiling. */}
      <div data-testid="move-momentum" style={{ marginTop: 6, display: "flex", justifyContent: "space-between" }}>
        <span>Momentum</span>
        <span style={{ fontWeight: 700, color: h.t.momentum === "kept" ? "#FFD166" : h.t.momentum === "bleeding" ? "#ef8a62" : "#8a939a" }}>{h.t.momentum === "kept" ? "kept" : h.t.momentum === "bleeding" ? "bleeding" : "—"}</span>
      </div>
      <SpeedTrace trace={h.trace} sprint={tuning.sprintSpeed} ceiling={tuning.momentumCeiling} />
      <div style={{ color: "#8a939a", fontSize: 11 }}>dashed line: the ceiling ({tuning.momentumCeiling}) · gold kept · coral bleeding</div>
      <div style={{ marginTop: 4, color: "#c9d1d6" }}>{h.t.mode}{h.t.long ? " · long jump" : ""}{h.t.slideJump ? " · slide-jump" : ""} · dash {h.t.dashReady ? "ready" : "…"}</div>
    </div>}

    {/* Lap timer */}
    {h && <div data-testid="move-lap" style={{ ...box, position: "absolute", padding: "8px 14px", textAlign: "center", ...(narrow ? { left: 12, top: 118 } : { left: "50%", top: 12, transform: "translateX(-50%)" }) }}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{h.lap.running ? fmt(h.now - h.lap.start) : "0:00.00"}</div>
      <div style={{ color: "#c9d1d6" }}>{h.lap.running ? (h.lap.next < COURSE_GATES.length ? `Next: ${COURSE_GATES[h.lap.next].name} (${h.lap.next}/${COURSE_GATES.length - 1})` : "Next: the start line") : "Cross the brick line to start a lap"}</div>
      <div style={{ color: "#8a939a" }}>Last {h.lap.last === null ? "—" : fmt(h.lap.last)} · Best {h.lap.best === null ? "—" : fmt(h.lap.best)}</div>
    </div>}

    <div style={{ ...box, position: "absolute", left: 12, bottom: touch ? 180 : 12, padding: "6px 10px", color: "#c9d1d6" }}>
      {!touch && MOVE_ACTIONS.filter(a => !["forward", "left", "back", "right"].includes(a.id)).map(a => <span key={a.id} style={{ marginRight: 10 }}><kbd>{keyName(a.id === "crouch" ? crouchNow || bindings.crouch : bindings[a.id])}</kbd> {a.name}{a.id === "jump" ? ` (hold while sprinting: bunny-hop${glider ? "; again while falling, held: glide" : ""})` : a.id === "crouch" ? " (held at speed: slide)" : ""}</span>)}
      <label style={{ marginLeft: 6 }}><input type="checkbox" checked={glider} onChange={e => setGlider(e.target.checked)} /> Owns the leaf glider</label>
      <button onClick={() => { lap.current = { lap: NEW_LAP, now: lap.current.now }; setSpawn(COURSE_SPAWN); setRespawn(n => n + 1); }} style={{ marginLeft: 6, color: "#FFD166" }}>Back to start</button>
      <button onClick={() => { setSpawn(GLIDE_SPAWN); setRespawn(n => n + 1); }} style={{ marginLeft: 6, color: "#FFD166" }}>Glide lane</button>
      <button onClick={() => { setSpawn(SLIDE_SPAWN); setRespawn(n => n + 1); }} style={{ marginLeft: 6, color: "#FFD166" }}>Slide lane</button>
    </div>

    {touch && <TouchControls />}

    {/* Tuning panel */}
    <button onClick={() => setPanel(p => !p)} style={{ ...box, position: "absolute", right: 12, top: 12, padding: "6px 10px", zIndex: 30 }}>{panel ? "Hide tuning" : "Tuning"}</button>
    {panel && <aside data-testid="move-panel" style={{ ...box, position: "absolute", right: 12, top: 48, bottom: 12, width: 340, maxWidth: "calc(100vw - 24px)", overflowY: "auto", overflowX: "hidden", boxSizing: "border-box", padding: 12, zIndex: 25 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={preset} onChange={e => { const p = e.target.value; setPreset(p); if (PRESETS[p]) setTuning({ ...MOVE_TUNING, ...PRESETS[p] }); }} style={{ background: "#1b2230", color: "#fff" }}>
          {[...Object.keys(PRESETS), ...(PRESETS[preset] ? [] : [preset])].map(p => <option key={p}>{p}</option>)}
        </select>
        <button onClick={copy} style={{ color: "#FFD166" }}>Copy JSON</button>
        <button onClick={() => { setTuning(MOVE_TUNING); setJuice(MOVE_JUICE); setPreset("Juicy"); }}>Reset</button>
        <label>Speed <select value={slow} onChange={e => setSlow(Number(e.target.value))} style={{ background: "#1b2230", color: "#fff" }}>
          {[1, 0.5, 0.25, 0.1].map(v => <option key={v} value={v}>{v === 1 ? "real time" : `${v}×`}</option>)}
        </select></label>
      </div>
      {note && <p role="status" style={{ color: "#7fd1c0", margin: "6px 0 0" }}>{note}</p>}
      <p style={{ color: "#c9d1d6", margin: "8px 0", lineHeight: 1.5 }}>
        Jump {numbers.jump.toFixed(2)}u in {numbers.air.toFixed(2)}s · walking jump {numbers.walkJump.toFixed(1)}u · long jump {numbers.longJump.toFixed(1)}u ·
        dash {numbers.dash.toFixed(1)}u · dash jump {numbers.dashJump.toFixed(1)}u · held bunny-hop tops out at {numbers.top.toFixed(1)} u/s after {numbers.toTop.toFixed(1)}s (walk {tuning.walkSpeed}, sprint {tuning.sprintSpeed}) ·
        glide {numbers.glide.toFixed(1)} tiles off a 1.5u cliff (jump at the edge, Space again at the top) ·
        slide from a sprint {numbers.slide.slideTime.toFixed(2)}s over {numbers.slide.slideDist.toFixed(1)}u, slide-jump {numbers.slide.jumpDist.toFixed(1)}u ·
        dash-slide {numbers.dashSlide.slideTime.toFixed(2)}s over {numbers.dashSlide.slideDist.toFixed(1)}u, its slide-jump {numbers.dashSlide.jumpDist.toFixed(1)}u (the lane&apos;s gap is 7)
      </p>
      {GROUPS.map(g => <fieldset key={g.name} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, margin: "8px 0", padding: "4px 8px" }}>
        <legend style={{ color: "#FFD166" }}>{g.name}</legend>
        {[["Dash (Q)", DASH_PRESETS, dashPreset] as const, ["Glide (leaf)", GLIDE_PRESETS, glidePreset] as const, ["Slide", SLIDE_PRESETS, slidePreset] as const, ["Momentum", MOMENTUM_PRESETS, momentumPreset] as const].filter(([name]) => name === g.name).map(([name, presets, current]) =>
          <div key={name} role="group" aria-label={`${name} presets`} style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "2px 0 6px" }}>
            {Object.keys(presets).map(p => <button key={p} aria-pressed={current === p} onClick={() => { setTuning(t => ({ ...t, ...presets[p] })); setPreset("Custom"); }}
              style={{ color: current === p ? "#0b0e14" : "#f1ffff", background: current === p ? "#FFD166" : "#1b2230", borderRadius: 4, padding: "1px 8px" }}>{p}</button>)}
          </div>)}
        {g.keys.map(([k, min, max, step]) => <label key={k} style={{ display: "grid", gridTemplateColumns: "118px minmax(0, 1fr) 46px", gap: 6, alignItems: "center", margin: "3px 0" }}>
          <span>{label(k)}</span>
          <input type="range" min={min} max={max} step={step} value={tuning[k]} style={{ width: "100%", minWidth: 0 }} onChange={e => set(k, Number(e.target.value))} />
          <output style={{ textAlign: "right" }}>{tuning[k]}</output>
        </label>)}
      </fieldset>)}
      <fieldset style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, margin: "8px 0", padding: "4px 8px" }}>
        <legend style={{ color: "#FFD166" }}>Juice</legend>
        <p style={{ color: "#8a939a", margin: "2px 0 6px" }}>Each effect&apos;s amount; 0 turns it off. Slow motion is the Speed menu above.</p>
        {JUICE_KEYS.map(([k, min, max, step]) => <label key={k} style={{ display: "grid", gridTemplateColumns: "118px minmax(0, 1fr) 46px", gap: 6, alignItems: "center", margin: "3px 0" }}>
          <span>{label(k)}</span>
          <input type="range" min={min} max={max} step={step} value={juice[k]} style={{ width: "100%", minWidth: 0 }} onChange={e => { setJuice(j => ({ ...j, [k]: Number(e.target.value) })); setPreset("Custom"); }} />
          <output style={{ textAlign: "right" }}>{juice[k]}</output>
        </label>)}
        <details style={{ margin: "6px 0" }}>
          <summary style={{ cursor: "pointer" }}>Particle pack (painted, art/fx/build_pack.py)</summary>
          {/* eslint-disable-next-line @next/next/no-img-element -- the raw atlas, a dev preview */}
          <img src={PACK_URL} alt="The movement particle pack: one row of eight frames per effect" style={{ width: "100%", background: "#8fa16c", borderRadius: 4, marginTop: 4 }} />
        </details>
      </fieldset>
      <fieldset style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, margin: "8px 0", padding: "4px 8px" }}>
        <legend style={{ color: "#FFD166" }}>Keys (this device)</legend>
        {MOVE_ACTIONS.map(a => <div key={a.id} style={{ display: "flex", justifyContent: "space-between", margin: "3px 0" }}>
          <span>{a.name}</span>
          <button aria-pressed={listening === a.id} onClick={() => { setListening(a.id); setNote("Press a key (Esc to cancel)."); }}>{listening === a.id ? "Press a key…" : <kbd>{keyName(bindings[a.id])}</kbd>}</button>
        </div>)}
      </fieldset>
      <textarea readOnly value={JSON.stringify({ move: tuning, juice })} rows={3} style={{ width: "100%", background: "#0b0e14", color: "#8a939a", font: "10px ui-monospace, Menlo, monospace" }} />
    </aside>}
  </div>;
}
