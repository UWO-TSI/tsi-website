"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, useGLTF, useProgress, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";
import GridWorld from "@/components/game/grid/GridWorld";
import GridOcean from "@/components/game/grid/GridOcean";
import PlayerAvatar from "@/components/game/PlayerAvatar";
import ApplicantCharacter from "./ApplicantCharacter";
import Seagulls from "@/components/game/Seagulls";
import FishingBobber from "@/components/game/FishingBobber";
import FishCatchFX from "@/components/game/FishCatchFX";
import FlowerPickFX from "@/components/game/FlowerPickFX";
import ToolFlourish from "@/components/game/ToolFlourish";
import { WarmupProbe } from "@/components/game/LoadGate";
import { startIntroSweep } from "@/lib/game/introSweep";
import { WATER_DROP } from "@/lib/game/grid";
import type { ApplicantDayPhase } from "@/lib/game/applicantTime";
import HQInterior, { type InteriorStation } from "@/components/game/HQInterior";
import PostFX from "@/components/game/PostFX";
import { ACNHBuilding } from "@/components/game/ACNHBuilding";
import { GLBProp, NatureTree, NatureBush, NatureFlowerCluster, NatureFence } from "@/components/game/NatureModels";
import { createApplicantVillage, constrainApplicantHQ, APPLICANT_SPAWN, ISLAND_TREES, ISLAND_BUSHES, ISLAND_FLOWERS, ISLAND_PROPS, HQ_CLOCK, HQ_LAYOUT, HQ_BOARD_APPROACH } from "@/lib/game/applicantVillage";
import type { Position } from "@/lib/recruitment";
import ApplicationCountdown from "./ApplicationCountdown";
import { APPLICANT_LIGHTING, APPLICANT_HQ_LIGHTING, APPLICANT_TERRAIN } from "@/lib/game/applicantLighting";
import { applyEnvironment, disposeEnvironment } from "@/lib/game/envLight";
import { CloudShadows } from "@/components/game/AmbienceFX";
import { Lantern } from "@/components/game/AmbientProps";
import BlobShadows from "@/components/game/BlobShadows";
import { Fireflies } from "@/components/game/AmbientLife";
import "@/lib/game/aerialFog";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { isGameControlTarget } from "@/lib/game/keyboardInput";

export type VillageAction = "guide" | "enter" | "board" | "clock" | "exit" | "fish" | "flower" | null;
const STATIONS: InteriorStation[] = [
  { id: "board", name: "Recruitment board", pos: HQ_BOARD_APPROACH, action: "board", range: 2.3 },
  { id: "clock", name: "Application countdown", pos: [HQ_CLOCK[0], HQ_CLOCK[2] - 0.8], action: "clock", range: 1.8 },
  { id: "exit", name: "Village", pos: [0, -5.5], action: "exit", range: 1.6 },
];
const TREE_SEEDS = [0, 3, 2, 5, 7, 8, 1, 3];
const ROOM_TEXTURES = ["/assets/acnh/road/mRoadWood_Alb.png", "/assets/acnh/icons/flower_rose.png", "/assets/acnh/icons/flower_cosmos.png", "/assets/acnh/icons/bug_common_butterfly.png"];
ROOM_TEXTURES.forEach(url => useTexture.preload(url));
const BOTANICAL_TEXTURES = ROOM_TEXTURES.slice(1);
useTexture.preload(BOTANICAL_TEXTURES);
useGLTF.preload("/assets/characters/applicant/jayden.gltf");
useGLTF.preload("/assets/characters/applicant/player.gltf");
useGLTF.preload("/assets/characters/applicant/player-female.gltf");
const GULL_ANCHORS: [number, number][] = [[-16, 0], [12, 10], [0, 16]];
const fishingWaterHeight = () => -WATER_DROP;
const RETURN_SPAWN: [number, number, number] = [0, 0, 5.4];
const GUIDE_SHADOW = [{ x: -2.6, y: 0, z: -6, rx: 0.55, rz: 0.55 }];

type Props = {
  phase: ApplicantDayPhase; countdownPositions: Position[]; nearClock: boolean;
  onFishingTarget: (target: [number, number] | null) => void; postings: { title: string; complete: boolean }[]; onSelectRole: (index: number) => void;
  guideToHQ: boolean; guideToBoard: boolean;
  loading: boolean; inside: boolean; returned: boolean; paused: boolean; hidden: boolean; fishing: boolean;
  arrival: boolean; onArrived: () => void; collectionScope: string;
  pickedFlowers: readonly number[]; onFlowerNear: (index: number | null) => void; onPickFlower: (index: number) => void;
  onAction: (action: VillageAction) => void; onNear: (action: VillageAction) => void;
  onReady: () => void; onFailure: () => void;
  onMetrics: (value: string) => void;
};

function refreshShadows(gl: THREE.WebGLRenderer) {
  gl.shadowMap.autoUpdate = false;
  gl.shadowMap.needsUpdate = true;
}

function SceneStatus({ onReady, onFailure, inside, phase }: Pick<Props, "onReady" | "onFailure" | "inside" | "phase">) {
  const { gl } = useThree();
  const [graphics] = useGraphicsSettings();
  const wasLoading = useRef(false);
  useEffect(() => {
    refreshShadows(gl);
  }, [gl, inside, phase, graphics.shadows, graphics.liteMode]);
  useFrame(() => {
    const status = useProgress.getState();
    if (wasLoading.current && !status.active) refreshShadows(gl);
    wasLoading.current = status.active;
    if (status.errors.length) onFailure();
  });
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onFailure(); };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl, onFailure]);
  return <WarmupProbe onReady={onReady} />;
}

function DirectionArrow({ player, target, paused }: { player: React.RefObject<THREE.Vector3>; target: [number, number]; paused: boolean }) {
  const arrow = useRef<THREE.Group>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const shape = useMemo(() => new THREE.Shape([
    new THREE.Vector2(-0.16, -0.5), new THREE.Vector2(0.16, -0.5),
    new THREE.Vector2(0.16, 0.1), new THREE.Vector2(0.42, 0.1),
    new THREE.Vector2(0, 0.62), new THREE.Vector2(-0.42, 0.1),
    new THREE.Vector2(-0.16, 0.1),
  ]), []);
  useFrame((_, dt) => {
    if (!arrow.current || !material.current) return;
    const dx = target[0] - player.current.x, dz = target[1] - player.current.z;
    const distance = Math.hypot(dx, dz);
    const opacity = paused ? 0 : THREE.MathUtils.smoothstep(distance, 1.4, 3.5) * 0.3;
    material.current.opacity = THREE.MathUtils.lerp(material.current.opacity, opacity, 1 - Math.exp(-dt * 10));
    arrow.current.visible = material.current.opacity > 0.005;
    const ahead = Math.min(1.8, distance);
    arrow.current.position.set(player.current.x + dx / (distance || 1) * ahead, 0.045, player.current.z + dz / (distance || 1) * ahead);
    arrow.current.rotation.y = Math.atan2(dx, dz);
  });
  return <group ref={arrow} scale={0.58}>
    <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={2} raycast={() => {}}>
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial ref={material} color="#fff6d6" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  </group>;
}

function Village({ guideToHQ, returned, paused, onAction, onNear, phase, fishing, arrival, onArrived, pickedFlowers, onFlowerNear, onPickFlower, collectionScope, onFishingTarget }: Props) {
  const island = useMemo(() => createApplicantVillage(), []);
  const plantShadows = useMemo(() => [
    ...ISLAND_BUSHES.map(([x, z]) => ({ x, z, y: island.ground(x, z), rx: 0.5, rz: 0.4 })),
    ...ISLAND_FLOWERS.flatMap(([x, z], i) => pickedFlowers.includes(i) ? [] : [{ x, z, y: island.ground(x, z), rx: 0.58, rz: 0.32 }]),
  ], [island, pickedFlowers]);
  const spawn = returned ? RETURN_SPAWN : APPLICANT_SPAWN;
  const player = useRef(new THREE.Vector3(...spawn));
  const guideMotion = useRef({ speed: 0, yaw: Math.PI, lift: 0 });
  const lighting = APPLICANT_LIGHTING[phase];
  const [graphics] = useGraphicsSettings();
  const guide = useRef(new THREE.Vector3(-2.6, 0, -6));
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const near = useRef<VillageAction>(null);
  const zoom = useRef(1);
  const nearestFlower = useRef<number | null>(null);
  const sweep = useRef({ active: false, smoothTime: 2.6, position: new THREE.Vector3(), target: new THREE.Vector3(), look: new THREE.Vector3() });
  const { camera, gl, scene } = useThree();
  useEffect(() => {
    applyEnvironment(gl, scene, phase === "evening" ? "dusk" : phase, lighting.environment);
    return () => disposeEnvironment(scene);
  }, [gl, scene, phase, lighting]);
  const move = useCallback((position: THREE.Vector3) => { player.current.copy(position); }, []);
  useEffect(() => {
    camera.position.set(spawn[0], 7.4, spawn[2] - 10.8);
    const wheel = (event: WheelEvent) => { event.preventDefault(); zoom.current = THREE.MathUtils.clamp(zoom.current + event.deltaY * 0.0005, 0.94, 1.08); };
    const canvas = gl.domElement;
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  }, [camera, gl, spawn]);
  useEffect(() => {
    if (!arrival || paused) return;
    const route = sweep.current;
    const adapter = {
      get smoothTime() { return route.smoothTime; },
      set smoothTime(value: number) { route.smoothTime = value; },
      setLookAt(x: number, y: number, z: number, tx: number, ty: number, tz: number, transition: boolean) {
        route.position.set(x, y, z); route.target.set(tx, ty, tz);
        if (!transition) { camera.position.copy(route.position); route.look.copy(route.target); camera.lookAt(route.look); }
      },
    };
    let mounted = true;
    const stop = startIntroSweep(adapter, active => { route.active = active; if (!active && mounted) onArrived(); }, () => {}, window, {
      start: [spawn[0] - 4, 36, spawn[2] - 2, spawn[0], 0, spawn[2] + 2],
      end: [spawn[0], 8.1, spawn[2] - 9.3, spawn[0], 0.7, spawn[2] + 1.5],
    });
    return () => { mounted = false; stop(); };
  }, [arrival, paused, camera, onArrived, spawn]);
  useFrame((_, dt) => {
    if (sweep.current.active) {
      const route = sweep.current;
      const blend = 1 - Math.exp(-Math.min(dt, 0.1) * 3 / route.smoothTime);
      camera.position.lerp(route.position, blend); route.look.lerp(route.target, blend); camera.lookAt(route.look);
      return;
    }
    look.set(player.current.x, player.current.y + 0.7, player.current.z + 1.5);
    cameraTarget.set(look.x, look.y + 7.4 * zoom.current, look.z - 10.8 * zoom.current);
    camera.position.lerp(cameraTarget, 1 - Math.exp(-Math.min(dt, 0.1) * 5));
    camera.lookAt(look);
    let flower: number | null = null, flowerDistance = 1.9;
    ISLAND_FLOWERS.forEach(([x, z], i) => {
      const distance = Math.hypot(x - player.current.x, z - player.current.z);
      if (!pickedFlowers.includes(i) && distance < flowerDistance) { flower = i; flowerDistance = distance; }
    });
    if (nearestFlower.current !== flower) { nearestFlower.current = flower; onFlowerNear(flower); }
    const waterTarget = island.fishingTarget(player.current.x, player.current.z);
    onFishingTarget(waterTarget);
    const next: VillageAction = Math.hypot(player.current.x, player.current.z - 6.3) < 2 ? "enter"
      : waterTarget !== null ? "fish"
      : player.current.distanceTo(guide.current) < 3.2 ? "guide" : flower !== null ? "flower" : null;
    if (near.current !== next) { near.current = next; onNear(next); }
  }, -2);
  return <>
    <color attach="background" args={[lighting.sky]} />
    <fog attach="fog" args={[lighting.sky, lighting.fogNear, lighting.fogFar]} />
    <ambientLight intensity={lighting.ambient} color={lighting.fill} />
    <hemisphereLight args={[lighting.fill, lighting.bounce, lighting.hemisphere]} />
    <directionalLight position={lighting.sunPosition} color={lighting.sun} intensity={lighting.sunIntensity} castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-24} shadow-camera-right={24}
      shadow-camera-top={24} shadow-camera-bottom={-24} shadow-camera-far={75}
      shadow-radius={3} shadow-intensity={0.85} shadow-normalBias={0.02} shadow-bias={-0.0002} />
    <GridWorld map={island.map} water={lighting.water} palette={APPLICANT_TERRAIN} />
    <GridOcean map={island.map} />
    <BlobShadows placements={GUIDE_SHADOW} opacity={0.5} />
    <BlobShadows placements={plantShadows} opacity={0.16} />
    {!graphics.liteMode && <CloudShadows phase={phase === "evening" ? "dusk" : phase} size={[28, 25]} bounded />}
    <Seagulls anchors={GULL_ANCHORS} />
    <FishingBobber towardWater playerPosRef={player} waterHeight={fishingWaterHeight} />
    <FishCatchFX playerPosRef={player} />
    <ToolFlourish playerPosRef={player} />
    <FlowerPickFX collectionScope={collectionScope} />
    <group position={[0, 0, 7]}><ACNHBuilding id="hq" windowColor="#ffc95a" windowGlow={phase === "day" ? 0.3 : phase === "evening" ? 1.15 : 1.6} /></group>
    {phase !== "day" && <Fireflies anchors={ISLAND_BUSHES} count={graphics.liteMode ? 8 : ISLAND_BUSHES.length} groundHeight={island.ground} />}
    {[-2, 2].map(x => <pointLight key={x} position={[x, 1.25, 5.7]} color="#ffd17a" intensity={phase === "day" ? 0 : lighting.lamp * 0.85} distance={4} decay={2} />)}
    <Html position={[0, 1.4, 6.3]} center distanceFactor={18} zIndexRange={[3, 0]}>
      <div className="destination-cue"><span>Step inside TSI HQ</span><b>↓</b></div>
    </Html>
    {ISLAND_PROPS.map((p, i) => <GLBProp key={i} url={`/assets/acnh/props/${p.model}.glb`} position={[p.x, island.ground(p.x, p.z), p.z]} scale={p.scale} rotation={[0, p.yaw, 0]} />)}
    {ISLAND_TREES.map(([x, z], i) => <NatureTree key={i} position={[x, island.ground(x, z), z]} seed={TREE_SEEDS[i % TREE_SEEDS.length]} />)}
    {ISLAND_BUSHES.map(([x, z], i) => <NatureBush key={i} position={[x, island.ground(x, z), z]} seed={i} />)}
    {ISLAND_FLOWERS.map(([x, z], i) => !pickedFlowers.includes(i) && <group key={i} onClick={e => { e.stopPropagation(); if (!paused && !fishing && !arrival && Math.hypot(player.current.x - x, player.current.z - z) < 1.9) onPickFlower(i); }}><NatureFlowerCluster position={[x, island.ground(x, z), z]} seed={i * 2} /></group>)}
    {[-8, -6.8, -5.6].map(x => <NatureFence key={x} position={[x, 0, -8.8]} />)}
    <GLBProp url="/assets/acnh/props/park-clock.glb" position={[-4.8, 0, 4]} rotation={[0, Math.PI, 0]} />
    <Lantern position={[3.8, 0, 4.6]} intensity={phase === "day" ? 0 : lighting.lamp * 1.5} glow={phase === "day" ? 0 : 1.2} />
    <pointLight position={[0, 1.6, 5.6]} color="#ffd68b" intensity={lighting.lamp * 1.5} distance={5.5} />
    <group position={[-2.6, 0.018, -6]} onClick={e => { e.stopPropagation(); if (!paused && player.current.distanceTo(guide.current) < 3.2) onAction("guide"); }}>
      <ApplicantCharacter guide motion={guideMotion} frozen={paused} />
      <Html position={[0, 2.2, 0]} center distanceFactor={13} zIndexRange={[3, 0]}><span className="village-sign">Jayden · Your guide</span></Html>
    </group>
    <PlayerAvatar avatarMode="applicant" spawnPosition={spawn} playerName="You" showNameplate={false} onMove={move} frozen={paused || fishing || arrival} desktopClickToMove
      groundHeight={island.ground} groundSurface={island.surface} constrainMove={island.move} />
    <DirectionArrow player={player} target={[0, 6.3]} paused={paused || fishing || arrival || !guideToHQ} />
  </>;
}

function BoardPosting({ title, complete, index, onOpen, disabled }: { title: string; complete: boolean; index: number; onOpen: () => void; disabled: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const hovered = useRef(false);
  const reducedMotion = useReducedMotion();
  const { gl } = useThree();
  const cursorBefore = useRef<string | null>(null);
  const hover = (active: boolean) => {
    hovered.current = active && !disabled;
    if (hovered.current) {
      if (cursorBefore.current === null) cursorBefore.current = gl.domElement.style.cursor;
      gl.domElement.style.setProperty("cursor", "pointer");
    } else if (cursorBefore.current !== null) {
      gl.domElement.style.setProperty("cursor", cursorBefore.current);
      cursorBefore.current = null;
    }
  };
  useEffect(() => {
    if (disabled) hovered.current = false;
    return () => {
      if (cursorBefore.current !== null) gl.domElement.style.setProperty("cursor", cursorBefore.current);
      cursorBefore.current = null;
    };
  }, [disabled, gl]);
  useFrame((_, dt) => {
    const active = hovered.current && !disabled;
    if (mesh.current) mesh.current.scale.setScalar(THREE.MathUtils.lerp(mesh.current.scale.x, active && !reducedMotion ? 1.025 : 1, 1 - Math.exp(-dt * 16)));
    if (material.current) material.current.emissiveIntensity = active ? 0.14 : complete ? 0.18 : 0;
  });
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 300;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = complete ? "#e0efcc" : ["#fff3d6", "#e4edcf", "#f5ded0", "#dce8e9"][index % 4]; ctx.fillRect(0, 0, 512, 300);
    ctx.fillStyle = "#bd7350"; ctx.beginPath(); ctx.arc(256, 18, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#243e50"; ctx.textAlign = "center"; ctx.font = "bold 36px sans-serif";
    const words = title.split(" "); ctx.fillText(words[0], 256, 125); ctx.fillText(words.slice(1).join(" "), 256, 175);
    ctx.font = "20px sans-serif"; ctx.fillText(complete ? "✓  COMPLETE" : "TETHOS · JOIN THE TEAM", 256, 254);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; return tex;
  }, [title, complete, index]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh ref={mesh} onPointerOver={() => hover(true)} onPointerOut={() => hover(false)} position={[HQ_LAYOUT.board.position[0] + (index % 2 === 0 ? 0.7 : -0.7), HQ_LAYOUT.board.position[1] + 0.925 + (index < 2 ? 0.3875 : -0.3875), HQ_LAYOUT.board.position[2] - 0.1125]} rotation={[0, Math.PI, 0]} onClick={e => { e.stopPropagation(); hover(false); if (!disabled) onOpen(); }}>
    <planeGeometry args={[1.3, 0.7125]} /><meshStandardMaterial ref={material} map={texture} roughness={1} emissive={complete ? "#80af67" : "#d4b778"} emissiveIntensity={0.18} />
  </mesh>;
}

function BotanicalFrames() {
  const textures = useTexture(BOTANICAL_TEXTURES);
  return <>{textures.slice(0, 2).map((texture, i) => <group key={i} scale={0.8} position={[[4.1, 5.55][i], 2.65, 5.87]} rotation={[0, Math.PI, 0]}>
    <mesh><boxGeometry args={[1.1, 1.25, 0.12]} /><meshStandardMaterial color="#765234" roughness={1} /></mesh>
    <mesh position={[0, 0, 0.07]}><planeGeometry args={[0.9, 1.05]} /><meshStandardMaterial color="#f4e8cd" roughness={1} /></mesh>
    <mesh position={[0, 0, 0.08]}><planeGeometry args={[0.65, 0.7]} /><meshBasicMaterial map={texture} transparent /></mesh>
  </group>)}</>;
}

function Interior({ guideToBoard, paused, onNear, onSelectRole, postings, phase, countdownPositions, nearClock }: Props) {
  const wood = useTexture("/assets/acnh/interior/hq-parquet-albedo.png");
  const floor = useMemo(() => {
    const tex = wood.clone(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 0.75);
    tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true; return tex;
  }, [wood]);
  useEffect(() => () => floor.dispose(), [floor]);
  const player = useRef(new THREE.Vector3(0, 0, -4.2));
  const { camera } = useThree();
  useEffect(() => { camera.position.set(0, 8.4, -11.4); onNear("exit"); }, [camera, onNear]);
  const station = useCallback((s: InteriorStation | null) => onNear(s?.id === "board" ? "board" : s?.id === "clock" ? "clock" : s?.id === "exit" ? "exit" : null), [onNear]);
  return <>
    <HQInterior avatarMode="applicant" recruitment phase={phase} floorTexture={floor} frozen={paused} playerPosRef={player} onNearestStation={station} stations={STATIONS} constrainMove={constrainApplicantHQ} />
    <DirectionArrow player={player} target={HQ_BOARD_APPROACH} paused={paused || !guideToBoard} />
    <BotanicalFrames />
    {nearClock && !paused && <Html position={[HQ_CLOCK[0], 3.6, HQ_CLOCK[2] - 0.3]} center zIndexRange={[8, 0]} style={{ pointerEvents: "none" }}><ApplicationCountdown positions={countdownPositions} /></Html>}
    {postings.slice(0, 4).map((posting, index) => <BoardPosting key={posting.title} {...posting} index={index} disabled={paused} onOpen={() => { if (!paused) onSelectRole(index); }} />)}
    {guideToBoard && !paused && <Html position={[HQ_LAYOUT.board.position[0], 3.6, 5.55]} center distanceFactor={15} zIndexRange={[3, 0]}>
      <div className="destination-cue"><span>Hiring board · Choose a posting</span></div>
    </Html>}
  </>;
}

function Performance({ onMetrics }: Pick<Props, "onMetrics">) {
  const samples = useRef({ time: 0, frames: 0 });
  useFrame(({ gl }, dt) => {
    const calls = gl.info.render.calls;
    gl.info.reset();
    samples.current.time += dt; samples.current.frames++;
    if (samples.current.time > 2) {
      onMetrics(`${Math.round(samples.current.frames / samples.current.time)} FPS · ${calls} draws`);
      samples.current = { time: 0, frames: 0 };
    }
  }, -100);
  return null;
}

export default function ApplicantWorld(props: Props) {
  const [graphics] = useGraphicsSettings();
  useEffect(() => {
    const focus = () => { if (!isGameControlTarget(document.activeElement)) document.querySelector<HTMLElement>('[role="application"]')?.focus(); };
    window.addEventListener("pointerup", focus);
    return () => window.removeEventListener("pointerup", focus);
  }, []);
  return <Canvas tabIndex={0} role="application" aria-label="Tethos applicant village. WASD or click the ground to walk. E to interact."
    frameloop={props.hidden ? "never" : props.paused && !props.loading ? "demand" : "always"} dpr={graphics.pixelated ? 0.5 : [1, 1.5]} shadows={graphics.shadows && !graphics.liteMode ? "percentage" : false}
    style={{ imageRendering: graphics.pixelated ? "pixelated" : "auto" }}
    gl={{ antialias: false, powerPreference: "high-performance" }} camera={{ position: [0, 10.2, -21], fov: 48, near: 0.1, far: 100 }}
    onCreated={({ gl }) => { gl.info.autoReset = false; gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
    <Suspense fallback={null}>
      {props.inside ? <Interior {...props} /> : <Village {...props} />}
      <PostFX enabled={!graphics.liteMode} antialias={!graphics.pixelated} bloom={graphics.bloom} bloomIntensity={0.22} grade={props.inside ? APPLICANT_HQ_LIGHTING[props.phase].grade : APPLICANT_LIGHTING[props.phase].grade} />
      <SceneStatus onReady={props.onReady} onFailure={props.onFailure} inside={props.inside} phase={props.phase} />
      <Performance onMetrics={props.onMetrics} />
    </Suspense>
  </Canvas>;
}
