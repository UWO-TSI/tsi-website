"use client";

/**
 * /lab/move — the movement lab (specs/movement.md, build order 2). The test
 * course on the real grid terrain, the real character and the follow camera's
 * framing, the movement sim, and a live tuning panel with every feel value,
 * presets (and dash presets to compare) and "Copy JSON", so David tunes the
 * feel himself; a lap timer is the skill readout. Dev only (the /lab layout
 * 404s in production).
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
import { ISLAND_TERRAIN, islandLight, withSeason } from "@/lib/game/islandLighting";
import { seasonLook } from "@/lib/game/seasonalLook";
import { CURRENT, lookFx } from "@/lib/game/lookPreset";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { islandOf } from "@/lib/game/defaultIsland";
import { objectsOf } from "@/lib/game/villageMap";
import { COURSE_GATES, COURSE_SIGNS, COURSE_SPAWN, NEW_LAP, course, gateAt, lapStep, type Lap } from "@/lib/game/movement/course";
import { MOVE_TUNING, createMoveState, stepMove, topSpeed, NO_INPUT, STEP, type MoveInput, type MoveTuning, type MoveWorld } from "@/lib/game/movement/sim";
import { MOVE_ACTIONS, keyName, remapMove, useMoveKeys, useNextKey, type MoveAction } from "@/lib/game/movement/keys";
import { AudioManager } from "@/lib/game/audio";
import { useCoarsePointer } from "@/lib/game/useMediaQuery";

const SUMMER = { season: "summer" as const, weights: { spring: 0, summer: 1, autumn: 0, winter: 0 } };
const LOOK = seasonLook(SUMMER, {});
const LIGHT = withSeason(islandLight(CURRENT, "day"), LOOK);
const TERRAIN = { ...ISLAND_TERRAIN, grass: LOOK.grass };
const STORE = "tsi.moveLab.v2"; // v2: the held bunny-hop and the eased dash (2026-09-29) start from the new defaults

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
];
const JUICE_KEYS: [keyof MoveJuice, ...Range][] = [["camLead", 0, 0.4, 0.01], ["fovKick", 0, 10, 0.5], ["dashKick", 0, 8, 0.5], ["squash", 0, 2, 0.05], ["dust", 0, 2, 0.05], ["streaks", 0, 2, 0.05]];
/** Dash shapes to compare (row 250), about the same reach each: only the dash values change. */
const DASH_PRESETS: Record<string, Partial<MoveTuning>> = {
  // The shipped dash (MOVE_TUNING), so "current preset" keeps matching when the defaults are retuned.
  Burst: (({ dashSpeed, dashTime, dashExit, dashEase, dashCooldown, airDashLift }) => ({ dashSpeed, dashTime, dashExit, dashEase, dashCooldown, airDashLift }))(MOVE_TUNING),
  Glide: { dashSpeed: 13.5, dashTime: 0.21, dashExit: 0.8, dashEase: 1, dashCooldown: 0.45, airDashLift: 1 },
  Blink: { dashSpeed: 28, dashTime: 0.16, dashExit: 0.38, dashEase: 3, dashCooldown: 0.6, airDashLift: 0 },
  "First cut": { dashSpeed: 14, dashTime: 0.18, dashExit: 0.7, dashEase: 0, dashCooldown: 0.45, airDashLift: 0 },
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
      // Space held from the press; sprint only up to the takeoff, or the landing would bunny-hop on.
      const sprint = !!setup.sprint && (jumpAt === null || time < jumpAt + STEP);
      s = stepMove(s, { ...NO_INPUT, ...setup, sprint, jump: jumpAt !== null && time >= jumpAt, jumpPressed: jumpAt !== null && Math.abs(time - jumpAt) < STEP / 2, dashPressed: dashAt !== null && Math.abs(time - dashAt) < STEP / 2 }, STEP, flat, t);
      top = Math.max(top, Math.hypot(s.vx, s.vz));
      if (jumpAt !== null && time >= jumpAt) {
        if (s.mode === "air") { air += STEP; peak = Math.max(peak, s.y); } else if (air > 0 && landed === null) landed = s.z - z0;
      }
    }
    return { peak, air, distance: landed ?? 0, top, z: s.z };
  };
  const stand = run({}, 1.5, 0.1, null), walk = run({ z: 1 }, 2, 1, null), long = run({ z: 1, sprint: true }, 4.5, 3.5, null);
  const dash = run({ z: 1 }, t.dashTime, null, 0), dashJump = run({ z: 1 }, 2, 0.1, 0.05);
  // Sprint, then hold Space: how fast the bunny-hop gets, and how soon.
  let s = createMoveState(0, 0, flat), top = 0, toTop = 0;
  for (let i = 0; i < 960; i++) {
    s = stepMove(s, { ...NO_INPUT, z: 1, sprint: true, jump: i >= 360, jumpPressed: i === 360 }, STEP, flat, t);
    const v = Math.hypot(s.vx, s.vz);
    if (i >= 360 && v > top + 1e-6) { top = v; toTop = (i - 360) * STEP; }
  }
  return { jump: stand.peak, air: stand.air, walkJump: walk.distance, longJump: long.distance, dash: dash.z, dashJump: dashJump.distance, top, toTop };
}

function tickLap(l: { lap: Lap; now: number }, p: MoveTelemetry, dt: number) {
  l.now += dt;
  l.lap = lapStep(l.lap, p.y > -1 ? gateAt(p.x, p.z) : -1, l.now);
}
/** Lap timing on sim time (slow motion slows the clock too). */
function LapTracker({ telemetry, lap, timeScale }: { telemetry: React.RefObject<MoveTelemetry>; lap: React.RefObject<{ lap: Lap; now: number }>; timeScale: number }) {
  useFrame((_, delta) => {
    tickLap(lap.current, telemetry.current, Math.min(delta, 0.1) * timeScale);
  });
  return null;
}

function CourseScene({ world, tuning, juice, spawn, telemetry, timeScale, lap, walkSpeed, lite, shadows, zoom, signs }: {
  world: ReturnType<typeof islandOf>; tuning: MoveTuning; juice: MoveJuice; spawn: [number, number];
  telemetry: React.RefObject<MoveTelemetry>;
  timeScale: number; lap: React.RefObject<{ lap: Lap; now: number }>; walkSpeed: number; lite: boolean; shadows: boolean; zoom: number; signs: boolean;
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
    <LapTracker telemetry={telemetry} lap={lap} timeScale={timeScale} />
  </>;
}

const box: React.CSSProperties = { background: "rgba(11,14,20,0.82)", color: "#f1ffff", borderRadius: 8, font: "12px ui-monospace, Menlo, monospace" };

export default function MoveLab() {
  const [graphics] = useGraphicsSettings();
  const params = useMemo(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search), []);
  const spawn = useMemo((): [number, number] => {
    const at = params.get("at")?.split(",").map(Number);
    return at && at.length === 2 && at.every(Number.isFinite) ? [at[0], at[1]] : COURSE_SPAWN;
  }, [params]);
  const world = useMemo(() => islandOf(course()), []);
  const [tuning, setTuning] = useState<MoveTuning>(MOVE_TUNING);
  const [juice, setJuice] = useState<MoveJuice>(MOVE_JUICE);
  const [preset, setPreset] = useState("Juicy");
  const [slow, setSlow] = useState(1);
  const bindings = useMoveKeys();
  const [listening, setListening] = useState<MoveAction | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const coarse = useCoarsePointer(), touch = params.get("touch") === "1" || coarse;
  const [narrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 720);
  // The panel starts closed on a phone (it would cover the course).
  const [panel, setPanel] = useState(params.get("panel") ? params.get("panel") !== "0" : !touch);
  const [hud, setHud] = useState<{ t: MoveTelemetry; lap: Lap; now: number } | null>(null);
  const [respawn, setRespawn] = useState(0);
  const telemetry = useRef<MoveTelemetry>({ x: 0, y: 0, z: 0, speed: 0, mode: "ground", hops: 0, dashReady: true, long: false });
  const lap = useRef<{ lap: Lap; now: number }>({ lap: NEW_LAP, now: 0 });
  // Sound effects unlock on the first key or tap (browsers need a gesture).
  useEffect(() => {
    const unlock = () => AudioManager.enable();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);

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
    const id = window.setInterval(() => setHud({ t: { ...telemetry.current }, lap: lap.current.lap, now: lap.current.now }), 100);
    return () => window.clearInterval(id);
  }, []);
  // Remap: the next key press binds.
  useNextKey(listening !== null, key => {
    const r = remapMove(bindings, listening!, key);
    setNote(r.ok ? null : r.error);
    if (r.ok) setListening(null);
  }, () => { setListening(null); setNote(null); });

  const numbers = useMemo(() => measure(tuning), [tuning]);
  const set = (k: keyof MoveTuning, value: number) => { setTuning(t => ({ ...t, [k]: value })); setPreset("Custom"); };
  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(JSON.stringify({ move: tuning, juice }, null, 2)).then(() => setNote("Copied the tuning JSON."), () => setNote("Clipboard blocked: select the JSON below."));
  }, [tuning, juice]);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
  const h = hud, top = topSpeed(tuning), hopBase = tuning.sprintSpeed * tuning.longJumpBoost;
  const dashPreset = Object.keys(DASH_PRESETS).find(p => Object.entries(DASH_PRESETS[p]).every(([k, v]) => tuning[k as keyof MoveTuning] === v));

  return <div style={{ position: "fixed", inset: "40px 0 0 0", background: "#0b0e14", overflow: "hidden" }}>
    <Canvas tabIndex={0} role="application" aria-label="Movement lab course" gl={{ antialias: false, powerPreference: "high-performance" }} dpr={graphics.pixelated ? 0.5 : [1, 1.5]}
      style={{ imageRendering: graphics.pixelated ? "pixelated" : "auto" }} camera={{ position: [spawn[0], 8, spawn[1] - 11], fov: BASE_FOV, near: 0.1, far: 120 }}
      shadows={graphics.shadows && !graphics.liteMode ? "percentage" : false}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
      <Suspense fallback={null}>
        <CourseScene key={respawn} world={world} tuning={tuning} juice={juice} spawn={spawn} telemetry={telemetry}
          timeScale={slow} lap={lap} walkSpeed={tuning.walkSpeed} lite={graphics.liteMode} shadows={graphics.shadows && !graphics.liteMode} zoom={Number(params.get("zoom")) || 1} signs={params.get("panel") !== "0"} />
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
      <div style={{ marginTop: 4, color: "#c9d1d6" }}>{h.t.mode}{h.t.long ? " · long jump" : ""} · dash {h.t.dashReady ? "ready" : "…"}</div>
    </div>}

    {/* Lap timer */}
    {h && <div data-testid="move-lap" style={{ ...box, position: "absolute", padding: "8px 14px", textAlign: "center", ...(narrow ? { left: 12, top: 118 } : { left: "50%", top: 12, transform: "translateX(-50%)" }) }}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{h.lap.running ? fmt(h.now - h.lap.start) : "0:00.00"}</div>
      <div style={{ color: "#c9d1d6" }}>{h.lap.running ? (h.lap.next < COURSE_GATES.length ? `Next: ${COURSE_GATES[h.lap.next].name} (${h.lap.next}/${COURSE_GATES.length - 1})` : "Next: the start line") : "Cross the brick line to start a lap"}</div>
      <div style={{ color: "#8a939a" }}>Last {h.lap.last === null ? "—" : fmt(h.lap.last)} · Best {h.lap.best === null ? "—" : fmt(h.lap.best)}</div>
    </div>}

    <div style={{ ...box, position: "absolute", left: 12, bottom: touch ? 180 : 12, padding: "6px 10px", color: "#c9d1d6" }}>
      {!touch && MOVE_ACTIONS.filter(a => !["forward", "left", "back", "right"].includes(a.id)).map(a => <span key={a.id} style={{ marginRight: 10 }}><kbd>{keyName(bindings[a.id])}</kbd> {a.name}{a.id === "jump" ? " (hold while sprinting: bunny-hop)" : ""}</span>)}
      <button onClick={() => { lap.current = { lap: NEW_LAP, now: lap.current.now }; setRespawn(n => n + 1); }} style={{ marginLeft: 6, color: "#FFD166" }}>Back to start</button>
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
        dash {numbers.dash.toFixed(1)}u · dash jump {numbers.dashJump.toFixed(1)}u · held bunny-hop tops out at {numbers.top.toFixed(1)} u/s after {numbers.toTop.toFixed(1)}s (walk {tuning.walkSpeed}, sprint {tuning.sprintSpeed})
      </p>
      {GROUPS.map(g => <fieldset key={g.name} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, margin: "8px 0", padding: "4px 8px" }}>
        <legend style={{ color: "#FFD166" }}>{g.name}</legend>
        {g.name === "Dash (Q)" && <div role="group" aria-label="Dash presets" style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "2px 0 6px" }}>
          {Object.keys(DASH_PRESETS).map(p => <button key={p} aria-pressed={dashPreset === p} onClick={() => { setTuning(t => ({ ...t, ...DASH_PRESETS[p] })); setPreset("Custom"); }}
            style={{ color: dashPreset === p ? "#0b0e14" : "#f1ffff", background: dashPreset === p ? "#FFD166" : "#1b2230", borderRadius: 4, padding: "1px 8px" }}>{p}</button>)}
        </div>}
        {g.keys.map(([k, min, max, step]) => <label key={k} style={{ display: "grid", gridTemplateColumns: "118px minmax(0, 1fr) 46px", gap: 6, alignItems: "center", margin: "3px 0" }}>
          <span>{label(k)}</span>
          <input type="range" min={min} max={max} step={step} value={tuning[k]} style={{ width: "100%", minWidth: 0 }} onChange={e => set(k, Number(e.target.value))} />
          <output style={{ textAlign: "right" }}>{tuning[k]}</output>
        </label>)}
      </fieldset>)}
      <fieldset style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, margin: "8px 0", padding: "4px 8px" }}>
        <legend style={{ color: "#FFD166" }}>Juice</legend>
        {JUICE_KEYS.map(([k, min, max, step]) => <label key={k} style={{ display: "grid", gridTemplateColumns: "118px minmax(0, 1fr) 46px", gap: 6, alignItems: "center", margin: "3px 0" }}>
          <span>{label(k)}</span>
          <input type="range" min={min} max={max} step={step} value={juice[k]} style={{ width: "100%", minWidth: 0 }} onChange={e => { setJuice(j => ({ ...j, [k]: Number(e.target.value) })); setPreset("Custom"); }} />
          <output style={{ textAlign: "right" }}>{juice[k]}</output>
        </label>)}
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
