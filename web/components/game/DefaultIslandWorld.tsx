"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, useProgress, useTexture } from "@react-three/drei";
import * as THREE from "three";
import GridWorld from "./grid/GridWorld";
import GridOcean from "./grid/GridOcean";
import PlayerAvatar from "./PlayerAvatar";
import NPC from "./NPC";
import { residentSpots } from "@/lib/content/residents";
import GameSceneBoundary from "./GameSceneBoundary";
import PostFX from "./PostFX";
import HQInterior from "./HQInterior";
import SunShadows from "./SunShadows";
import { Lantern } from "./AmbientProps";
import { GLBProp, sceneryOf } from "./NatureModels";
import { InstancedModels } from "./InstancedNature";
import { ACNHBuilding, ACNHParts, CHALET_VARIANTS } from "./ACNHBuilding";
import { NatureFence } from "./NatureModels";
import WharfPier from "./WharfPier";
import { BASE_FOV } from "./movement/moveFx";
import MiniMap from "./MiniMap";
import { useDefaultIslandPlot } from "./DefaultIslandMap";
import LettersSheet from "@/components/progression/LettersSheet";
import NoticeSheet from "@/components/progression/NoticeSheet";
import JournalSheet from "@/components/progression/JournalSheet";
import { useProgressionWorld, useCeremony, useChapterActions, type WorldGoalId } from "@/lib/game/progressionBridge";
import confetti from "canvas-confetti";
import type { InteriorStation } from "./interiorShared";
import { villageIsland, villageSpawn, villageScale, landmarks, landmarkPoint, wharfDeck, benchSeat, BENCH_SEAT_TOP, type Landmark } from "@/lib/game/defaultIsland";
import { village, objectsOf, type Village } from "@/lib/game/villageMap";
import { LEVEL_STEP, levelAt, worldToCellX, worldToCellZ } from "@/lib/game/grid";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { CLUBHOUSE_LIGHTING, ISLAND_TERRAIN, islandLight, withWeather, withSeason, type IslandLight } from "@/lib/game/islandLighting";
import { paletteBySeason, seasonLook, type SeasonLook } from "@/lib/game/seasonalLook";
import { useNPCPersonas, useSeasonPalettes } from "@/lib/content/loader";
import type { IslandWeather } from "@/lib/game/islandWeather";
import { useIslandConditions } from "@/lib/game/useIslandConditions";
import { IslandAtmosphere, useFollowCamera, type TreeSpot } from "./IslandAtmosphere";
import PeacefulLayer, { peacefulNear } from "./peaceful/PeacefulLayer";
import WardrobeSheet from "./peaceful/WardrobeSheet";
import { ShopBody } from "@/components/economy/EconomySheets";
import ProgressionPanel from "@/components/progression/ProgressionPanel";
import { apiCall } from "@/lib/apiClient";
import PlayerCharacterUI from "./character/PlayerCharacterUI";
import CharacterCrowd from "./character/CharacterCrowd";
import OracleTemple from "./oracle/OracleTemple";
import RuinsScene from "./combat/RuinsScene";
import CombatHud from "./combat/CombatHud";
import MissionBoardSheet from "./combat/MissionBoardSheet";
import { attachProgressId, combat, publishCombat, setMission, setOwnedWeapons } from "@/lib/game/combat/runtime";
import { missionEvent } from "@/lib/game/combat/abilities";
import { combatProgression, postWear, startMissionRemote, type ProgressionView } from "@/lib/game/combat/progression";
import { equipKit } from "@/lib/game/combat/abilities";
import { subclassByKey } from "@/lib/combat/kits";
import PathSheet from "./oracle/PathSheet";
import { MISSIONS, WEAPONS } from "@/lib/game/combat/data";
import { startMission } from "@/lib/game/combat/missions";
import OracleQuizSheet from "./oracle/OracleQuizSheet";
import { FamilyReveal } from "./oracle/OracleSheetEmbed";
import SettingsSheet from "./oracle/SettingsSheet";
import FamilyAura from "./oracle/FamilyAura";
import { FAMILIES } from "@/lib/game/oracle/family";
import type { Family } from "@/lib/oracle/engine";
import type { ResultView } from "@/lib/oracle/service";
import { setFamily, useWorldIdentity, type WorldIdentity } from "@/lib/game/identity";
import { actionForKey } from "@/lib/identity/settings";
import { keyName, useMoveKeys } from "@/lib/game/movement/keys";
import { useCoarsePointer } from "@/lib/game/useMediaQuery";
import TouchControls from "./movement/TouchControls";
import MuseumInterior from "./peaceful/MuseumInterior";
import AudioController from "./AudioController";
import type { AmbientPhase } from "@/lib/game/audio";
import { useMusicDirector } from "@/lib/game/useAudio";
import DonateSheet from "./peaceful/DonateSheet";
import { ShowcaseSheet, TrophySheet } from "./peaceful/ShowcaseSheets";
import type { MuseumWing } from "@/lib/collections/logic";
import FishingOverlay from "./FishingOverlay";
import ToastHub from "./ToastHub";
import CollectionBook from "./CollectionBook";
import { usePeacefulContext } from "@/lib/game/usePeacefulContext";
import { villageNodes } from "@/lib/game/islandNodes";
import { villageWater, type FishingSpot } from "@/lib/game/fishingSpots";
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
import { CURRENT, lookFx, type LookPreset } from "@/lib/game/lookPreset";
import LookMaterials from "./LookMaterials";
import { EventDecor, eventSpots, PostersSheet, TourneySheet } from "./SeasonalEvents";
import { useIslandEvent, type IslandEvent } from "@/lib/game/seasonalEvents";
import styles from "./DefaultIslandWorld.module.css";

type Near = "enter" | "exit" | "board" | "display" | "desk" | "shelf" | "clock" | "notice" | "catch" | "cafe" | "museum" | "ruins" | "mailbox" | "monument" | "home" | "house" | "village" | "buy" | "claim" | "donate" | "report" | "fish" | "forage" | "net" | "museum_enter" | "cafe_enter" | "curator" | "closet" | "fitting" | "oracle_enter" | "altar" | "missions" | "ruins_exit" | "lantern" | "bench" | "bed" | "trophy" | "posters" | "cocoa" | "picnic" | null;
type Sheet = "notice" | "letters" | "journal" | "trophies" | "showcase" | "closet" | "fitting" | "oracle" | "path" | "settings" | "missions" | "tourney" | "posters" | null;
const PHASE_NAMES: Record<IslandPhase, string> = { dawn: "Dawn", day: "Daylight", evening: "Evening", night: "Night" };
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
  cafe: "Café · Opening soon", museum: "Museum · Closed for now", ruins: "Enter the ruins", missions: "Read the mission board", ruins_exit: "Back to the village", lantern: "Pick it up",
  bench: "Sit on the bench", bed: "Sleep in your bed",
  trophy: "Read the tourney board", posters: "Look at the GENESIS posters", cocoa: "Get a hot cocoa", picnic: "Join the picnic",
};
const CLOSED: Near[] = ["cafe", "museum", "monument"];
/** The village bench in reach as a `tsi:sit` detail: IslandScene writes it each frame, E sits (or stands) there. */
const benchSpot: { current: { x: number; z: number; yaw: number; seatY: number } | null } = { current: null };
/** Distance from a point to a landmark's footprint edge. */
const footprintDistance = (l: Landmark, x: number, z: number) => Math.hypot(Math.max(0, Math.abs(x - l.x) - (l.half?.[0] ?? 0)), Math.max(0, Math.abs(z - l.z) - (l.half?.[1] ?? 0)));
const PROMPT_IDS: readonly Landmark["id"][] = ["notice", "catch", "museum", "ruins", "mailbox", "monument"];
/** The café's prompt is its door's, open or boarded up (cafe-polish §2). */
const CAFE_DOOR_RANGE = 1.4;
type Spot = [number, number, number];
const spot = (p: [number, number] | null): Spot | null => p && [p[0], 0, p[1]];
const xz = (o: { x: number; z: number }): [number, number] => [o.x, o.z];

/**
 * The village as this scene uses it, all from the map file (specs/island-painter.md):
 * walking, objects, doors, spawns, nodes, water and the size-dependent settings.
 * Built once per loaded map; nothing here is placed relative to the local player.
 */
function villageLayout(v: Village) {
  const deck = wharfDeck(v);
  const fitting = objectsOf("fitting", v)[0], missions = objectsOf("missions", v)[0], marks = landmarks(v);
  return {
    island: villageIsland(v),
    landmarks: marks,
    trees: objectsOf("tree", v).map((o): TreeSpot => ({ x: o.x, z: o.z, seed: o.seed ?? 0 })),
    fireflies: objectsOf("bush", v).map(xz),
    puddles: objectsOf("puddle", v).map(xz),
    benches: objectsOf("bench", v),
    lamps: objectsOf("lamp", v),
    bridges: objectsOf("bridge", v).map(o => ({ ...o, y: levelAt(v.map, worldToCellX(v.map, o.x), worldToCellZ(v.map, o.z)) * LEVEL_STEP - 0.065 })),
    doors: { hq: landmarkPoint("hq", "door", v), oracle: landmarkPoint("oracle", "door", v), boat: landmarkPoint("wharf", "door", v), cafe: landmarkPoint("cafe", "door", v) },
    spawns: {
      start: villageSpawn(v), returned: spot(landmarkPoint("hq", "exit", v)), oracle: spot(landmarkPoint("oracle", "exit", v)),
      museum: spot(landmarkPoint("museum", "exit", v)), cafe: spot(landmarkPoint("cafe", "exit", v)), ruins: spot(landmarkPoint("ruins", "exit", v)), boat: spot(landmarkPoint("wharf", "exit", v)),
    },
    /** Fitting room beside the shop; ruins mission board beside the cliff gate (combat-foundation.md §6). */
    fitting: fitting ? xz(fitting) : null,
    missions: missions ? { at: xz(missions), yaw: missions.yaw ?? 0 } : null,
    prompts: marks.filter(l => PROMPT_IDS.includes(l.id)),
    nodes: villageNodes(v),
    water: villageWater(v).classify,
    scale: villageScale(v),
    /** No water glints under the wharf deck: it sits a few centimetres above the water and they would show through. */
    underWharf: (x: number, z: number) => !!deck && x > deck.x0 - 0.4 && x < deck.x1 + 0.4 && z > deck.z0 - 0.4 && z < deck.z1 + 0.4,
  };
}
const SIGNS: Partial<Record<Landmark["id"], string>> = { cafe: "Café · Opening soon", museum: "Museum · Closed", ruins: "Ruins gate", notice: "Notices", catch: "Catch board", shop: "Shop", oracle: "Oracle temple" };
const BOTANICAL_TEXTURES = ["/assets/acnh/icons/flower_rose.png", "/assets/acnh/icons/flower_cosmos.png"];
useTexture.preload(BOTANICAL_TEXTURES);
useTexture.preload("/assets/acnh/interior/hq-parquet-albedo.png");

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


/** Module scope: the react compiler forbids writing through a prop. */
const writeText = (el: HTMLElement | null, text: string) => { if (el) el.textContent = text; };

/** Once a second into the options' Performance readout, straight to the DOM: a 1 Hz setState re-rendered the whole island. */
function Performance({ player, output }: { player: React.RefObject<THREE.Vector3>; output: React.RefObject<HTMLOutputElement | null> }) {
  const samples = useRef({ seconds: 0, frames: 0 });
  useFrame(({ gl }, delta) => {
    const calls = gl.info.render.calls, triangles = gl.info.render.triangles;
    gl.info.reset();
    const s = samples.current;
    s.seconds += delta;
    s.frames++;
    if (s.seconds >= 1) {
      writeText(output.current, `${Math.round(s.frames / s.seconds)} FPS · ${(s.seconds * 1000 / s.frames).toFixed(1)} ms/frame\n${calls} draws · ${triangles.toLocaleString()} triangles\nPosition ${player.current.x.toFixed(1)}, ${player.current.z.toFixed(1)}`);
      s.seconds = 0; s.frames = 0;
    }
  }, -100);
  return null;
}

function IslandScene({ identity, level, devAt, exitFrom, peaceful, fishSpot, fishing, chapter, phase, light, look, weather, overview, zoom, reset, returned, fromBoat, liteMode, castShadows, player, onNear, progression, ceremony, event }: {
  progression: { stage: number; opened: readonly WorldGoalId[] }; ceremony: boolean; fromBoat: boolean; event: IslandEvent | null;
  chapter: { claim: boolean; donate: boolean; report: boolean };
  peaceful: { moment: WorldMoment; member: string; glider: boolean }; fishSpot: { current: FishingSpot | null }; fishing: boolean; exitFrom: "museum" | "oracle" | "ruins" | "cafe" | null; devAt: [number, number, number] | null; identity: WorldIdentity; level?: number;
  phase: IslandPhase; light: IslandLight; look: SeasonLook; weather: IslandWeather; overview: boolean; zoom: number; reset: number; returned: boolean; liteMode: boolean; castShadows: boolean;
  player: React.RefObject<THREE.Vector3>; onNear: (near: Near) => void;
}) {
  const v = village();
  const layout = useMemo(() => villageLayout(v), [v]);
  const { island, spawns, doors } = layout;
  const { data: personas } = useNPCPersonas({ permanentOnly: true });
  const residents = useMemo(() => residentSpots(personas, phase, v), [personas, phase, v]);
  const exitSpot = exitFrom === "museum" ? spawns.museum : exitFrom === "cafe" ? spawns.cafe : exitFrom === "oracle" ? spawns.oracle : exitFrom === "ruins" ? spawns.ruins : null;
  const spawn = (devAt && !returned && !fromBoat && !exitFrom ? devAt : fromBoat ? spawns.boat : exitSpot ?? (returned ? spawns.returned : null)) ?? spawns.start;
  const terrain = useMemo(() => ({ ...ISLAND_TERRAIN, grass: look.grass }), [look.grass]);
  const scenery = useMemo(() => sceneryOf(v, island.ground, look.season), [v, island, look.season]);
  const near = useRef<Near>(null);
  const spots = useMemo(() => eventSpots(event?.decor ?? null), [event]);
  useEffect(() => { player.current.set(...spawn); }, [reset, spawn, player]);
  const focus = useRef(new THREE.Vector3(...spawn));
  useFollowCamera(focus, zoom, overview ? layout.scale.overview : null);
  useFrame(() => {
    const within = (p: [number, number] | null, r: number) => !!p && Math.hypot(player.current.x - p[0], player.current.z - p[1]) < r;
    // Chapter 1 at the clubhouse door: claim the plot first, report back when ready, otherwise enter.
    let next: Near = within(doors.hq, 2) ? (chapter.claim ? "claim" : chapter.report ? "report" : "enter")
      : within(doors.boat, 1.6) ? "home"
      : within(layout.fitting, 1.5) ? "fitting"
      : within(doors.oracle, 1.6) ? "oracle_enter"
      : within(doors.cafe, CAFE_DOOR_RANGE) ? (progression.opened.includes("cafe") ? "cafe_enter" : "cafe")
      : within(layout.missions?.at ?? null, 1.5) ? "missions" : null;
    const b = benchSeat(player.current.x, player.current.z, 1.3, v, layout.benches);
    benchSpot.current = b && { ...b, seatY: island.ground(b.x, b.z) + BENCH_SEAT_TOP };
    // An event spot and a bench both in reach: the nearer one takes E.
    const ev = spots.find(s => within([s.x, s.z], s.range)), seat = benchSpot.current;
    const nearer = (p: { x: number; z: number }) => Math.hypot(player.current.x - p.x, player.current.z - p.z);
    if (!next && (ev || seat)) next = ev && (!seat || nearer(ev) < nearer(seat)) ? ev.near : "bench";
    if (!next) {
      let best = 1.4;
      for (const l of layout.prompts) {
        // An opened goal building (boards off) no longer shows its closed prompt.
        const opened = progression.opened.includes(l.id as WorldGoalId);
        if (opened && l.id !== "museum") continue;
        const d = footprintDistance(l, player.current.x, player.current.z);
        if (opened && d < best) { best = d; next = "museum_enter"; continue; }
        if (d < best) { best = d; next = l.id === "museum" && chapter.donate ? "donate" : l.id as Near; }
      }
    }
    // A study seat's prompt (or your seat) takes E: the island offers nothing while it is up.
    if (studyHoldsPrompt()) next = null;
    else if (!next && !fishing) next = peacefulNear(island.map, layout.water, player.current.x, player.current.z, fishSpot);
    if (near.current !== next) { near.current = next; onNear(next); }
  }, -2);
  return (
    <>
      <IslandAtmosphere phase={phase} light={light} look={look} weather={weather} liteMode={liteMode} castShadows={castShadows} overview={overview} overviewFog={layout.scale.overviewFog}
        ground={island.ground} puddles={layout.puddles} cloudSize={layout.scale.cloudSize} shadowExtent={layout.scale.shadowExtent} fireflyAnchors={layout.fireflies} trees={layout.trees} />
      <GridWorld map={island.map} field={v.field} light={light} palette={terrain} windScale={liteMode ? 0 : weather === "wind" ? 2.2 : 1} />
      <GridOcean map={island.map} lite={liteMode} skip={layout.underWharf} radius={layout.scale.glintRadius} />
      <PeacefulLayer map={island.map} nodes={layout.nodes} moment={peaceful.moment} member={peaceful.member} player={player} ground={island.ground} highTier={!liteMode} active={!fishing} />
      <BeachBottle player={player} ground={island.ground} />
      <StudySeats area="village" player={player} ground={island.ground} />
      <VillageLandmarks layout={layout} ground={island.ground} opened={progression.opened} stage={progression.stage} ceremony={ceremony} light={light} />
      <EventDecor event={event} ground={island.ground} light={light} weather={weather} />
      {layout.bridges.map(b => <GLBProp key={b.id} url="/assets/acnh/props/bridge-wooden.glb" position={[b.x, b.y, b.z]} rotation={[0, b.yaw ?? 0, 0]} />)}
      {layout.lamps.map(l => <Lantern key={l.id} position={[l.x, island.ground(l.x, l.z), l.z]} intensity={light.lampsOn ? light.lamp * 1.5 : 0} glow={light.lampsOn ? 1.2 : 0} />)}
      {/* Nature and props from the map, instanced: one draw per model sub-mesh however many the island has. */}
      <InstancedModels items={scenery} />
      {/* Residents stand where their schedule puts them this phase; during a ceremony they stroll to the monument and cheer. */}
      {residents.map(({ persona, home, plaza }) => <NPC key={`npc-${persona.id}-${home.join()}-${reset}`} persona={persona} position={ceremony ? plaza : home} playerPositionRef={player}
        groundHeight={island.ground} constrainMove={island.move}
        onClick={() => window.dispatchEvent(new CustomEvent("tsi:npc-greet", { detail: { id: persona.id } }))} />)}
      <PlayerAvatar key={`${reset}-${returned}-${fromBoat}-${exitFrom}`} spawnPosition={spawn} playerName={identity.display_name} playerLevel={level} member={identity.member} player={player} frozen={fishing}
        world={island} groundHeight={island.ground} groundSurface={island.surface} camTarget={focus} glider={peaceful.glider} />
      <CharacterCrowd player={player} ground={island.ground} />
    </>
  );
}

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
        <GLBProp key={i} url="/assets/acnh/props/fence-rope-a.glb" position={[x, 0, z]} rotation={[0, r, 0]} />
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

/** Row-155 village core: open buildings, boarded closed landmarks with signs, boards, wharf stub. Only what the map places. */
function VillageLandmarks({ layout, ground, opened, stage, ceremony, light }: { layout: ReturnType<typeof villageLayout>; ground: (x: number, z: number) => number; opened: readonly WorldGoalId[]; stage: number; ceremony: boolean; light: IslandLight }) {
  const placed = new Map(layout.landmarks.map(l => [l.id, l]));
  const at = (l: Landmark, dy = 0): [number, number, number] => [l.x, ground(l.x, l.z) + dy, l.z];
  const front = (l: Landmark) => l.z - (l.half?.[1] ?? 0);
  const { hq, shop, oracle, cafe, museum, ruins, monument, mailbox, notice, wharf } = Object.fromEntries(placed) as Partial<Record<Landmark["id"], Landmark>>;
  const board = placed.get("catch"), { fitting, missions } = layout;
  return <>
    {hq && <>
      {/* The clubhouse model's origin is 2.35 in front of its footprint centre; porch lamps flank the door. */}
      <group position={[hq.x, ground(hq.x, hq.z), hq.z - 2.35]}><ACNHBuilding id="hq" windowColor="#ffc95a" windowGlow={light.windowGlow} /></group>
      {[-2, 2].map(x => <pointLight key={x} position={[hq.x + x, ground(hq.x, hq.z) + 1.25, hq.z - 3.65]} color="#ffd17a" intensity={light.lampsOn ? light.lamp * 0.85 : 0} distance={4} decay={2} />)}
      <pointLight position={[hq.x, ground(hq.x, hq.z) + 1.6, hq.z - 3.75]} color="#ffd68b" intensity={light.lamp * 1.5} distance={5.5} />
    </>}
    {shop && <group position={at(shop)}><ACNHBuilding id="shop" /></group>}
    {fitting && <GLBProp url="/assets/acnh/furniture/fitting-room.glb" position={[fitting[0], ground(...fitting), fitting[1] + 0.45]} scale={0.1} rotation={[0, Math.PI, 0]} />}
    {oracle && <group position={at(oracle)}><ACNHBuilding id="oracle" /></group>}
    {cafe && <group position={at(cafe)}><ACNHParts parts={CHALET_VARIANTS.yellow} /></group>}
    {museum && <group position={at(museum)}><ACNHParts parts={CHALET_VARIANTS.red} /></group>}
    {/* Boarded doors: the existing log fence across each closed entrance. */}
    {[cafe, museum].filter(l => l && !opened.includes(l.id as WorldGoalId)).map(l => [-0.6, 0.6].map(dx => <NatureFence key={`${l!.id}${dx}`} position={[l!.x + dx, ground(l!.x, l!.z), front(l!) - 0.35]} variant={1} />))}
    {ruins && [-1.2, 0, 1.2].map(dz => <group key={dz} position={[ruins.x, ground(ruins.x, ruins.z + dz), ruins.z + dz]} rotation={[0, Math.PI / 2, 0]}><NatureFence position={[0, 0, 0]} variant={1} /></group>)}
    {ruins && [-1.9, 1.9].map(dz => <GLBProp key={dz} url="/assets/acnh/props/stone-lantern.glb" position={[ruins.x, ground(ruins.x, ruins.z + dz), ruins.z + dz]} />)}
    {monument && <ClubMonument position={at(monument)} stage={stage} ceremony={ceremony} />}
    {mailbox && <GLBProp url="/assets/acnh/furniture/mailbox.glb" position={at(mailbox)} scale={0.1} />}
    {notice && <GLBProp url="/assets/acnh/props/bulletin-board.glb" position={at(notice)} />}
    {board && <GLBProp url="/assets/acnh/props/bulletin-board.glb" position={at(board)} />}
    {missions && <GLBProp url="/assets/acnh/props/bulletin-board.glb" position={[missions.at[0], ground(...missions.at), missions.at[1] + 0.3]} rotation={[0, missions.yaw, 0]} />}
    {wharf && <group position={[wharf.x, 0, wharf.z]} rotation={[0, wharf.yaw ?? 0, 0]}><WharfPier /></group>}
    {layout.landmarks.filter(l => SIGNS[l.id] && !opened.includes(l.id as WorldGoalId)).map(l => <Html key={l.id} position={[l.x, ground(l.x, l.z) + (l.half && l.half[0] > 1 ? 3.6 : 2.3), l.z - (l.half?.[1] ?? 0)]} center distanceFactor={10} zIndexRange={[3, 0]}>
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

/** `preset` (default: the game look, CURRENT) and `children` (mounted inside the Canvas) are for /lab/look only. */
export default function DefaultIslandWorld({ preset, children }: { preset?: LookPreset; children?: ReactNode }) {
  return <GameSceneBoundary><DefaultIslandWorldContent preset={preset}>{children}</DefaultIslandWorldContent></GameSceneBoundary>;
}

function DefaultIslandWorldContent({ preset, children }: { preset?: LookPreset; children?: ReactNode }) {
  const [graphics, actions] = useGraphicsSettings();
  const conditions = useIslandConditions();
  const islandEvent = useIslandEvent(conditions.now);
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
  // Dev: ?at=x,z starts the village walk at that spot (screenshots of shore/shop details); ?at=HH:MM is the clock (useIslandConditions).
  const [devAt] = useState<[number, number, number] | null>(() => { const v = devHome.getAll("at").map(a => a.split(",").map(Number)).find(p => p.length === 2 && p.every(Number.isFinite)); return v ? [v[0], 0, v[1]] : null; });
  // Follow-camera distance scale for close-up captures (dev only, e.g. ?zoom=0.45).
  const [devZoom] = useState(() => Number(devHome.get("zoom")) || 1);
  const [donateOpen, setDonateOpen] = useState(false);
  const [museumWings, setMuseumWings] = useState<MuseumWing[] | null>(null);
  const loadMuseumRef = useRef(false);
  const loadMuseum = useCallback(() => { apiCall<MuseumWing[]>("/api/collections/museum", "wings").then(setMuseumWings, () => {}); }, []);
  const [fading, setFading] = useState(false);
  const [near, setNear] = useState<Near>(null);
  // Dev (screenshots): `?sheet=path` opens the Oracle path sheet once progression loads.
  const [sheet, setSheet] = useState<Sheet>(() => (devHome.get("sheet") === "path" ? "path" : null));
  const [shopTab, setShopTab] = useState<"outfits" | "furniture" | null>(null);
  const [mapOpen, setMapOpen] = useState(true);
  const plot = useDefaultIslandPlot();
  const progression = useProgressionWorld();
  const ceremony = useCeremony(progression.ceremonyGoal, progression.forceCeremony);
  const chapterActions = useChapterActions();
  const chapterFlags = useMemo(() => ({ claim: chapterActions.claim, donate: chapterActions.donate, report: chapterActions.report }),
    [chapterActions.claim, chapterActions.donate, chapterActions.report]);
  const [actionNote, setActionNote] = useState<string | null>(null);
  useEffect(() => { if (inside === "museum" && !loadMuseumRef.current) { loadMuseumRef.current = true; loadMuseum(); } if (inside !== "museum") loadMuseumRef.current = false; }, [inside, loadMuseum]);
  const peaceful = usePeacefulContext(weather, conditions.now);
  // Audio pass (row 169 / polish-ownership item 9): the hourly music player
  // follows the real clock everywhere on this island; cafe and other
  // interiors override the outdoor block with their own bed.
  const musicOverride = inside === "cafe" ? "cafe" : inside ? "interior" : null;
  useMusicDirector({ season: season.season, override: musicOverride });
  const ambientPhase: AmbientPhase = phase === "evening" ? "dusk" : phase;
  const [fishing, setFishing] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const identity = useWorldIdentity();
  const moveKeys = useMoveKeys();
  const touch = useCoarsePointer() || devHome.get("touch") === "1";
  const [reveal, setReveal] = useState<{ family: Family; type: string; startedAt: number } | null>(null);
  // Bumped by the Oracle's path sheet after a subclass, loadout or stat change so the encounter re-reads them.
  const [pathTick, setPathTick] = useState(0);
  const [pathView, setPathView] = useState<ProgressionView | null>(null);
  const [level, setLevel] = useState<number>();
  useEffect(() => { let alive = true; void combatProgression().then(g => {
    if (!alive) return;
    setGate({ open: g.gateOpen, reason: g.gateOpen ? null : /^Sealed/.test(g.reason ?? "") ? g.reason : `Sealed. ${g.reason ?? ""}`.trim() });
    setPathView(g.view);
    setLevel(g.level);
    // Progression feeds the encounter: stats, max HP, the subclass kit and loadout, weapon durability.
    const p = combat.rt.player;
    p.armed = g.gateOpen;
    if (g.stats) p.stats = g.stats;
    p.level = g.level;
    if (g.maxHp) { p.maxHp = g.maxHp; p.hp = Math.min(p.hp, g.maxHp); }
    equipKit(combat.rt, subclassByKey(g.subclass), g.view?.loadout ?? [], g.view?.traits ?? {});
    setOwnedWeapons(combat.rt, g.weapons);
    publishCombat();
  }); return () => { alive = false; }; }, [identity.family, pathTick]);
  const onOracleResult = useCallback((result: ResultView) => {
    setFamily(result.family); setSheet(null);
    setReveal({ family: result.family, type: result.type, startedAt: performance.now() });
  }, []);
  const fishSpot = useRef<FishingSpot | null>(null);
  const { data: residentRows } = useNPCPersonas({ permanentOnly: true });
  useCheer(ceremony, residentRows.map(r => r.id));
  const stage = progression.activeGoal?.stage ?? 0;
  const progressionWorld = useMemo(() => ({ stage, opened: progression.completedGoals }), [stage, progression.completedGoals]);
  const target = progression.objective.target;
  // Objective marker drawn in the minimap's mirrored world coordinates (+x on the left).
  const objectivePlot = useMemo(() => target ? { ...plot, content: <>{plot.content}
    <g className={styles.objectiveMarker}><circle cx={-target[0]} cy={-target[1]} r={1.9} fill="none" stroke="#e8704a" strokeWidth={0.6} />
      <path d={`M ${-target[0]} ${-target[1] - 2.9} l 1.3 -2.1 h -2.6 z`} fill="#e8704a" /></g></> } : plot, [plot, target]);
  const perfOutput = useRef<HTMLOutputElement>(null);
  const player = useRef(new THREE.Vector3(...villageSpawn()));
  const hqDoor = useMemo(() => landmarkPoint("hq", "door"), []);
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
  const lookPreset = preset ?? CURRENT;
  // The key light follows the real sun (row 239); /lab/look's edited preset keeps its own sun sliders.
  const sun = preset ? null : conditions.sun;
  const light = useMemo(() => withWeather(withSeason(islandLight(lookPreset, phase, sun), look), weather), [phase, look, weather, lookPreset, sun]);
  const conditionsLabel = `${season.season[0].toUpperCase()}${season.season.slice(1)}${Object.values(season.weights).some(w => w > 0 && w < 1) ? " (changing)" : ""} · ${weather[0].toUpperCase()}${weather.slice(1)}`;
  const grade = inside ? CLUBHOUSE_LIGHTING[phase].grade : light.grade;
  const atHome = site === "home";
  const act = useCallback((action: Near) => {
    if (action === "notice") { setSheet("notice"); return; }
    // The catch board's clues are the collection journal's.
    if (action === "catch") { setBagOpen(true); return; }
    if (action === "mailbox") { setSheet("letters"); return; }
    if (action === "curator") { setDonateOpen(true); return; }
    if (action === "display") { setSheet("trophies"); return; }
    if (action === "desk") { setSheet("showcase"); return; }
    if (action === "closet" || action === "fitting") { setSheet(action); return; }
    if (action === "altar") { setReveal(null); setSheet("oracle"); return; }
    if (action === "missions") { setSheet("missions"); return; }
    if (action === "trophy" || action === "posters") { setSheet(action === "trophy" ? "tourney" : "posters"); return; }
    // Winter lights and the spring picnic: a moment, not a reward (principle 3: no rewards for online activity).
    if (action === "cocoa" || action === "picnic") {
      setActionNote(action === "cocoa" ? "A hot cocoa, extra marshmallows. The windows fog up a little." : "Petals keep landing in the teacups. Somebody brought far too many sandwiches.");
      window.setTimeout(() => setActionNote(null), 3500);
      return;
    }
    if (action === "lantern") { combat.rt.idol = "carried"; missionEvent(combat.rt, { type: "pickup", item: combat.rt.mission?.def.params.item ?? "old-lantern" }); publishCombat(); return; }
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
      // site + where the player stands: the server rolls the catch from there (FishingOverlay).
      if (spot) window.dispatchEvent(new CustomEvent("tsi:fish-start", { detail: { x: spot.target[0], z: spot.target[1], water: spot.water, site: atHome ? "home" : "village", from: [player.current.x, player.current.z] } }));
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
  }, [fading, chapterActions, homeActions, inside, gate, layout, atHome]);
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
      <AudioController phase={ambientPhase} weather={weather} season={season.season} />
      <Canvas tabIndex={0} role="application" aria-label="Island walking area" style={{ zIndex: 0, imageRendering: graphics.pixelated ? "pixelated" : "auto" }} gl={{ antialias: false, powerPreference: "high-performance" }} dpr={graphics.pixelated ? 0.5 : [1, 1.5]}
        camera={{ position: [0, 10.2, -21], fov: BASE_FOV, near: 0.1, far: 120 }} shadows={castShadows ? "percentage" : false}
        onCreated={({ gl }) => { gl.info.autoReset = false; gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
        <Suspense fallback={null}>
          {site === "ruins" ? <RuinsScene key={`ruins-${ruinsRun}`} level={level} phase={phase} light={light} look={look} weather={weather} liteMode={liteMode} castShadows={castShadows} zoom={zoomed ? 1.4 : devZoom} player={player}
              onNear={n => setNear(n === "exit" ? "ruins_exit" : n)} onDefeat={onRuinsDefeat} start={ruinsRun <= 1 ? devAt : null} />
            : inside === "oracle" ? <OracleTemple frozen={fading || sheet === "oracle"} player={player} onNear={n => setNear(n)} ceremony={reveal} />
            : inside === "cafe" ? <CafeInterior phase={phase} player={player} frozen={fading || !!sheet} identity={identity} level={level} onNear={setNear} />
            : inside === "museum" ? <MuseumInterior wings={museumWings} frozen={fading || donateOpen} player={player} onNear={n => setNear(n === "donate" ? "curator" : n)} />
            : inside === "hq" ? <Clubhouse phase={phase} player={player} frozen={fading} onNear={setNear} />
            : inside === "house" ? <HomeInterior layout={layout} phase={phase} frozen={fading} player={player} onNear={(n: HouseNear) => setNear(n)}
              decorating={decor.decorating} selected={decor.selected} onPlace={decor.place} onPickUp={decor.pickUp} />
            : atHome ? <HomeIslandScene identity={identity} level={level} peaceful={peaceful} fishSpot={fishSpot} fishing={fishing} phase={phase} light={light} look={look} weather={weather} liteMode={liteMode} castShadows={castShadows} zoom={zoomed ? 1.4 : devZoom}
              overview={overview} returned={returned} player={player} onNear={(n: HomeNear) => setNear(n)} outdoor={layout.outdoor}
              decorating={decor.decorating} selected={decor.selected} onPlace={item => decor.place("outdoor", item)} onPickUp={item => decor.pickUp("outdoor", item)} />
            : <IslandScene identity={identity} level={level} devAt={devAt} exitFrom={exitFrom} peaceful={peaceful} fishSpot={fishSpot} fishing={fishing} chapter={chapterFlags} fromBoat={fromBoat} progression={progressionWorld} ceremony={ceremony} event={islandEvent} phase={phase} light={light} look={look} weather={weather} overview={overview} zoom={zoomed ? 1.4 : devZoom} reset={reset} returned={returned} liteMode={liteMode} castShadows={castShadows} player={player} onNear={setNear} />}
          {identity.family && identity.aura && <Suspense fallback={null}><FamilyAura player={player} color={FAMILIES[identity.family].light} /></Suspense>}
          <PostFX antialias={!graphics.liteMode && !graphics.pixelated} grade={grade} fx={lookFx(lookPreset, !liteMode)} />
          <LookMaterials preset={lookPreset} />
          <SunShadows />
          <Performance player={player} output={perfOutput} />
          <QualityProbe onTier={onTier} />
          {children}
          {!inside && !atHome && site !== "ruins" && near !== "enter" && hqDoor && <Html position={[hqDoor[0], 2.9, hqDoor[1]]} center distanceFactor={10} zIndexRange={[3, 0]}>
            <div className={styles.cue}>Clubhouse</div>
          </Html>}
        </Suspense>
      </Canvas>
      <header className={styles.heading}>
        <h1>{site === "ruins" ? "The ruins" : inside === "oracle" ? "Oracle temple" : inside === "museum" ? "Museum" : inside === "cafe" ? "Café" : inside === "hq" ? "Clubhouse" : inside === "house" ? "Your house" : atHome ? "Your island" : "Tethos Island"}</h1>
        <p>{!inside && !atHome && site === "village" && islandEvent ? `${islandEvent.goal.title} is on.` : "A little space to make our own."}</p>
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
          <output ref={perfOutput}>Measuring…</output>
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
      {!bagOpen && <button className={styles.bagButton} onClick={() => setBagOpen(true)} aria-label="Open your collection journal"><kbd>{keyName(identity.settings.key_bindings.openJournal)}</kbd> Journal</button>}
      {mapOpen && !inside && !atHome && site !== "ruins" && <div className={styles.minimap} data-minimap>
        <MiniMap playerPosRef={player} plot={objectivePlot} onClose={() => setMapOpen(false)} />
        {progression.objective.text && <p className={styles.objective} data-testid="objective"><span aria-hidden="true">◆</span> {progression.objective.text}</p>}
      </div>}
      <CeremonyConfetti active={ceremony && !inside && !atHome} />
      {actionNote && <p className={styles.actionNote} role="status">{actionNote}</p>}
      {atHome && !decor.decorating && <button className={styles.decorateToggle} onClick={decor.toggle}><kbd>F</kbd> Decorate</button>}
      {atHome && decor.decorating && !shopTab && <DecorateSheet indoor={inside === "house"} selected={decor.selected} layout={layout}
        room={inside === "house" ? layout.rooms[roomAt(player.current.x, layout.rooms.length)] ?? null : null}
        onChoose={decor.choose} onRotate={decor.rotateSelected} onPutAway={decor.putAway} onDone={decor.toggle}
        onFinish={(key, value) => decor.setRoomFinish(roomAt(player.current.x, layout.rooms.length), key, value)} onShop={() => setShopTab("furniture")} />}
      {/* Locked wardrobe items and the decorate panel link here; closing remounts them with the new inventory. */}
      <ProgressionPanel open={!!shopTab} onClose={() => setShopTab(null)} title="Shop" wide>{shopTab && <ShopBody initialTab={shopTab} />}</ProgressionPanel>
      <NoticeSheet open={sheet === "notice"} onClose={() => setSheet(null)} />
      <LettersSheet open={sheet === "letters"} onClose={() => setSheet(null)} />
      {(sheet === "closet" || sheet === "fitting") && <WardrobeSheet open place={sheet === "closet" ? "closet" : "fitting"} onClose={() => setSheet(null)} onShop={() => { setSheet(null); setShopTab("outfits"); }} />}
      <PlayerCharacterUI />
      <JournalSheet open={sheet === "journal"} onClose={() => setSheet(null)} />
      <OracleQuizSheet open={sheet === "oracle"} onClose={() => setSheet(null)} onResult={onOracleResult} onPath={pathView?.family ? () => { setPathTick(n => n + 1); setSheet("path"); } : undefined} />
      {sheet === "path" && pathView && <PathSheet view={pathView} onClose={() => setSheet(null)} onChanged={() => setPathTick(n => n + 1)} />}
      <SettingsSheet open={sheet === "settings"} onClose={() => setSheet(null)} />
      {reveal && inside === "oracle" && <FamilyReveal family={reveal.family} type={reveal.type} onContinue={() => setReveal(null)} />}
      <TrophySheet open={sheet === "trophies"} onClose={() => setSheet(null)} />
      <ShowcaseSheet open={sheet === "showcase"} onClose={() => setSheet(null)} />
      <MissionBoardSheet open={sheet === "missions"} onClose={() => setSheet(null)} gateNote={gate.open ? null : gate.reason} />
      <TourneySheet open={sheet === "tourney"} onClose={() => setSheet(null)} />
      <PostersSheet open={sheet === "posters"} onClose={() => setSheet(null)} event={islandEvent} />
      {site === "ruins" && <CombatHud player={player} />}
      {site === "ruins" ? <div className={styles.controls} data-combat><span>{[moveKeys.forward, moveKeys.left, moveKeys.back, moveKeys.right].map(k => <kbd key={k}>{keyName(k)}</kbd>)} Move</span><span>Mouse Aim</span><span>Click Attack</span><span><kbd>{keyName(moveKeys.jump)}</kbd> Jump</span><span><kbd>{keyName(moveKeys.dash)}</kbd> Dodge</span><span><kbd>1</kbd>–<kbd>4</kbd> Abilities</span><span><kbd>R</kbd> Swap</span><span><kbd>E</kbd> Interact</span></div>
      : <div className={styles.controls}><span>{[moveKeys.forward, moveKeys.left, moveKeys.back, moveKeys.right].map(k => <kbd key={k}>{keyName(k)}</kbd>)} Walk</span><span><kbd>{keyName(moveKeys.sprint)}</kbd> Run</span><span><kbd>{keyName(moveKeys.jump)}</kbd> Jump</span>{peaceful.glider && <span><kbd>{keyName(moveKeys.jump)}</kbd> again in the air Glide</span>}<span><kbd>{keyName(moveKeys.dash)}</kbd> Dash</span><span><kbd>E</kbd> Interact</span><span><kbd>Z</kbd> Zoom</span><span><kbd>{keyName(identity.settings.key_bindings.openMap)}</kbd> Map</span><span><kbd>J</kbd> Quests</span><span><kbd>{keyName(identity.settings.key_bindings.openJournal)}</kbd> Collection</span><span><kbd>{keyName(moveKeys.sneak)}</kbd> Sneak</span></div>}
      {/* Clear of the minimap (left) and the audio widget (bottom right). */}
      {touch && (!inside || inside === "cafe") && <TouchControls left={212} bottom={64} />}
      <p className={styles.touchControls}>Tap the ground to move</p>
      <div className={styles.fade} data-active={fading} aria-hidden="true" />
      <LoadingStatus />
    </main>
  );
}
