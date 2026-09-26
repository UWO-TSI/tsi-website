"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, useProgress, useTexture } from "@react-three/drei";
import * as THREE from "three";
import GridWorld from "./grid/GridWorld";
import GridOcean from "./grid/GridOcean";
import PlayerAvatar from "./PlayerAvatar";
import NPC from "./NPC";
import { DEFAULT_NPC_PERSONAS } from "@/data/content-defaults";
import GameSceneBoundary from "./GameSceneBoundary";
import PostFX from "./PostFX";
import HQInterior from "./HQInterior";
import BlobShadows from "./BlobShadows";
import { Lantern } from "./AmbientProps";
import { GLBProp, NatureTree, NatureBush, NatureFlowerCluster } from "./NatureModels";
import { ACNHBuilding, ACNHParts, CHALET_VARIANTS } from "./ACNHBuilding";
import { NatureFence } from "./NatureModels";
import WharfPier from "./WharfPier";
import MiniMap from "./MiniMap";
import { useDefaultIslandPlot } from "./DefaultIslandMap";
import { LettersSheet, NoticeSheet, JournalSheet } from "./progressionSheets";
import { useProgressionWorld, useCeremony, useChapterActions, monumentStage, type WorldGoalId } from "@/lib/game/progressionBridge";
import confetti from "canvas-confetti";
import type { InteriorStation } from "./interiorShared";
import { POND, ISLAND_RADII, createDefaultIsland, DEFAULT_SPAWN, ISLAND_TREES, ISLAND_BUSHES, ISLAND_FLOWERS, ISLAND_PROPS, LANDMARKS, landmark, benchSeat, BENCH_SEAT_TOP, type Landmark } from "@/lib/game/defaultIsland";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { ISLAND_LIGHTING, CLUBHOUSE_LIGHTING, ISLAND_TERRAIN, withWeather, withSeason, type IslandLight } from "@/lib/game/islandLighting";
import { paletteBySeason, seasonLook, SEASON_TREES, SEASON_BUSHES, SEASON_FLOWERS, type SeasonLook } from "@/lib/game/seasonalLook";
import { useSeasonPalettes } from "@/lib/content/loader";
import type { IslandWeather } from "@/lib/game/islandWeather";
import { useIslandConditions } from "@/lib/game/useIslandConditions";
import { IslandAtmosphere, useFollowCamera } from "./IslandAtmosphere";
import PeacefulLayer, { peacefulNear } from "./peaceful/PeacefulLayer";
import WardrobeSheet from "./peaceful/WardrobeSheet";
import PlayerCharacterUI from "./character/PlayerCharacterUI";
import CharacterCrowd from "./character/CharacterCrowd";
import OracleTemple from "./oracle/OracleTemple";
import RuinsScene from "./combat/RuinsScene";
import CombatHud from "./combat/CombatHud";
import MissionBoardSheet from "./combat/MissionBoardSheet";
import { attachProgressId, combat, publishCombat, setMission } from "@/lib/game/combat/runtime";
import { missionEvent } from "@/lib/game/combat/actions";
import { combatProgression, postWear, startMissionRemote } from "@/lib/game/combat/progression";
import { MISSIONS, WEAPONS } from "@/lib/game/combat/data";
import { startMission } from "@/lib/game/combat/missions";
import OracleQuizSheet from "./oracle/OracleQuizSheet";
import SettingsSheet from "./oracle/SettingsSheet";
import FamilyAura from "./oracle/FamilyAura";
import { FAMILIES } from "@/lib/game/oracle/family";
import type { Family } from "@/lib/oracle/engine";
import type { ResultView } from "@/lib/oracle/service";
import { keyLabel, setFamily, useWorldIdentity, type WorldIdentity } from "@/lib/game/identity";
import { actionForKey } from "@/lib/identity/settings";
import MuseumInterior from "./peaceful/MuseumInterior";
import DonateSheet from "./peaceful/DonateSheet";
import { ShowcaseSheet, TrophySheet } from "./peaceful/ShowcaseSheets";
import type { MuseumWing } from "@/lib/collections/logic";
import FishingOverlay from "./FishingOverlay";
import ToastHub from "./ToastHub";
import CollectionBook from "./CollectionBook";
import { usePeacefulContext } from "@/lib/game/usePeacefulContext";
import { villageNodes } from "@/lib/game/islandNodes";
import { villageWaterType, type FishingSpot } from "@/lib/game/fishingSpots";
import { getPeacefulTarget } from "@/lib/game/peacefulNear";
import type { WorldMoment } from "@/lib/collections/logic";
import HomeIslandScene, { type HomeNear } from "./home/HomeIslandScene";
import HomeInterior, { nearestBed, roomAt, type HouseNear } from "./home/HomeInterior";
import DecorateSheet from "./home/DecorateSheet";
import { useDecorate } from "./home/useDecorate";
import { useHomeLayout } from "@/lib/homes/useHomeLayout";
import { catalogueItem } from "@/lib/homes/catalogue";
import { ROOM_PRICE } from "@/lib/homes/layout";
import { PROBE_FRAMES, PROBE_WARMUP, medianFrameMs, tierForFrameMs, type QualityTier } from "@/lib/game/qualityTier";
import { ISLAND_PHASES, type IslandPhase } from "@/lib/game/islandTime";
import { HQ_CLOCK, HQ_LAYOUT, HQ_BOARD_APPROACH } from "@/lib/game/clubhouse";
import CraftingSheet, { BeachBottle, Workbench, constrainWorkshop } from "./crafting/Workshop";
import StudySeats from "./study/StudySeats";
import StudyHud from "./study/StudyHud";
import CafeInterior from "./study/CafeInterior";
import { studyHoldsPrompt } from "@/lib/study/worldStore";
import "@/lib/game/aerialFog";
import styles from "./DefaultIslandWorld.module.css";

type Metrics = { fps: number; frameMs: number; calls: number; triangles: number; x: number; z: number };
type Near = "enter" | "exit" | "board" | "display" | "desk" | "shelf" | "clock" | "notice" | "catch" | "cafe" | "museum" | "ruins" | "mailbox" | "monument" | "home" | "house" | "village" | "buy" | "claim" | "donate" | "report" | "fish" | "forage" | "net" | "museum_enter" | "cafe_enter" | "curator" | "closet" | "fitting" | "oracle_enter" | "altar" | "missions" | "ruins_exit" | "lantern" | "bench" | "bed" | null;
type Sheet = "notice" | "catch" | "letters" | "journal" | "trophies" | "showcase" | "closet" | "fitting" | "oracle" | "settings" | "missions" | null;
const PHASE_NAMES: Record<IslandPhase, string> = { dawn: "Dawn", day: "Daylight", evening: "Evening", night: "Night" };
const TREE_SEEDS = [0, 3, 2, 5, 7, 8, 1, 3];
const HQ_DOOR: [number, number] = [0, 6.3];
/** Oracle temple steps (landmark front at z 7.3) and where you come back out. */
const ORACLE_DOOR: [number, number] = [-11, 6.8];
const ORACLE_SPAWN: [number, number, number] = [-11, 0, 5.9];
const RETURN_SPAWN: [number, number, number] = [0, 0, 5.4];
const CLUBHOUSE_STATIONS: InteriorStation[] = [
  { id: "board", name: "Notice board", pos: HQ_BOARD_APPROACH, action: "board", range: 2.3 },
  { id: "display", name: "Trophy display", pos: [HQ_LAYOUT.display.position[0], 4.2], action: "display", range: 1.8 },
  { id: "desk", name: "Front desk", pos: [HQ_LAYOUT.desk.position[0], HQ_LAYOUT.desk.position[2] + 1.4], action: "desk", range: 1.8 },
  { id: "shelf", name: "Bookshelf", pos: [6.6, HQ_LAYOUT.shelf.position[2]], action: "shelf", range: 1.6 },
  { id: "clock", name: "Clock", pos: [HQ_CLOCK[0], HQ_CLOCK[2] - 0.8], action: "clock", range: 1.8 },
  { id: "exit", name: "Island", pos: [0, -5.5], action: "exit", range: 1.6 },
];
const NEAR_LABELS: Record<Exclude<Near, null>, string> = {
  enter: "Enter the clubhouse", exit: "Return to the island", board: "Read the notice board",
  display: "Look at the trophy case", desk: "Front desk · profile showcase", shelf: "Browse the bookshelf", clock: "Check the clock",
  notice: "Read the notice board", catch: "Check the catch board", mailbox: "Check the mailbox", monument: "Club monument",
  museum_enter: "Enter the museum", cafe_enter: "Enter the café", curator: "Talk to the curator", closet: "Open the closet", fitting: "Try on outfits", oracle_enter: "Enter the Oracle temple", altar: "Consult the crystal",
  home: "Take the boat home", fish: "Cast your line", forage: "Gather", net: "Swing the net", claim: "Claim your plot", donate: "Donate your first catch to the museum", report: "Report to HQ", house: "Enter your house", village: "Take the boat to the village",
  buy: `Add a room · ${ROOM_PRICE.coins} coins + ${ROOM_PRICE.materials}`,
  cafe: "Café · Opening soon", museum: "Museum · Closed for now", ruins: "Enter the ruins", missions: "Read the mission board", ruins_exit: "Back to the village", lantern: "Pick up the old lantern",
  bench: "Sit on the bench", bed: "Sleep in your bed",
};
const CLOSED: Near[] = ["cafe", "museum", "monument"];
/** The village bench in reach as a `tsi:sit` detail: IslandScene writes it each frame, E sits (or stands) there. */
const benchSpot: { current: { x: number; z: number; yaw: number; seatY: number } | null } = { current: null };
/** Wharf stub end: the boat home (specs/homes.md §1). */
const WHARF_BOAT: [number, number] = [8, -22];
const WHARF_SPAWN: [number, number, number] = [8, 0, -18.4];
const MUSEUM_SPAWN: [number, number, number] = [11, 0, 6.6];
const CAFE_SPAWN: [number, number, number] = [-10, 0, -8.9];
/** Fitting room beside the shop (screen-right of its door). */
const FITTING_ROOM: [number, number] = [5.6, -5.4];
/** Ruins mission board beside the cliff gate, and where you come back out (combat-foundation.md §6). */
const MISSION_BOARD: [number, number] = [15.4, -5.6];
const RUINS_EXIT_SPAWN: [number, number, number] = [15.6, 0, -2.5];
/** Distance from a point to a landmark's footprint edge. */
const footprintDistance = (l: Landmark, x: number, z: number) => Math.hypot(Math.max(0, Math.abs(x - l.x) - (l.half?.[0] ?? 0)), Math.max(0, Math.abs(z - l.z) - (l.half?.[1] ?? 0)));
const PROMPT_LANDMARKS = LANDMARKS.filter(l => ["notice", "catch", "cafe", "museum", "ruins", "mailbox", "monument"].includes(l.id));
const SIGNS: Partial<Record<Landmark["id"], string>> = { cafe: "Café · Opening soon", museum: "Museum · Closed", ruins: "Ruins gate", notice: "Notices", catch: "Catch board", shop: "Shop", oracle: "Oracle temple" };
const BOTANICAL_TEXTURES = ["/assets/acnh/icons/flower_rose.png", "/assets/acnh/icons/flower_cosmos.png"];
useTexture.preload(BOTANICAL_TEXTURES);
useTexture.preload("/assets/acnh/interior/hq-parquet-albedo.png");

function refreshStaticShadows(gl: THREE.WebGLRenderer) {
  gl.shadowMap.autoUpdate = false;
  gl.shadowMap.needsUpdate = true;
}

/** Cached shadow map: refresh after scene, phase, quality or late asset changes. */
function StaticShadows({ phase, enabled, inside }: { phase: IslandPhase; enabled: boolean; inside: boolean }) {
  const { gl } = useThree();
  const wasLoading = useRef(false);
  useEffect(() => { refreshStaticShadows(gl); }, [gl, phase, enabled, inside]);
  useFrame(() => {
    const { active } = useProgress.getState();
    if (wasLoading.current && !active) refreshStaticShadows(gl);
    wasLoading.current = active;
  });
  return null;
}

/** First-frame timing probe: once assets settle, pick Light or High for this device. */
function QualityProbe({ onTier }: { onTier: (tier: QualityTier) => void }) {
  const samples = useRef<number[]>([]);
  const done = useRef(false);
  useFrame((_, delta) => {
    if (done.current || useProgress.getState().active) { if (!done.current) samples.current = []; return; }
    samples.current.push(delta * 1000);
    if (samples.current.length < PROBE_WARMUP + PROBE_FRAMES) return;
    done.current = true;
    onTier(tierForFrameMs(medianFrameMs(samples.current.slice(PROBE_WARMUP))));
  });
  return null;
}

const VILLAGE_NODES = villageNodes();
const VILLAGE_WATER = villageWaterType(ISLAND_RADII, POND);
const VILLAGE_OVERVIEW = { focus: [0, 0, 0] as [number, number, number], offset: [12, 21, -27] as [number, number, number] };
const PUDDLE_SPOTS: [number, number][] = [[0.3, -12.5], [-0.4, -7.2], [0.5, -4.4], [-2.8, 3.1], [2.1, 4.2], [-6.5, -9.4], [6.8, -9.6], [9.5, -2.6], [-0.2, -15]];

function Performance({ player, onMetrics }: { player: React.RefObject<THREE.Vector3>; onMetrics: (metrics: Metrics) => void }) {
  const samples = useRef({ seconds: 0, frames: 0 });
  useFrame(({ gl }, delta) => {
    const calls = gl.info.render.calls, triangles = gl.info.render.triangles;
    gl.info.reset();
    samples.current.seconds += delta;
    samples.current.frames++;
    if (samples.current.seconds >= 1) {
      onMetrics({ fps: Math.round(samples.current.frames / samples.current.seconds), frameMs: samples.current.seconds * 1000 / samples.current.frames,
        calls, triangles, x: player.current.x, z: player.current.z });
      samples.current = { seconds: 0, frames: 0 };
    }
  }, -100);
  return null;
}

function IslandScene({ identity, devAt, exitFrom, peaceful, fishSpot, fishing, chapter, phase, light, look, weather, overview, zoom, reset, returned, fromBoat, liteMode, castShadows, player, onMove, onNear, progression, ceremony }: {
  progression: { stage: number; opened: readonly WorldGoalId[] }; ceremony: boolean; fromBoat: boolean;
  chapter: { claim: boolean; donate: boolean; report: boolean };
  peaceful: { moment: WorldMoment; member: string }; fishSpot: { current: FishingSpot | null }; fishing: boolean; exitFrom: "museum" | "oracle" | "ruins" | "cafe" | null; devAt: [number, number, number] | null; identity: WorldIdentity;
  phase: IslandPhase; light: IslandLight; look: SeasonLook; weather: IslandWeather; overview: boolean; zoom: number; reset: number; returned: boolean; liteMode: boolean; castShadows: boolean;
  player: React.RefObject<THREE.Vector3>; onMove: (position: THREE.Vector3) => void; onNear: (near: Near) => void;
}) {
  const island = useMemo(() => createDefaultIsland(), []);
  const spawn = devAt && !returned && !fromBoat && !exitFrom ? devAt : fromBoat ? WHARF_SPAWN : exitFrom === "museum" ? MUSEUM_SPAWN : exitFrom === "cafe" ? CAFE_SPAWN : exitFrom === "oracle" ? ORACLE_SPAWN : exitFrom === "ruins" ? RUINS_EXIT_SPAWN : returned ? RETURN_SPAWN : DEFAULT_SPAWN;
  const winterBare = SEASON_FLOWERS[look.season].length === 0;
  const plantShadows = useMemo(() => [
    ...ISLAND_BUSHES.map(([x, z]) => ({ x, z, y: island.ground(x, z), rx: 0.5, rz: 0.4 })),
    ...(winterBare ? [] : ISLAND_FLOWERS.map(([x, z]) => ({ x, z, y: island.ground(x, z), rx: 0.58, rz: 0.32 }))),
  ], [island, winterBare]);
  // Light tier has no shadow map: trees, props and the clubhouse sit on blobs instead.
  const solidShadows = useMemo(() => [
    ...ISLAND_TREES.map(([x, z]) => ({ x, z, y: island.ground(x, z), rx: 1.4, rz: 1.2 })),
    ...ISLAND_PROPS.map(p => ({ x: p.x, z: p.z, y: island.ground(p.x, p.z), rx: p.halfWidth * p.scale + 0.3, rz: p.halfDepth * p.scale + 0.3 })),
    ...LANDMARKS.filter(l => l.half).map(l => ({ x: l.x, z: l.z, y: island.ground(l.x, l.z), rx: l.half![0] + 0.7, rz: l.half![1] + 0.7 })),
  ], [island]);
  const terrain = useMemo(() => ({ ...ISLAND_TERRAIN, grass: look.grass }), [look.grass]);
  const near = useRef<Near>(null);
  useEffect(() => { player.current.set(...spawn); }, [reset, spawn, player]);
  useFollowCamera(player, zoom, overview ? VILLAGE_OVERVIEW : null);
  useFrame(() => {
    // Chapter 1 at the clubhouse door: claim the plot first, report back when ready, otherwise enter.
    let next: Near = Math.hypot(player.current.x - HQ_DOOR[0], player.current.z - HQ_DOOR[1]) < 2 ? (chapter.claim ? "claim" : chapter.report ? "report" : "enter")
      : Math.hypot(player.current.x - WHARF_BOAT[0], player.current.z - WHARF_BOAT[1]) < 1.6 ? "home"
      : Math.hypot(player.current.x - FITTING_ROOM[0], player.current.z - FITTING_ROOM[1]) < 1.5 ? "fitting"
      : Math.hypot(player.current.x - ORACLE_DOOR[0], player.current.z - ORACLE_DOOR[1]) < 1.6 ? "oracle_enter"
      : Math.hypot(player.current.x - MISSION_BOARD[0], player.current.z - MISSION_BOARD[1]) < 1.5 ? "missions" : null;
    const b = benchSeat(player.current.x, player.current.z);
    benchSpot.current = b && { ...b, seatY: island.ground(b.x, b.z) + BENCH_SEAT_TOP };
    if (!next && benchSpot.current) next = "bench";
    if (!next) {
      let best = 1.4;
      for (const l of PROMPT_LANDMARKS) {
        // An opened goal building (boards off) no longer shows its closed prompt.
        const opened = progression.opened.includes(l.id as WorldGoalId);
        if (opened && l.id !== "museum" && l.id !== "cafe") continue;
        const d = footprintDistance(l, player.current.x, player.current.z);
        if (opened && d < best) { best = d; next = l.id === "cafe" ? "cafe_enter" : "museum_enter"; continue; }
        if (d < best) { best = d; next = l.id === "museum" && chapter.donate ? "donate" : l.id as Near; }
      }
    }
    if (!next && !fishing && !studyHoldsPrompt()) next = peacefulNear(island.map, VILLAGE_WATER, player.current.x, player.current.z, fishSpot);
    if (near.current !== next) { near.current = next; onNear(next); }
  }, -2);
  return (
    <>
      <IslandAtmosphere phase={phase} light={light} look={look} weather={weather} liteMode={liteMode} castShadows={castShadows} overview={overview}
        player={player} ground={island.ground} puddles={PUDDLE_SPOTS} cloudSize={[46, 38]} fireflyAnchors={ISLAND_BUSHES} />
      <GridWorld map={island.map} water={light.water} palette={terrain} windScale={liteMode ? 0 : weather === "wind" ? 2.2 : 1} />
      <GridOcean map={island.map} />
      <PeacefulLayer map={island.map} nodes={VILLAGE_NODES} moment={peaceful.moment} member={peaceful.member} player={player} ground={island.ground} highTier={!liteMode} active={!fishing} />
      <BeachBottle player={player} ground={island.ground} />
      <BlobShadows placements={plantShadows} opacity={0.16} />
      {!castShadows && <BlobShadows placements={solidShadows} opacity={0.45} />}
      <StudySeats area="village" player={player} ground={island.ground} />
      <VillageLandmarks ground={island.ground} opened={progression.opened} stage={progression.stage} ceremony={ceremony} />
      <GLBProp url="/assets/acnh/props/bridge-wooden.glb" position={[0, -0.065, 0.5]} rotation={[0, Math.PI / 2, 0]} />
      <group position={[0, 0, 7]}><ACNHBuilding id="hq" windowColor="#ffc95a" windowGlow={light.windowGlow} /></group>
      {[-2, 2].map(x => <pointLight key={x} position={[x, 1.25, 5.7]} color="#ffd17a" intensity={light.lampsOn ? light.lamp * 0.85 : 0} distance={4} decay={2} />)}
      <pointLight position={[0, 1.6, 5.6]} color="#ffd68b" intensity={light.lamp * 1.5} distance={5.5} />
      <Lantern position={[4.6, 0, 2.4]} intensity={light.lampsOn ? light.lamp * 1.5 : 0} glow={light.lampsOn ? 1.2 : 0} />
      {ISLAND_PROPS.map((prop, i) => <GLBProp key={`prop-${i}`} url={`/assets/acnh/props/${prop.model}.glb`}
        position={[prop.x, island.ground(prop.x, prop.z), prop.z]} scale={prop.scale} rotation={[0, prop.yaw, 0]} />)}
      {ISLAND_TREES.map(([x, z], i) => <NatureTree key={`tree-${i}`} position={[x, island.ground(x, z), z]} seed={TREE_SEEDS[i % TREE_SEEDS.length]} models={SEASON_TREES[look.season]} />)}
      {ISLAND_BUSHES.map(([x, z], i) => <NatureBush key={`bush-${i}`} position={[x, island.ground(x, z), z]} seed={i} models={SEASON_BUSHES[look.season]} />)}
      {SEASON_FLOWERS[look.season].length > 0 && ISLAND_FLOWERS.map(([x, z], i) => <NatureFlowerCluster key={`flower-${i}`} position={[x, island.ground(x, z), z]} seed={i * 2} models={SEASON_FLOWERS[look.season]} />)}
      {/* Residents (placeholders): during a ceremony they stroll to the monument and cheer. */}
      {RESIDENTS.map(({ persona, home, plaza }) => <NPC key={`npc-${persona.id}-${reset}`} persona={persona} position={ceremony ? plaza : home} playerPositionRef={player}
        groundHeight={island.ground} constrainMove={island.move}
        onClick={() => window.dispatchEvent(new CustomEvent("tsi:npc-greet", { detail: { id: persona.id } }))} />)}
      <PlayerAvatar key={`${reset}-${returned}-${fromBoat}-${exitFrom}`} spawnPosition={spawn} playerName={identity.display_name} member={identity.member} onMove={onMove} frozen={fishing}
        groundHeight={island.ground} groundSurface={island.surface} constrainMove={island.move} />
      <CharacterCrowd player={player} ground={island.ground} />
    </>
  );
}

const RESIDENTS = [
  { persona: DEFAULT_NPC_PERSONAS[0], home: [-2, 0, -7] as [number, number, number], plaza: [-3.3, 0, 2.3] as [number, number, number] },
  { persona: DEFAULT_NPC_PERSONAS[1], home: [9, 0, -9.6] as [number, number, number], plaza: [-6.6, 0, 1.9] as [number, number, number] },
].filter(r => r.persona);

const F = "/assets/acnh/furniture/";
/**
 * Club monument (row 182): five build stages from dump furniture, no new
 * modelling. 0 roped-off plot + construction sign; 1 scaffold + materials;
 * 2 rock monument rises inside the scaffold; 3 banners go up; 4 complete
 * (scaffold, sign and ropes gone, lanterns lit).
 */
function ClubMonument({ position, stage, ceremony }: { position: [number, number, number]; stage: number; ceremony: boolean }) {
  const done = stage >= 4;
  return <group position={position}>
    {!done && <>
      <GLBProp url={`${F}monument-sign.glb`} position={[1.3, 0, -1.25]} scale={0.1} rotation={[0, -0.3, 0]} />
      {[[-1.1, -1.1, 0], [1.1, -1.1, 0], [-1.1, 1.1, Math.PI], [1.1, 1.1, Math.PI]].map(([x, z, r], i) => (
        <GLBProp key={i} url="/assets/acnh/props/fence-rope-a.glb" position={[x, 0, z]} rotation={[0, r, 0]} castShadow={false} />
      ))}
    </>}
    {stage >= 1 && !done && <>
      {/* The tarp comes down once the stone is going up (stage 2+). */}
      <GLBProp url={`${F}monument-scaffold.glb`} position={[0, 0, 0.1]} scale={0.1} hideMaterial={stage >= 2 ? "mReFabric" : undefined} />
      <GLBProp url={`${F}cardboard-pile.glb`} position={[-1.5, 0, -0.9]} scale={0.1} rotation={[0, 0.6, 0]} />
    </>}
    {stage >= 2 && <GLBProp url={`${F}monument-rock.glb`} position={[0, 0, 0]} scale={done ? 0.16 : 0.13} />}
    {stage >= 3 && [-1.05, 1.05].map(x => <GLBProp key={x} url={`${F}monument-banner.glb`} position={[x, 0, 0.45]} scale={0.1} />)}
    {done && [-1.2, 1.2].map(x => <GLBProp key={x} url="/assets/acnh/props/stone-lantern.glb" position={[x, 0, -1]} />)}
    {done && <pointLight position={[0, 1.6, -1]} color="#ffe2a8" intensity={ceremony ? 5 : 2} distance={5} />}
  </group>;
}

/** Ceremony confetti: the recruitment portal's canvas-confetti, on a DOM overlay. */
function CeremonyConfetti({ active }: { active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active || !canvas.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const burst = confetti.create(canvas.current, { resize: true, useWorker: false });
    const colors = ["#ffd166", "#80af67", "#f5a9c4", "#6fb3d9"];
    const fire = () => {
      void burst({ particleCount: 70, spread: 80, origin: { x: 0.35, y: 0.55 }, colors });
      void burst({ particleCount: 70, spread: 80, origin: { x: 0.65, y: 0.55 }, colors });
    };
    fire();
    const timers = [1500, 3000].map(ms => window.setTimeout(fire, ms));
    return () => { timers.forEach(window.clearTimeout); burst.reset(); };
  }, [active]);
  return <canvas ref={canvas} aria-hidden="true" className={styles.confetti} />;
}

/** Residents cheer at the ceremony: a greeting hop every 0.7 s while it lasts. */
function useCheer(active: boolean, ids: string[]) {
  const key = ids.join(",");
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => key.split(",").forEach(id => window.dispatchEvent(new CustomEvent("tsi:npc-greet", { detail: { id } }))), 700);
    return () => window.clearInterval(timer);
  }, [active, key]);
}

/** Row-155 village core: open buildings, boarded closed landmarks with signs, boards, wharf stub. */
function VillageLandmarks({ ground, opened, stage, ceremony }: { ground: (x: number, z: number) => number; opened: readonly WorldGoalId[]; stage: number; ceremony: boolean }) {
  const at = (id: Landmark["id"], dy = 0): [number, number, number] => { const l = landmark(id); return [l.x, ground(l.x, l.z) + dy, l.z]; };
  const front = (id: Landmark["id"]) => { const l = landmark(id); return l.z - (l.half?.[1] ?? 0); };
  const cafe = landmark("cafe"), museum = landmark("museum"), ruins = landmark("ruins");
  return <>
    <group position={at("shop")}><ACNHBuilding id="shop" /></group>
    <GLBProp url="/assets/acnh/furniture/fitting-room.glb" position={[FITTING_ROOM[0], ground(FITTING_ROOM[0], FITTING_ROOM[1]), FITTING_ROOM[1] + 0.45]} scale={0.1} rotation={[0, Math.PI, 0]} />
    <group position={at("oracle")}><ACNHBuilding id="oracle" /></group>
    <group position={at("cafe")}><ACNHParts parts={CHALET_VARIANTS.yellow} rotationY={Math.PI} /></group>
    <group position={at("museum")}><ACNHParts parts={CHALET_VARIANTS.red} rotationY={Math.PI} /></group>
    {/* Boarded doors: the existing log fence across each closed entrance. */}
    {[cafe, museum].filter(l => !opened.includes(l.id as WorldGoalId)).map(l => [-0.6, 0.6].map(dx => <NatureFence key={`${l.id}${dx}`} position={[l.x + dx, ground(l.x, l.z), front(l.id) - 0.35]} variant={1} />))}
    {[-1.2, 0, 1.2].map(dz => <group key={dz} position={[ruins.x, ground(ruins.x, ruins.z + dz), ruins.z + dz]} rotation={[0, Math.PI / 2, 0]}><NatureFence position={[0, 0, 0]} variant={1} /></group>)}
    {[-1.9, 1.9].map(dz => <GLBProp key={dz} url="/assets/acnh/props/stone-lantern.glb" position={[ruins.x, ground(ruins.x, ruins.z + dz), ruins.z + dz]} />)}
    <ClubMonument position={at("monument")} stage={stage} ceremony={ceremony} />
    <GLBProp url="/assets/acnh/furniture/mailbox.glb" position={at("mailbox")} scale={0.1} />
    <GLBProp url="/assets/acnh/props/bulletin-board.glb" position={at("notice")} />
    <GLBProp url="/assets/acnh/props/bulletin-board.glb" position={at("catch")} />
    <GLBProp url="/assets/acnh/props/bulletin-board.glb" position={[MISSION_BOARD[0], ground(...MISSION_BOARD), MISSION_BOARD[1] + 0.3]} rotation={[0, -0.5, 0]} />
    {/* Existing wharf pier (authored at x 43.2-45.2, z 0.4-5) moved to the south beach. */}
    <group position={[landmark("wharf").x - 44.2, -0.12, -23.4]}><WharfPier /></group>
    {LANDMARKS.filter(l => SIGNS[l.id] && !opened.includes(l.id as WorldGoalId)).map(l => <Html key={l.id} position={[l.x, ground(l.x, l.z) + (l.half && l.half[0] > 1 ? 3.6 : 2.3), l.z - (l.half?.[1] ?? 0)]} center distanceFactor={10} zIndexRange={[3, 0]}>
      <div className={styles.cue} data-closed={!l.open}>{SIGNS[l.id]}</div>
    </Html>)}
  </>;
}

function BotanicalFrames() {
  const textures = useTexture(BOTANICAL_TEXTURES);
  return <>{textures.map((texture, i) => <group key={i} scale={0.8} position={[[4.1, 5.55][i], 2.65, 5.87]} rotation={[0, Math.PI, 0]}>
    <mesh><boxGeometry args={[1.1, 1.25, 0.12]} /><meshStandardMaterial color="#765234" roughness={1} /></mesh>
    <mesh position={[0, 0, 0.07]}><planeGeometry args={[0.9, 1.05]} /><meshStandardMaterial color="#f4e8cd" roughness={1} /></mesh>
    <mesh position={[0, 0, 0.08]}><planeGeometry args={[0.65, 0.7]} /><meshBasicMaterial map={texture} transparent /></mesh>
  </group>)}</>;
}

/** Clubhouse HQ interior as shipped on the applicant island (sage walls, lounge, pendants). */
function Clubhouse({ phase, player, frozen, onNear }: { phase: IslandPhase; player: React.RefObject<THREE.Vector3>; frozen: boolean; onNear: (near: Near) => void }) {
  const wood = useTexture("/assets/acnh/interior/hq-parquet-albedo.png");
  const floor = useMemo(() => {
    const tex = wood.clone(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 0.75);
    tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true; return tex;
  }, [wood]);
  useEffect(() => () => floor.dispose(), [floor]);
  const { camera } = useThree();
  useEffect(() => { player.current.set(0, 0, -4.2); camera.position.set(0, 8.4, -11.4); onNear("exit"); }, [camera, onNear, player]);
  const station = useCallback((s: InteriorStation | null) => onNear((s?.id as Near) ?? null), [onNear]);
  return <>
    <HQInterior clubhouse phase={phase} floorTexture={floor} frozen={frozen} playerPosRef={player} onNearestStation={station} stations={CLUBHOUSE_STATIONS} constrainMove={constrainWorkshop} />
    <BotanicalFrames />
    <Workbench player={player} />
  </>;
}

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
  const conditions = useIslandConditions();
  const { phase, forcedPhase: forced, setForcedPhase: setForced, weather, season } = conditions;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsToggleRef = useRef<HTMLButtonElement>(null);
  const [overview, setOverview] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [reset, setReset] = useState(0);
  // Dev: ?home=1 starts on the home island, ?home=inside in the house; ?decorate=1&place=<piece> opens decorating.
  const [devHome] = useState(() => (process.env.NODE_ENV !== "production" && typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams()));
  const [site, setSite] = useState<"village" | "home" | "ruins">(devHome.get("home") ? "home" : devHome.get("ruins") ? "ruins" : "village");
  const [inside, setInside] = useState<"hq" | "house" | "museum" | "oracle" | "cafe" | null>(devHome.get("home") === "inside" ? "house" : devHome.get("cafe") === "inside" ? "cafe" : devHome.get("museum") === "inside" ? "museum" : devHome.get("hq") === "inside" ? "hq" : devHome.get("temple") === "inside" ? "oracle" : null);
  const [layout, setLayout, , homeActions] = useHomeLayout();
  const decor = useDecorate(layout, setLayout, { on: devHome.get("decorate") === "1", piece: devHome.get("place") && catalogueItem(devHome.get("place")!) ? devHome.get("place") : null });
  const [returned, setReturned] = useState(false);
  const [fromBoat, setFromBoat] = useState(false);
  const [exitFrom, setExitFrom] = useState<"museum" | "oracle" | "ruins" | "cafe" | null>(null);
  const [ruinsRun, setRuinsRun] = useState(0);
  // Dev: ?mission=<id> accepts a board mission up front (screenshots).
  const [devMission] = useState(() => { const id = devHome.get("mission"); const def = MISSIONS.find(m => m.id === id); if (def) { setMission(startMission(def)); void startMissionRemote(def.id).then(r => { if (r.ok) attachProgressId(def.id, r.data.progress_id); }); } return !!def; });
  void devMission;
  // Defeat: wake at the gate (row 229); durability loss only (stub: 10% of the equipped weapon).
  const onRuinsDefeat = useCallback(() => {
    // Wear for the run plus the defeat's 10% (systems rule), reported once; local copy mirrors it.
    const p = combat.rt.player, w = p.weapon, max = WEAPONS[w].maxDurability;
    void postWear(w, p.hits[w], true);
    p.durability[w] = Math.max(0, p.durability[w] - Math.ceil(max * 0.1));
    p.hits[w] = 0;
    setRuinsRun(n => n + 1);
  }, []);
  const [gate, setGate] = useState<{ open: boolean; reason: string | null }>({ open: false, reason: "Checking the gate…" });
  // Dev: ?at=x,z starts the village walk at that spot (screenshots of shore/shop details).
  const [devAt] = useState<[number, number, number] | null>(() => { const v = devHome.get("at")?.split(",").map(Number); return v?.length === 2 && v.every(Number.isFinite) ? [v[0], 0, v[1]] : null; });
  const [donateOpen, setDonateOpen] = useState(false);
  const [museumWings, setMuseumWings] = useState<MuseumWing[] | null>(null);
  const loadMuseumRef = useRef(false);
  const loadMuseum = useCallback(() => { void fetch("/api/collections/museum").then(r => r.json()).then(b => { if (b?.ok) setMuseumWings(b.wings); }).catch(() => {}); }, []);
  const [fading, setFading] = useState(false);
  const [near, setNear] = useState<Near>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [mapOpen, setMapOpen] = useState(true);
  const plot = useDefaultIslandPlot();
  const progression = useProgressionWorld();
  const ceremony = useCeremony(progression.ceremonyGoal, progression.forceCeremony);
  const chapterActions = useChapterActions();
  const chapterFlags = useMemo(() => ({ claim: chapterActions.claim, donate: chapterActions.donate, report: chapterActions.report }),
    [chapterActions.claim, chapterActions.donate, chapterActions.report]);
  const [actionNote, setActionNote] = useState<string | null>(null);
  useEffect(() => { if (inside === "museum" && !loadMuseumRef.current) { loadMuseumRef.current = true; loadMuseum(); } if (inside !== "museum") loadMuseumRef.current = false; }, [inside, loadMuseum]);
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNowTick(Date.now()), 60_000); return () => window.clearInterval(t); }, []);
  const peaceful = usePeacefulContext(weather, nowTick);
  const [fishing, setFishing] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const identity = useWorldIdentity();
  const [reveal, setReveal] = useState<{ family: Family; type: string; startedAt: number } | null>(null);
  useEffect(() => { let alive = true; void combatProgression().then(g => {
    if (!alive) return;
    setGate({ open: g.gateOpen, reason: g.gateOpen ? null : /^Sealed/.test(g.reason ?? "") ? g.reason : `Sealed. ${g.reason ?? ""}`.trim() });
    // Progression feeds the encounter: stats, max HP, subclass signature, weapon durability.
    const p = combat.rt.player;
    p.armed = g.gateOpen;
    if (g.stats) p.stats = g.stats;
    p.level = g.level;
    if (g.maxHp) { p.maxHp = g.maxHp; p.hp = Math.min(p.hp, g.maxHp); }
    combat.rt.signature = g.signature;
    for (const w of g.weapons) if (w.weapon_key in p.durability) p.durability[w.weapon_key as keyof typeof p.durability] = w.durability;
    publishCombat();
  }); return () => { alive = false; }; }, [identity.family]);
  const onOracleResult = useCallback((result: ResultView) => {
    setFamily(result.family); setSheet(null);
    setReveal({ family: result.family, type: result.type, startedAt: performance.now() });
  }, []);
  const fishSpot = useRef<FishingSpot | null>(null);
  useCheer(ceremony, RESIDENTS.map(r => r.persona.id));
  const stage = progression.activeGoal ? monumentStage(progression.activeGoal.progress) : 0;
  const progressionWorld = useMemo(() => ({ stage, opened: progression.completedGoals }), [stage, progression.completedGoals]);
  const target = progression.objective.target;
  // Objective marker drawn in the minimap's mirrored world coordinates (+x on the left).
  const objectivePlot = useMemo(() => target ? { ...plot, content: <>{plot.content}
    <g className={styles.objectiveMarker}><circle cx={-target[0]} cy={-target[1]} r={1.9} fill="none" stroke="#e8704a" strokeWidth={0.6} />
      <path d={`M ${-target[0]} ${-target[1] - 2.9} l 1.3 -2.1 h -2.6 z`} fill="#e8704a" /></g></> } : plot, [plot, target]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const player = useRef(new THREE.Vector3(...DEFAULT_SPAWN));
  const move = useCallback((position: THREE.Vector3) => { player.current.copy(position); }, []);
  const [detectedTier, setDetectedTier] = useState<QualityTier | null>(null);
  const onTier = useCallback((tier: QualityTier) => {
    setDetectedTier(tier);
    actions.detect({ liteMode: tier === "light" });
  }, [actions]);
  const quality = actions.isExplicit("liteMode") ? (graphics.liteMode ? "light" : "high") : "auto";
  const [, rerender] = useState(0);
  const setQuality = (value: string) => {
    rerender(n => n + 1);
    if (value === "auto") actions.unset("liteMode");
    else { actions.setLiteMode(value === "light"); if (value === "high") actions.setShadows(true); }
  };
  const liteMode = graphics.liteMode;
  const castShadows = graphics.shadows && !liteMode;
  const seasonRows = useSeasonPalettes();
  const seasonKey = JSON.stringify(season.weights);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value: the blend object is rebuilt every render.
  const look = useMemo(() => seasonLook(season, paletteBySeason(seasonRows)), [seasonKey, seasonRows]);
  const light = useMemo(() => withWeather(withSeason(ISLAND_LIGHTING[phase], look), weather), [phase, look, weather]);
  const conditionsLabel = `${season.season[0].toUpperCase()}${season.season.slice(1)}${Object.values(season.weights).some(w => w > 0 && w < 1) ? " (changing)" : ""} · ${weather[0].toUpperCase()}${weather.slice(1)}`;
  const grade = inside ? CLUBHOUSE_LIGHTING[phase].grade : light.grade;
  const atHome = site === "home";
  const act = useCallback((action: Near) => {
    if (action === "notice" || action === "catch") { setSheet(action); return; }
    if (action === "mailbox") { setSheet("letters"); return; }
    if (action === "curator") { setDonateOpen(true); return; }
    if (action === "display") { setSheet("trophies"); return; }
    if (action === "desk") { setSheet("showcase"); return; }
    if (action === "closet" || action === "fitting") { setSheet(action); return; }
    if (action === "altar") { setReveal(null); setSheet("oracle"); return; }
    if (action === "missions") { setSheet("missions"); return; }
    if (action === "lantern") { combat.rt.idol = "carried"; missionEvent(combat.rt, { kind: "pickup", item: "old-lantern" }); publishCombat(); return; }
    if (action === "ruins" && !gate.open) { setActionNote(gate.reason); window.setTimeout(() => setActionNote(null), 3500); return; }
    if (action === "buy") {
      void homeActions.buyRoom(homeActions.roomPrice() ?? ROOM_PRICE.coins).then(result => {
        setActionNote(result.ok ? `A new room is ready. ${result.coins} coins left.` : /unauthori[sz]ed/i.test(result.error) ? "Sign in to add a room." : result.error);
        window.setTimeout(() => setActionNote(null), 3500);
      });
      return;
    }
    if (action === "fish") {
      const spot = fishSpot.current;
      if (spot) window.dispatchEvent(new CustomEvent("tsi:fish-start", { detail: { x: spot.target[0], z: spot.target[1], water: spot.water } }));
      return;
    }
    if (action === "forage" || action === "net") {
      const target = getPeacefulTarget();
      if (target) window.dispatchEvent(new CustomEvent("tsi:peaceful-act", { detail: { id: target.id } }));
      return;
    }
    // E again at the same bench or bed stands you up (tsi:sit toggles there).
    if (action === "bench") { if (benchSpot.current) window.dispatchEvent(new CustomEvent("tsi:sit", { detail: benchSpot.current })); return; }
    if (action === "bed") {
      const bed = nearestBed(layout, player.current.x, player.current.z);
      if (bed) window.dispatchEvent(new CustomEvent("tsi:sit", { detail: bed }));
      return;
    }
    if (action === "claim" || action === "donate" || action === "report") {
      const step = action === "claim" ? "claim_plot" : action === "donate" ? "donate_catch" : "report_hq";
      void chapterActions.run(step).then(error => {
        setActionNote(error ?? (action === "claim" ? "Plot claimed. Your island is waiting at the end of the pier." : action === "donate" ? "Donated. The museum shell has its first exhibit." : "Chapter complete: welcome to the island."));
        window.setTimeout(() => setActionNote(null), 3500);
      });
      return;
    }
    if (fading || !action || !["enter", "exit", "house", "home", "village", "museum_enter", "cafe_enter", "oracle_enter", "ruins", "ruins_exit"].includes(action)) return;
    setFading(true); setNear(null);
    window.setTimeout(() => {
      if (action === "enter") setInside("hq");
      if (action === "house") setInside("house");
      if (action === "museum_enter") setInside("museum");
      if (action === "cafe_enter") setInside("cafe");
      if (action === "exit") setExitFrom(inside === "museum" || inside === "oracle" || inside === "cafe" ? inside : null);
      if (action === "oracle_enter") setInside("oracle");
      if (action === "ruins") { setSite("ruins"); setInside(null); setRuinsRun(n => n + 1); }
      if (action === "ruins_exit") {
        setSite("village"); setExitFrom("ruins"); setReturned(true);
        const p = combat.rt.player;
        for (const w of Object.keys(p.hits) as (keyof typeof p.hits)[]) if (p.hits[w]) { void postWear(w, p.hits[w], false); p.hits[w] = 0; }
      }
      if (action === "exit") { setInside(null); setReturned(true); }
      if (action === "home" || action === "village") { setSite(action === "home" ? "home" : "village"); setInside(null); setReturned(false); setFromBoat(action === "village"); }
      if (action === "exit" || action === "enter") setFromBoat(false);
    }, 320);
    window.setTimeout(() => setFading(false), 900);
  }, [fading, chapterActions, homeActions, inside, gate, layout]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.repeat || (event.target instanceof HTMLElement && event.target.closest("input, select, textarea, button"))) return;
      if (event.key.toLowerCase() === "e") act(near);
      if (event.key.toLowerCase() === "z" && !inside) setZoomed(value => !value);
      // Menus follow the account's key bindings (row 220); Escape is fixed.
      const menu = actionForKey(identity.settings, event.key);
      if (menu === "openMap") setMapOpen(value => !value);
      // The collection journal is the bag (ACNH); quests keep J until the remap list has a quests action.
      if (menu === "openJournal" || menu === "openBag") setBagOpen(value => !value);
      if (!menu && event.key.toLowerCase() === "j") setSheet(value => (value === "journal" ? null : "journal"));
      if (menu === "openMail") setSheet(value => (value === "letters" ? null : "letters"));
      if (menu === "nextTab" || menu === "prevTab") window.dispatchEvent(new CustomEvent("tsi:menu-tab", { detail: { step: menu === "nextTab" ? 1 : -1 } }));
      if (event.key === "Escape") { setSheet(null); if (decor.selected) decor.cancel(); }
      if (atHome && event.key.toLowerCase() === "f") decor.toggle();
      if (decor.decorating && event.key.toLowerCase() === "r") decor.rotateSelected();
      if (decor.decorating && event.key.toLowerCase() === "x") decor.putAway();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [act, near, inside, atHome, decor, identity.settings]);
  return (
    <main className={styles.world} data-light={phase} data-inside={inside ?? undefined}>
      <Canvas tabIndex={0} role="application" aria-label="Island walking area" style={{ zIndex: 0, imageRendering: graphics.pixelated ? "pixelated" : "auto" }} gl={{ antialias: false, powerPreference: "high-performance" }} dpr={graphics.pixelated ? 0.5 : [1, 1.5]}
        camera={{ position: [0, 10.2, -21], fov: 48, near: 0.1, far: 120 }} shadows={castShadows ? "percentage" : false}
        onCreated={({ gl }) => { gl.info.autoReset = false; gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
        <Suspense fallback={null}>
          {site === "ruins" ? <RuinsScene key={`ruins-${ruinsRun}`} phase={phase} light={light} look={look} weather={weather} liteMode={liteMode} zoom={zoomed ? 1.4 : 1} player={player} onMove={move}
              onNear={n => setNear(n === "exit" ? "ruins_exit" : n)} onDefeat={onRuinsDefeat} start={ruinsRun <= 1 ? devAt : null} />
            : inside === "oracle" ? <OracleTemple frozen={fading || sheet === "oracle"} player={player} onNear={n => setNear(n)} ceremony={reveal} />
            : inside === "cafe" ? <CafeInterior phase={phase} player={player} frozen={fading || !!sheet} identity={identity} onMove={move} onNear={setNear} />
            : inside === "museum" ? <MuseumInterior wings={museumWings} frozen={fading || donateOpen} player={player} onNear={n => setNear(n === "donate" ? "curator" : n)} />
            : inside === "hq" ? <Clubhouse phase={phase} player={player} frozen={fading} onNear={setNear} />
            : inside === "house" ? <HomeInterior layout={layout} phase={phase} frozen={fading} player={player} onNear={(n: HouseNear) => setNear(n)}
              decorating={decor.decorating} selected={decor.selected} onPlace={decor.place} onPickUp={decor.pickUp} />
            : atHome ? <HomeIslandScene identity={identity} peaceful={peaceful} fishSpot={fishSpot} fishing={fishing} phase={phase} light={light} look={look} weather={weather} liteMode={liteMode} castShadows={castShadows} zoom={zoomed ? 1.4 : 1}
              overview={overview} returned={returned} player={player} onMove={move} onNear={(n: HomeNear) => setNear(n)} outdoor={layout.outdoor}
              decorating={decor.decorating} selected={decor.selected} onPlace={item => decor.place("outdoor", item)} onPickUp={item => decor.pickUp("outdoor", item)} />
            : <IslandScene identity={identity} devAt={devAt} exitFrom={exitFrom} peaceful={peaceful} fishSpot={fishSpot} fishing={fishing} chapter={chapterFlags} fromBoat={fromBoat} progression={progressionWorld} ceremony={ceremony} phase={phase} light={light} look={look} weather={weather} overview={overview} zoom={zoomed ? 1.4 : 1} reset={reset} returned={returned} liteMode={liteMode} castShadows={castShadows} player={player} onMove={move} onNear={setNear} />}
          {identity.family && identity.aura && <Suspense fallback={null}><FamilyAura player={player} color={FAMILIES[identity.family].light} /></Suspense>}
          <PostFX antialias={!graphics.liteMode && !graphics.pixelated} bloom={!graphics.liteMode && graphics.bloom} bloomIntensity={0.22} grade={grade} />
          <StaticShadows phase={phase} enabled={castShadows} inside={!!inside || atHome} />
          <Performance player={player} onMetrics={setMetrics} />
          <QualityProbe onTier={onTier} />
          {!inside && !atHome && site !== "ruins" && near !== "enter" && <Html position={[0, 2.9, 6.3]} center distanceFactor={10} zIndexRange={[3, 0]}>
            <div className={styles.cue}>Clubhouse</div>
          </Html>}
        </Suspense>
      </Canvas>
      <header className={styles.heading}>
        <h1>{site === "ruins" ? "The ruins" : inside === "oracle" ? "Oracle temple" : inside === "museum" ? "Museum" : inside === "cafe" ? "Café" : inside === "hq" ? "Clubhouse" : inside === "house" ? "Your house" : atHome ? "Your island" : "Tethos Island"}</h1>
        <p>A little space to make our own.</p>
      </header>
      <button ref={optionsToggleRef} className={styles.panelToggle} aria-expanded={optionsOpen} aria-controls="island-options" onClick={() => setOptionsOpen((open) => !open)}>View options</button>
      <section id="island-options" className={styles.panel} data-open={optionsOpen} aria-label="Island view and graphics" onKeyDown={(event) => {
        if (optionsOpen && event.key === "Escape" && optionsToggleRef.current?.getClientRects().length) {
          event.preventDefault();
          event.stopPropagation();
          setOptionsOpen(false);
          optionsToggleRef.current?.focus();
        }
      }}>
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
          <span>Time</span>
          <select value={forced ?? "live"} onChange={(e) => setForced(e.target.value === "live" ? null : e.target.value as IslandPhase)}>
            <option value="live">Toronto now · {PHASE_NAMES[conditions.livePhase]}</option>
            {ISLAND_PHASES.map((key) => <option key={key} value={key}>{PHASE_NAMES[key]}</option>)}
          </select>
        </label>
        <p className={styles.hint} data-testid="island-conditions">{conditionsLabel}{conditions.sunSource === "fallback" ? " · sun table" : ""}</p>
        <button className={styles.return} onClick={() => { setSheet("settings"); setOptionsOpen(false); }}>Settings · text, contrast, keys</button>
        <button className={styles.return} onClick={() => { setInside(null); setSite("village"); setReturned(false); setReset((n) => n + 1); setOverview(false); }}>Return to clearing</button>
        <details className={styles.performance}>
          <summary>Performance</summary>
          <output>{metrics ? `${metrics.fps} FPS · ${metrics.frameMs.toFixed(1)} ms/frame\n${metrics.calls} draws · ${metrics.triangles.toLocaleString()} triangles\nPosition ${metrics.x.toFixed(1)}, ${metrics.z.toFixed(1)}` : "Measuring…"}</output>
          <label className={styles.preset}>
            <span>Quality</span>
            <select value={quality} onChange={(e) => setQuality(e.target.value)} data-testid="quality">
              <option value="auto">Auto · {detectedTier ? (detectedTier === "light" ? "Light" : "High") : "measuring"}</option>
              <option value="light">Light</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className={styles.toggle}><span>Shadows</span><input type="checkbox" checked={graphics.shadows} onChange={(e) => actions.setShadows(e.target.checked)} /></label>
          <small>Local frame timing; includes development overhead.</small>
        </details>
      </section>
      {near && !sheet && !(reveal && inside === "oracle") && (CLOSED.includes(near)
        ? <p className={styles.interact} data-closed="true" role="status">{NEAR_LABELS[near]}</p>
        : fishing ? null : <button className={styles.interact} onClick={() => act(near)}><kbd>E</kbd>{(near === "forage" || near === "net") ? getPeacefulTarget()?.label ?? NEAR_LABELS[near] : NEAR_LABELS[near]}</button>)}
      <FishingOverlay rod={peaceful.rod} onActiveChange={setFishing} />
      <DonateSheet open={donateOpen} onClose={() => setDonateOpen(false)} onDonated={loadMuseum} />
      <ToastHub />
      <StudyHud />
      <CraftingSheet />
      <CollectionBook open={bagOpen} onClose={() => setBagOpen(false)} />
      {!bagOpen && <button className={styles.bagButton} onClick={() => setBagOpen(true)} aria-label="Open your collection journal"><kbd>{keyLabel(identity.settings.key_bindings.openJournal)}</kbd> Journal</button>}
      {mapOpen && !inside && !atHome && site !== "ruins" && <div className={styles.minimap} data-minimap>
        <MiniMap playerPosRef={player} plot={objectivePlot} onClose={() => setMapOpen(false)} />
        {progression.objective.text && <p className={styles.objective} data-testid="objective"><span aria-hidden="true">◆</span> {progression.objective.text}</p>}
      </div>}
      <CeremonyConfetti active={ceremony && !inside && !atHome} />
      {actionNote && <p className={styles.actionNote} role="status">{actionNote}</p>}
      {atHome && !decor.decorating && <button className={styles.decorateToggle} onClick={decor.toggle}><kbd>F</kbd> Decorate</button>}
      {atHome && decor.decorating && <DecorateSheet indoor={inside === "house"} selected={decor.selected}
        room={inside === "house" ? layout.rooms[roomAt(player.current.x, layout.rooms.length)] ?? null : null}
        onChoose={decor.choose} onRotate={decor.rotateSelected} onPutAway={decor.putAway} onDone={decor.toggle}
        onFinish={(key, value) => decor.setRoomFinish(roomAt(player.current.x, layout.rooms.length), key, value)} />}
      <NoticeSheet open={sheet === "notice"} onClose={() => setSheet(null)} />
      <LettersSheet open={sheet === "letters"} onClose={() => setSheet(null)} />
      {(sheet === "closet" || sheet === "fitting") && <WardrobeSheet open place={sheet === "closet" ? "closet" : "fitting"} onClose={() => setSheet(null)} />}
      <PlayerCharacterUI />
      <JournalSheet open={sheet === "journal"} onClose={() => setSheet(null)} />
      <OracleQuizSheet open={sheet === "oracle"} onClose={() => setSheet(null)} onResult={onOracleResult} />
      <SettingsSheet open={sheet === "settings"} onClose={() => setSheet(null)} />
      {reveal && inside === "oracle" && <section className={styles.reveal} role="status" style={{ ["--family" as string]: FAMILIES[reveal.family].color }} data-testid="oracle-reveal">
        <p className={styles.revealFamily}>{reveal.family}</p>
        <p>{FAMILIES[reveal.family].keeperLine}</p>
        <small>Aura unlocked · {reveal.type}</small>
        <button onClick={() => setReveal(null)}>Continue</button>
      </section>}
      <TrophySheet open={sheet === "trophies"} onClose={() => setSheet(null)} />
      <ShowcaseSheet open={sheet === "showcase"} onClose={() => setSheet(null)} />
      <MissionBoardSheet open={sheet === "missions"} onClose={() => setSheet(null)} gateNote={gate.open ? null : gate.reason} />
      {site === "ruins" && <CombatHud player={player} />}
      {sheet === "catch" && <section className={styles.sheet} role="dialog" aria-modal="false" aria-labelledby="island-sheet-title">
        <header><h2 id="island-sheet-title">Catch board</h2><button onClick={() => setSheet(null)} aria-label="Close">×</button></header>
        <p>Today&apos;s possible catches will appear here, with habitat, time and weather clues for the ones you haven&apos;t found yet.</p>
        <ul className={styles.silhouettes} aria-label="Undiscovered catches">{[0, 1, 2, 3].map(i => <li key={i} aria-label="Undiscovered">?</li>)}</ul>
        <small>Placeholder · village core milestone</small>
      </section>}
      {site === "ruins" ? <div className={styles.controls} data-combat><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</span><span>Mouse Aim</span><span>Click Attack</span><span><kbd>Space</kbd> Dodge</span><span><kbd>1</kbd>–<kbd>4</kbd> Abilities</span><span><kbd>E</kbd> Interact</span></div>
      : <div className={styles.controls}><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Walk</span><span><kbd>Shift</kbd> Run</span><span><kbd>Space</kbd> Hop</span><span><kbd>E</kbd> Interact</span><span><kbd>Z</kbd> Zoom</span><span><kbd>{keyLabel(identity.settings.key_bindings.openMap)}</kbd> Map</span><span><kbd>J</kbd> Quests</span><span><kbd>{keyLabel(identity.settings.key_bindings.openJournal)}</kbd> Collection</span><span><kbd>C</kbd> Sneak</span></div>}
      <p className={styles.touchControls}>Tap the ground to move</p>
      <div className={styles.fade} data-active={fading} aria-hidden="true" />
      <LoadingStatus />
    </main>
  );
}
