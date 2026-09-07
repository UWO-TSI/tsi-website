"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import * as THREE from "three";
import GridWorld from "./grid/GridWorld";
import GridOcean from "./grid/GridOcean";
import PlayerAvatar from "./PlayerAvatar";
import NPC from "./NPC";
import { DEFAULT_NPC_PERSONAS } from "@/data/content-defaults";
import GameSceneBoundary from "./GameSceneBoundary";
import PostFX from "./PostFX";
import { GLBProp, NatureTree, NatureBush, NatureFlowerCluster } from "./NatureModels";
import { ACNHBuilding } from "./ACNHBuilding";
import { createDefaultIsland, DEFAULT_SPAWN, ISLAND_TREES, ISLAND_BUSHES, ISLAND_FLOWERS, ISLAND_PROPS } from "@/lib/game/defaultIsland";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { DEFAULT_GRADE } from "@/lib/game/grading";
import { TUNING_DEFAULTS } from "@/lib/game/tuning";
import { MOONLIGHT } from "@/lib/game/moonlight";
import { WORLD_BEND } from "@/lib/game/curvedWorld";
import styles from "./DefaultIslandWorld.module.css";

const LIGHTING = {
  day: { name: "Daylight", sky: "#b7dce0", sun: "#fff3d6", strength: 3.2, fill: "#c4e5ef", position: [-12, 24, -14] as [number, number, number] },
  evening: { name: "Golden hour", sky: "#d5b7a9", sun: "#ffd09a", strength: 2.7, fill: "#b3bfdb", position: [-22, 12, -8] as [number, number, number] },
  overcast: { name: "Overcast", sky: "#b4c8ce", sun: "#e6eff5", strength: 1.35, fill: "#d2e0e0", position: [-12, 24, -14] as [number, number, number] },
  night: { name: "Moonlight", sky: "#1a1a40", sun: MOONLIGHT.color, strength: MOONLIGHT.strength, fill: "#334466", position: [...MOONLIGHT.position] as [number, number, number] },
};
type LightPreset = keyof typeof LIGHTING;
type Metrics = { fps: number; frameMs: number; calls: number; triangles: number; x: number; z: number };
const GRADE = { ...DEFAULT_GRADE, desat: 0.08, lift: 0.5, warmth: 0.7, vignette: 0.2 };
const WATER = { ...TUNING_DEFAULTS.water, foamWidth: 0.22, foamStrength: 0.65, foamSoft: 0.12, ringStrength: 0.12, glare: 0.4, sunGlint: 1.5 };
const NIGHT_WATER = { ...WATER, deepColor: 0x152943, midColor: 0x284c67, shallowColor: 0x516e81, bedColor: 0x394b59, foamColor: 0x8babc2, ringColor: 0x7493aa, glare: 0.08, sunGlint: 0.25 };
const TREE_SEEDS = [0, 3, 2, 5, 7, 8, 1, 3];

function refreshStaticShadows(gl: THREE.WebGLRenderer) {
  gl.shadowMap.autoUpdate = false;
  gl.shadowMap.needsUpdate = true;
}

function StaticShadows({ preset, enabled }: { preset: LightPreset; enabled: boolean }) {
  const { gl } = useThree();
  const { active } = useProgress();
  useEffect(() => { refreshStaticShadows(gl); }, [gl, active, preset, enabled]);
  return null;
}

function IslandScene({ preset, overview, shadows, reset, onMetrics }: {
  preset: LightPreset; overview: boolean; shadows: boolean; reset: number; onMetrics: (metrics: Metrics) => void;
}) {
  const island = useMemo(() => createDefaultIsland(), []);
  const player = useRef(new THREE.Vector3(...DEFAULT_SPAWN));
  const focus = useMemo(() => new THREE.Vector3(), []);
  const destination = useMemo(() => new THREE.Vector3(), []);
  const samples = useRef({ seconds: 0, frames: 0 });
  const { camera } = useThree();
  const move = useCallback((position: THREE.Vector3) => { player.current.copy(position); }, []);
  useEffect(() => { player.current.set(...DEFAULT_SPAWN); }, [reset]);
  const light = LIGHTING[preset];
  useFrame(({ gl }, delta) => {
    const calls = gl.info.render.calls, triangles = gl.info.render.triangles;
    gl.info.reset();
    focus.set(overview ? 0 : player.current.x, overview ? 0 : player.current.y + 0.7, overview ? 0 : player.current.z);
    destination.copy(focus).add(overview ? OVERVIEW_OFFSET : WALK_OFFSET);
    camera.position.lerp(destination, 1 - Math.exp(-Math.min(delta, 0.1) * 5));
    camera.lookAt(focus.x, focus.y - (overview ? camera.position.distanceToSquared(focus) * WORLD_BEND : 0), focus.z);
    camera.updateMatrixWorld();
    samples.current.seconds += delta;
    samples.current.frames++;
    if (samples.current.seconds >= 1) {
      onMetrics({ fps: Math.round(samples.current.frames / samples.current.seconds), frameMs: samples.current.seconds * 1000 / samples.current.frames,
        calls, triangles, x: player.current.x, z: player.current.z });
      samples.current = { seconds: 0, frames: 0 };
    }
  }, -2);
  return (
    <>
      <color attach="background" args={[light.sky]} />
      <fog attach="fog" args={[light.sky, overview ? 50 : 36, overview ? 85 : 74]} />
      <ambientLight intensity={preset === "night" ? 0.22 : 0.4} color={light.fill} />
      <hemisphereLight args={[preset === "night" ? "#EAF6FF" : light.fill, preset === "night" ? "#2e4a38" : "#a0a980", preset === "night" ? 0.2 : 1]} />
      <directionalLight position={light.position} color={light.sun} intensity={light.strength}
        castShadow={shadows} shadow-mapSize={[1024, 1024]} shadow-camera-left={-26} shadow-camera-right={26}
        shadow-camera-top={24} shadow-camera-bottom={-24} shadow-camera-near={1} shadow-camera-far={75}
        shadow-normalBias={0.035} shadow-bias={-0.0002} />
      <StaticShadows preset={preset} enabled={shadows} />
      <GridWorld map={island.map} water={preset === "night" ? NIGHT_WATER : WATER} />
      <GridOcean map={island.map} />
      <GLBProp url="/assets/acnh/props/bridge-wooden.glb" position={[0, -0.065, 0.5]} rotation={[0, Math.PI / 2, 0]} />
      <group position={[0, 0, 7]}><ACNHBuilding id="hq" windowGlow={preset === "night" ? 1.4 : preset === "evening" ? 0.8 : 0} /></group>
      {ISLAND_PROPS.map((prop, i) => <GLBProp key={`prop-${i}`} url={`/assets/acnh/props/${prop.model}.glb`}
        position={[prop.x, island.ground(prop.x, prop.z), prop.z]} scale={prop.scale} rotation={[0, prop.yaw, 0]} />)}
      {ISLAND_TREES.map(([x, z], i) => <NatureTree key={`tree-${i}`} position={[x, island.ground(x, z), z]} seed={TREE_SEEDS[i]} />)}
      {ISLAND_BUSHES.map(([x, z], i) => <NatureBush key={`bush-${i}`} position={[x, island.ground(x, z), z]} seed={i} />)}
      {ISLAND_FLOWERS.map(([x, z], i) => <NatureFlowerCluster key={`flower-${i}`} position={[x, island.ground(x, z), z]} seed={i * 2} />)}
      <NPC key={`npc-${reset}`} persona={DEFAULT_NPC_PERSONAS[0]} position={[-2, 0, -7]} playerPositionRef={player}
        groundHeight={island.ground} constrainMove={island.move}
        onClick={() => window.dispatchEvent(new CustomEvent("tsi:npc-greet", { detail: { id: DEFAULT_NPC_PERSONAS[0].id } }))} />
      <PlayerAvatar key={reset} spawnPosition={DEFAULT_SPAWN} playerName="You" onMove={move}
        groundHeight={island.ground} groundSurface={island.surface} constrainMove={island.move} />
    </>
  );
}

const WALK_OFFSET = new THREE.Vector3(0, 13, -18);
const OVERVIEW_OFFSET = new THREE.Vector3(12, 21, -27);

function LoadingStatus() {
  const { active, progress, errors } = useProgress();
  if (errors.length) return <div className={styles.loading} role="alert">An island asset could not load.<button className={styles.return} onClick={() => window.location.reload()}>Reload island</button></div>;
  if (!active) return null;
  return <div className={styles.loading} role="status">Preparing the island · {Math.round(progress)}%</div>;
}

export default function DefaultIslandWorld() {
  return <GameSceneBoundary><DefaultIslandWorldContent /></GameSceneBoundary>;
}

function DefaultIslandWorldContent() {
  const [graphics, actions] = useGraphicsSettings();
  const [preset, setPreset] = useState<LightPreset>("day");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [effects, setEffects] = useState(true);
  const [overview, setOverview] = useState(false);
  const [reset, setReset] = useState(0);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  return (
    <main className={styles.world} data-light={preset}>
      <Canvas tabIndex={0} role="application" aria-label="Island walking area" style={{ zIndex: 0, imageRendering: graphics.pixelated ? "pixelated" : "auto" }} gl={{ antialias: false, powerPreference: "high-performance" }} dpr={graphics.pixelated ? 0.5 : [1, 2]}
        camera={{ position: [0, 13, -28], fov: 48, near: 0.1, far: 120 }} shadows="soft"
        onCreated={({ gl }) => { gl.info.autoReset = false; gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
        <Suspense fallback={null}>
          <IslandScene preset={preset} overview={overview} shadows={graphics.shadows && !graphics.liteMode} reset={reset} onMetrics={setMetrics} />
          <PostFX enabled={effects && !graphics.liteMode} bloom={graphics.bloom} grade={GRADE} />
        </Suspense>
      </Canvas>
      <header className={styles.heading}>
        <h1>Tethos Island</h1>
        <p>A little space to make our own.</p>
      </header>
      <button className={styles.panelToggle} aria-expanded={optionsOpen} aria-controls="island-options" onClick={() => setOptionsOpen((open) => !open)}>View options</button>
      <section id="island-options" className={styles.panel} data-open={optionsOpen} aria-label="Island view and graphics">
        <div className={styles.views} aria-label="Camera view">
          <button aria-pressed={!overview} onClick={() => setOverview(false)}>Walk</button>
          <button aria-pressed={overview} onClick={() => setOverview(true)}>Overview</button>
        </div>
        <label className={styles.toggle}>
          <span>Pixel filter</span>
          <input type="checkbox" checked={graphics.pixelated} onChange={(e) => actions.setPixelated(e.target.checked)} />
        </label>
        <p className={styles.hint}>The world stays the same. Choose its finish.</p>
        <label className={styles.preset}>
          <span>Light</span>
          <select value={preset} onChange={(e) => setPreset(e.target.value as LightPreset)}>
            {Object.entries(LIGHTING).map(([key, value]) => <option key={key} value={key}>{value.name}</option>)}
          </select>
        </label>
        <button className={styles.return} onClick={() => { setReset((n) => n + 1); setOverview(false); }}>Return to clearing</button>
        <details className={styles.performance}>
          <summary>Performance</summary>
          <output>{metrics ? `${metrics.fps} FPS · ${metrics.frameMs.toFixed(1)} ms/frame\n${metrics.calls} draws · ${metrics.triangles.toLocaleString()} triangles\nPosition ${metrics.x.toFixed(1)}, ${metrics.z.toFixed(1)}` : "Measuring…"}</output>
          <label className={styles.toggle}><span>Colour grading</span><input type="checkbox" checked={effects} onChange={(e) => setEffects(e.target.checked)} /></label>
          <label className={styles.toggle}><span>Shadows</span><input type="checkbox" checked={graphics.shadows} onChange={(e) => actions.setShadows(e.target.checked)} /></label>
          <small>Local frame timing; includes development overhead.</small>
        </details>
      </section>
      <div className={styles.controls}><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Walk</span><span><kbd>Shift</kbd> Run</span><span><kbd>Space</kbd> Hop</span></div>
      <p className={styles.touchControls}>Tap the ground to move</p>
      <LoadingStatus />
    </main>
  );
}
