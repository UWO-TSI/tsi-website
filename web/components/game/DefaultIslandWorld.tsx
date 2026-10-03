"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, useProgress, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Map as MapIcon, Settings, Wrench } from "lucide-react";
import GridWorld from "./grid/GridWorld";
import GridOcean from "./grid/GridOcean";
import PlayerAvatar from "./PlayerAvatar";
import Residents from "./NPC";
import GameSceneBoundary from "./GameSceneBoundary";
import PostFX from "./PostFX";
import HQInterior from "./HQInterior";
import SunShadows from "./SunShadows";
import { FadeLight, Lantern } from "./AmbientProps";
import { GLBProp, sceneryOf } from "./NatureModels";
import { InstancedModels } from "./InstancedNature";
import { ACNHBuilding, ACNHParts, CHALET_VARIANTS } from "./ACNHBuilding";
import { NatureFence } from "./NatureModels";
import WharfPier from "./WharfPier";
import FittingRoom, { FITTING_STEP_MS } from "./FittingRoom";
import { BASE_FOV } from "./movement/moveFx";
import MiniMap from "./MiniMap";
import { useDefaultIslandPlot } from "./DefaultIslandMap";
import LettersSheet from "@/components/progression/LettersSheet";
import NoticeSheet from "@/components/progression/NoticeSheet";
import JournalSheet from "@/components/progression/JournalSheet";
import { useProgressionWorld, useCeremony, useChapterActions, type WorldGoalId } from "@/lib/game/progressionBridge";
import confetti from "canvas-confetti";
import type { InteriorStation } from "./interiorShared";
import { villageIsland, villageSpawn, villageScale, landmark, landmarks, landmarkPoint, wharfDeck, benchSeat, BENCH_SEAT_TOP, type Landmark } from "@/lib/game/defaultIsland";
import { village, objectsOf, type Village } from "@/lib/game/villageMap";
import { LEVEL_STEP, levelAt, worldToCellX, worldToCellZ } from "@/lib/game/grid";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { CLUBHOUSE_LIGHTING, ISLAND_TERRAIN, islandLightAt, windowLit, withWeather, withSeason, type IslandLight } from "@/lib/game/islandLighting";
import { SEASON_TREES, paletteBySeason, seasonLook, type SeasonLook } from "@/lib/game/seasonalLook";
import { useNPCPersonas, useSeasonPalettes } from "@/lib/content/loader";
import type { IslandWeather } from "@/lib/game/islandWeather";
import { useIslandConditions } from "@/lib/game/useIslandConditions";
import { IslandAtmosphere, useFollowCamera, type TreeSpot } from "./IslandAtmosphere";
import PeacefulLayer, { peacefulNear } from "./peaceful/PeacefulLayer";
import WardrobeSheet from "./peaceful/WardrobeSheet";
import { InventorySheet, ShopBody, WalletSheet } from "@/components/economy/EconomySheets";
import { isTyping, worldKeysBlocked } from "@/lib/game/useWorldDialog";
import ProgressionPanel from "@/components/progression/ProgressionPanel";
import { apiCall } from "@/lib/apiClient";
import PlayerCharacterUI from "./character/PlayerCharacterUI";
import CharacterCrowd from "./character/CharacterCrowd";
import OracleTemple from "./oracle/OracleTemple";
import RuinsScene from "./combat/RuinsScene";
import CombatHud from "./combat/CombatHud";
import MissionBoardSheet from "./combat/MissionBoardSheet";
import { SLOT_IDS, V2_SLOT_IDS, attachProgressId, combat, publishCombat, setMission, setOwnedWeapons, setWeapon, useCombatValue } from "@/lib/game/combat/runtime";
import { missionEvent } from "@/lib/game/combat/abilities";
import { combatProgression, postWear, startMissionRemote, type ProgressionView } from "@/lib/game/combat/progression";
import { equipKit } from "@/lib/game/combat/abilities";
import { equipClassKit } from "@/lib/game/combat/classRuntime";
import { classKit } from "@/lib/combat/classes";
import { subclassByKey } from "@/lib/combat/kits";
import PathSheet from "./oracle/PathSheet";
import { MISSIONS, WEAPONS } from "@/lib/game/combat/data";
import { startMission } from "@/lib/game/combat/missions";
import OracleQuizSheet from "./oracle/OracleQuizSheet";
import { FamilyReveal } from "./oracle/OracleSheetEmbed";
import SettingsSheet from "./oracle/SettingsSheet";
import FamilyAura from "./oracle/FamilyAura";
import SubclassAura from "./oracle/SubclassAura";
import { FAMILIES } from "@/lib/game/oracle/family";
import type { Family } from "@/lib/oracle/engine";
import type { ResultView } from "@/lib/oracle/service";
import { setFamily, useWorldIdentity, type WorldIdentity } from "@/lib/game/identity";
import { actionForKey } from "@/lib/identity/settings";
import { crouchKey, keyName, useAbilityKeys, useKeyboardLocked, useMoveKeys } from "@/lib/game/movement/keys";
import { useCoarsePointer } from "@/lib/game/useMediaQuery";
import TouchControls from "./movement/TouchControls";
import MuseumInterior from "./peaceful/MuseumInterior";
import AudioController from "./AudioController";
import { AudioManager, type AmbientPhase } from "@/lib/game/audio";
import { useMusicDirector } from "@/lib/game/useAudio";
import DonateSheet from "./peaceful/DonateSheet";
import { ShowcaseSheet, TrophySheet } from "./peaceful/ShowcaseSheets";
import type { MuseumWing } from "@/lib/collections/logic";
import FishingOverlay from "./FishingOverlay";
import ToastHub, { toast } from "./ToastHub";
import IslandLoading from "./IslandLoading";
import HQLead from "./HQLead";
import DailyGift from "./DailyGift";
import { NPCDialogue } from "@/components/recruit/ui";
import { HQ_LEAD, LEAD_OFFSET, markWelcomed, readWelcomed, welcomeStep } from "@/lib/game/welcome";
/** The roster's HQ lead (residentRoster.ts) is the first-login greeter (HQ_LEAD). */
const HQ_LEAD_SLUG = "wren";
import { useMyLook } from "@/lib/game/character/lookStore";
import { useProgression } from "@/lib/progression/useProgression";
import { anchorAt } from "@/lib/content/residents";
import { WarmupProbe } from "./LoadGate";
import { escapeAction } from "@/lib/game/sceneGate";
import TopCluster, { hudButton } from "./TopCluster";
import { setHudCoins, setHudXp } from "@/lib/game/hudStore";
import CollectionBook from "./CollectionBook";
import { usePeacefulContext } from "@/lib/game/usePeacefulContext";
import ToolWheel from "./ToolWheel";
import { clickAction, heldItem, toolNeeded, wheelContents, type Reach, type WheelItem, type WheelSite } from "@/lib/game/toolWheel";
import { holdItem, readHeld, settleHeld, swapHeld, useHeld } from "@/lib/game/heldStore";
import { useWheelKeys } from "@/lib/game/movement/keys";
import { rodByTier } from "@/lib/game/rods";
import { eatItem, localCollections, mergeWithLocal } from "@/lib/game/collections";
import { capture } from "@/lib/game/orbitCamera";
import { iconUrl } from "@/lib/icons/keys";
import { FLASH_MS, fullHud as isFullHud, setClassTag, useAlwaysFullHud } from "@/lib/game/hudPrefs";
import { useFlash } from "./useFlash";

import { villageNodes } from "@/lib/game/islandNodes";
import { villageWater, type FishingSpot } from "@/lib/game/fishingSpots";
import { gullAnchors } from "@/lib/game/ambientFauna";
import { getPeacefulTarget, peacefulLabel, subscribePeacefulLabel } from "@/lib/game/peacefulNear";
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
import CafeGoalSheet from "./study/CafeGoalSheet";
import CafeBuilding from "./study/CafeBuilding";
import { CAFE_GRADE, CAFE_OWNER } from "@/lib/game/cafe";
import { studyHoldsPrompt } from "@/lib/study/worldStore";
import "@/lib/game/aerialFog";
import { CURRENT, lookFx, type LookPreset } from "@/lib/game/lookPreset";
import LookMaterials from "./LookMaterials";
import { EventDecor, eventSpots, PostersSheet, TourneySheet } from "./SeasonalEvents";
import { useIslandEvent, type IslandEvent } from "@/lib/game/seasonalEvents";
import { escapeEndedCapture, holdCursor, orbit, readCapture, readOrbitPrefs, saveOrbit, subscribeCapture, subscribeOrbitPrefs, toggleZoom } from "@/lib/game/orbitCamera";
import { RESET_VIEW_KEY } from "./useOrbitInput";
import { boxOccluder, treeOccluder } from "@/lib/game/occluders";
import styles from "./DefaultIslandWorld.module.css";

type Near = "enter" | "exit" | "board" | "display" | "desk" | "shelf" | "clock" | "notice" | "catch" | "cafe" | "museum" | "ruins" | "mailbox" | "monument" | "home" | "house" | "village" | "buy" | "claim" | "donate" | "report" | "fish" | "forage" | "net" | "dig" | "museum_enter" | "cafe_enter" | "curator" | "closet" | "fitting" | "oracle_enter" | "altar" | "missions" | "ruins_exit" | "lantern" | "bench" | "bed" | "trophy" | "posters" | "cocoa" | "picnic" | "owner" | null;
type Sheet = "notice" | "letters" | "journal" | "trophies" | "showcase" | "closet" | "fitting" | "oracle" | "path" | "settings" | "missions" | "tourney" | "posters" | "cafe" | "bag" | "wallet" | null;
const DEV = process.env.NODE_ENV !== "production";
const DEV_SHEETS: readonly Sheet[] = ["notice", "letters", "journal", "trophies", "showcase", "closet", "fitting", "oracle", "path", "settings", "missions", "tourney", "posters", "cafe", "wallet"];
/** Sheets opened at a station with E: E closes them again (the dialog system's opening key). */
const STATION_KEY = "e";
const PHASE_NAMES: Record<IslandPhase, string> = { dawn: "Dawn", day: "Daylight", evening: "Evening", night: "Night" };
const CLUBHOUSE_STATIONS: InteriorStation[] = [
  { id: "board", name: "Notice board", pos: HQ_BOARD_APPROACH, action: "board", range: 2.3 },
  { id: "display", name: "Trophy display", pos: [HQ_LAYOUT.display.position[0], 4.2], action: "display", range: 1.8 },
  { id: "desk", name: "Front desk", pos: [HQ_LAYOUT.desk.position[0], HQ_LAYOUT.desk.position[2] - 1.2], action: "desk", range: 1.8 },
  { id: "shelf", name: "Bookshelf", pos: [6.6, HQ_LAYOUT.shelf.position[2]], action: "shelf", range: 1.6 },
  { id: "clock", name: "Clock", pos: [HQ_CLOCK[0], HQ_CLOCK[2] - 0.8], action: "clock", range: 1.8 },
  { id: "exit", name: "Island", pos: [0, -5.5], action: "exit", range: 1.1 },
];
const NEAR_LABELS: Record<Exclude<Near, null>, string> = {
  enter: "Enter HQ", exit: "Return to the island", board: "Read the notice board",
  display: "Look at the trophy case", desk: "Front desk · profile showcase", shelf: "Browse the bookshelf", clock: "Check the clock",
  notice: "Read the notice board", catch: "Check the catch board", mailbox: "Check the mailbox", monument: "Club monument",
  museum_enter: "Enter the museum", cafe_enter: "Enter the café", curator: "Talk to the curator", closet: "Open the closet", fitting: "Try on outfits", oracle_enter: "Enter the Oracle temple", altar: "Consult the crystal",
  home: "Take the boat home", fish: "Cast your line", forage: "Gather", net: "Swing the net", dig: "Dig", claim: "Claim your plot", donate: "Donate your first catch to the museum", report: "Report to HQ", house: "Enter your house", village: "Take the boat to the village",
  buy: `Add a room · ${ROOM_PRICE.coins} TC + ${ROOM_PRICE.materials}`,
  cafe: "Boarded up · help reopen it at the monument", museum: "Museum · Closed for now", ruins: "Enter the ruins", missions: "Read the mission board", ruins_exit: "Back to the village", lantern: "Pick it up",
  bench: "Sit on the bench", bed: "Sleep in your bed",
  trophy: "Read the tourney board", posters: "Look at the GENESIS posters", cocoa: "Get a hot cocoa", picnic: "Join the picnic",
  owner: `Talk to ${CAFE_OWNER.name}`,
};
const CLOSED: Near[] = ["museum", "monument"];
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
 * Where a gull lands now and then on the island (AmbientFauna adds the water off the shore): each lamp's top and the
 * tops of the HQ's roof and the shop's sign, measured from their GLBs (streetlamp 2.67; hq-office 4.76 at 2.03 behind
 * its middle, shop-market 3.93 at 1.86, both at ACNH_SCALE and turned a half turn as ACNHBuilding places them).
 */
function gullPerchSpots(v: Village, ground: (x: number, z: number) => number): [number, number, number][] {
  const hq = landmark("hq", v), shop = landmark("shop", v);
  return [
    ...objectsOf("lamp", v).map((l): [number, number, number] => [l.x, ground(l.x, l.z) + 2.67, l.z]),
    ...(hq ? [[hq.x, ground(hq.x, hq.z) + 4.76, hq.z - 2.35 + 2.03] as [number, number, number]] : []),
    ...(shop ? [[shop.x, ground(shop.x, shop.z) + 3.93, shop.z + 1.86] as [number, number, number]] : []),
  ];
}

/**
 * The village as this scene uses it, all from the map file (specs/island-painter.md):
 * walking, objects, doors, spawns, nodes, water and the size-dependent settings.
 * Built once per loaded map; nothing here is placed relative to the local player.
 */
function villageLayout(v: Village) {
  const deck = wharfDeck(v);
  const fitting = objectsOf("fitting", v)[0], missions = objectsOf("missions", v)[0], marks = landmarks(v);
  const island = villageIsland(v), trees = objectsOf("tree", v).map((o): TreeSpot => ({ x: o.x, z: o.z, seed: o.seed ?? 0 }));
  return {
    island,
    landmarks: marks,
    trees,
    /** What can stand between the orbit camera and you: the buildings and the trees' canopies (lib/game/occluders.ts). */
    occluders: [...marks.filter(l => l.half && Math.max(...l.half) >= 1).map(l => boxOccluder(l.x, l.z, l.half![0], l.half![1], island.ground(l.x, l.z), 5)),
      ...trees.map(t => treeOccluder(t.x, t.z, island.ground(t.x, t.z)))],
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
    /** Ambient life (AmbientFauna): flowers for the butterflies, the water's kinds, gulls off the shores in view. */
    fauna: { site: { map: v.map, flowers: objectsOf("flower", v).map(xz), water: villageWater(v).classify }, gulls: gullAnchors(v.bounds), perches: gullPerchSpots(v, island.ground) },
    /** No water glints under the wharf deck: it sits a few centimetres above the water and they would show through. */
    underWharf: (x: number, z: number) => !!deck && x > deck.x0 - 0.4 && x < deck.x1 + 0.4 && z > deck.z0 - 0.4 && z < deck.z1 + 0.4,
  };
}
const SIGNS: Partial<Record<Landmark["id"], string>> = { museum: "Museum · Closed", ruins: "Ruins gate", notice: "Notices", catch: "Catch board", shop: "Shop", oracle: "Oracle temple" };
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

function IslandScene({ held, identity, level, devAt, exitFrom, peaceful, fishSpot, fishing, chapter, phase, light, look, weather, overview, zoom, reset, returned, fromBoat, liteMode, castShadows, player, onNear, progression, ceremony, event, lead }: {
  /** What the player holds from the tool wheel (specs/game-ui.md), drawn in the hand. */
  held: WheelItem | null;
  progression: { stage: number; opened: readonly WorldGoalId[] }; ceremony: boolean; fromBoat: boolean; event: IslandEvent | null;
  /** The HQ lead on the wharf for a first login (`line`: the one she is saying; the player holds still while she talks). */
  lead: { line: number | null; hold: boolean } | null;
  chapter: { claim: boolean; donate: boolean; report: boolean };
  peaceful: { moment: WorldMoment; member: string; glider: boolean }; fishSpot: { current: FishingSpot | null }; fishing: boolean; exitFrom: "museum" | "oracle" | "ruins" | "cafe" | null; devAt: [number, number, number] | null; identity: WorldIdentity; level?: number;
  phase: IslandPhase; light: IslandLight; look: SeasonLook; weather: IslandWeather; overview: boolean; zoom: number; reset: number; returned: boolean; liteMode: boolean; castShadows: boolean;
  player: React.RefObject<THREE.Vector3>; onNear: (near: Near) => void;
}) {
  const v = village();
  const layout = useMemo(() => villageLayout(v), [v]);
  const { island, spawns, doors } = layout;
  const { data: personas } = useNPCPersonas({ permanentOnly: true });
  const exitSpot = exitFrom === "museum" ? spawns.museum : exitFrom === "cafe" ? spawns.cafe : exitFrom === "oracle" ? spawns.oracle : exitFrom === "ruins" ? spawns.ruins : null;
  const spawn = (devAt && !returned && !fromBoat && !exitFrom ? devAt : fromBoat ? spawns.boat : exitSpot ?? (returned ? spawns.returned : null)) ?? spawns.start;
  const terrain = useMemo(() => ({ ...ISLAND_TERRAIN, grass: look.grass }), [look.grass]);
  const scenery = useMemo(() => sceneryOf(v, island.ground, look.season), [v, island, look.season]);
  const near = useRef<Near>(null);
  const fauna = useMemo(() => ({ ...layout.fauna, ground: island.ground, standable: island.standable, surface: island.surface, top: island.top, player }), [layout, island, player]);
  const leadAt = useMemo((): [number, number] | null => (spawns.boat ? [spawns.boat[0] + LEAD_OFFSET[0], spawns.boat[2] + LEAD_OFFSET[1]] : anchorAt("wharf", v)), [v, spawns.boat]);
  const spots = useMemo(() => eventSpots(event?.decor ?? null), [event]);
  useEffect(() => { player.current.set(...spawn); }, [reset, spawn, player]);
  const focus = useRef(new THREE.Vector3(...spawn));
  const follow = useMemo(() => ({ ground: island.ground, player, occluders: layout.occluders }), [island, player, layout]);
  useFollowCamera(focus, zoom, overview ? layout.scale.overview : null, follow);
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
        ground={island.ground} puddles={layout.puddles} cloudSize={layout.scale.cloudSize} shadowExtent={layout.scale.shadowExtent} fireflyAnchors={layout.fireflies} trees={layout.trees} fauna={fauna} />
      <GridWorld map={island.map} field={v.field} light={light} palette={terrain} windScale={liteMode ? 0 : weather === "wind" ? 2.2 : 1} />
      <GridOcean map={island.map} lite={liteMode} skip={layout.underWharf} radius={layout.scale.glintRadius} />
      <PeacefulLayer map={island.map} nodes={layout.nodes} moment={peaceful.moment} member={peaceful.member} player={player} ground={island.ground} highTier={!liteMode} active={!fishing} treeModels={SEASON_TREES[look.season]} />
      <BeachBottle player={player} ground={island.ground} />
      <StudySeats area="village" player={player} ground={island.ground} />
      <VillageLandmarks layout={layout} ground={island.ground} opened={progression.opened} stage={progression.stage} ceremony={ceremony} light={light} />
      {layout.fitting && <FittingRoom at={layout.fitting} ground={island.ground} player={player} />}
      <EventDecor event={event} ground={island.ground} light={light} weather={weather} />
      {layout.bridges.map(b => <GLBProp key={b.id} url="/assets/acnh/props/bridge-wooden.glb" position={[b.x, b.y, b.z]} rotation={[0, b.yaw ?? 0, 0]} />)}
      {layout.lamps.map(l => <Lantern key={l.id} position={[l.x, island.ground(l.x, l.z), l.z]} intensity={light.lampsOn ? light.lamp * 1.5 : 0} glow={light.lampsOn ? 1.2 : 0} />)}
      {/* Nature and props from the map, instanced: one draw per model sub-mesh however many the island has. */}
      <InstancedModels items={scenery} />
      {/* Residents walk their routines on the world clock (residentRoutine.ts); during a ceremony they gather at the monument and cheer.
          While the HQ lead greets a first login on the wharf, her walking self stays out of sight: one Wren. */}
      <Residents personas={personas} phase={phase} ceremony={ceremony} player={player} island={island} v={v} away={lead ? HQ_LEAD_SLUG : null} />
      <PlayerAvatar key={`${reset}-${returned}-${fromBoat}-${exitFrom}`} spawnPosition={spawn} playerName={identity.display_name} playerLevel={level} member={identity.member} player={player} frozen={fishing || !!lead?.hold}
        world={island} groundHeight={island.ground} groundSurface={island.surface} camTarget={focus} glider={peaceful.glider} held={held} />
      <CharacterCrowd player={player} ground={island.ground} stepWorld={island} />
      {lead && leadAt && <HQLead at={leadAt} ground={island.ground} player={player} line={lead.line} />}
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
  const board = placed.get("catch"), { missions } = layout;
  return <>
    {hq && <>
      {/* The clubhouse model's origin is 2.35 in front of its footprint centre; porch lamps flank the door. */}
      <group position={[hq.x, ground(hq.x, hq.z), hq.z - 2.35]}><ACNHBuilding id="hq" windowColor="#ffc95a" windowGlow={light.windowGlow} /></group>
      {[-2, 2].map(x => <FadeLight key={x} position={[hq.x + x, ground(hq.x, hq.z) + 1.25, hq.z - 3.65]} color="#ffd17a" intensity={light.lampsOn ? light.lamp * 0.85 : 0} distance={4} decay={2} />)}
      <FadeLight position={[hq.x, ground(hq.x, hq.z) + 1.6, hq.z - 3.75]} color="#ffd68b" intensity={light.lamp * 1.5} distance={5.5} />
    </>}
    {shop && <group position={at(shop)}><ACNHBuilding id="shop" lit={windowLit(light)} /></group>}
    {oracle && <group position={at(oracle)}><ACNHBuilding id="oracle" lit={windowLit(light)} /></group>}
    {cafe && <group position={at(cafe)}><CafeBuilding open={opened.includes("cafe")} light={light} /></group>}
    {museum && <group position={at(museum)}><ACNHParts parts={CHALET_VARIANTS.red} lit={windowLit(light)} /></group>}
    {/* Boarded doors: the existing log fence across the museum's entrance (the café boards its own, CafeBuilding). */}
    {[museum].filter(l => l && !opened.includes(l.id as WorldGoalId)).map(l => [-0.6, 0.6].map(dx => <NatureFence key={`${l!.id}${dx}`} position={[l!.x + dx, ground(l!.x, l!.z), front(l!) - 0.35]} variant={1} />))}
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
function Clubhouse({ phase, light, player, frozen, talking, onNear }: { phase: IslandPhase; light: IslandLight; player: React.RefObject<THREE.Vector3>; frozen: boolean; talking: boolean; onNear: (near: Near) => void }) {
  const wood = useTexture("/assets/acnh/interior/hq-parquet-albedo.png");
  const floor = useMemo(() => {
    const tex = wood.clone(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 0.75);
    tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true; return tex;
  }, [wood]);
  useEffect(() => () => floor.dispose(), [floor]);
  const { camera } = useThree();
  // You arrive a step inside the door, clear of its prompt (interiors §5): it shows when you walk back to it.
  useEffect(() => { player.current.set(0, 0, -4.2); camera.position.set(0, 8.4, -11.4); onNear(null); }, [camera, onNear, player]);
  const station = useCallback((s: InteriorStation | null) => onNear((s?.id as Near) ?? null), [onNear]);
  return <>
    <HQInterior clubhouse phase={phase} light={light} floorTexture={floor} frozen={frozen} talking={talking} playerPosRef={player} onNearestStation={station} stations={CLUBHOUSE_STATIONS} constrainMove={constrainWorkshop} />
    <BotanicalFrames />
    <Workbench player={player} />
  </>;
}

/** The cream loading screen until the first warm-up (`ready`), then a fade; an asset that fails to load gets a reload card. */
function LoadingStatus({ ready }: { ready: boolean }) {
  const { active, progress, errors } = useProgress();
  const [gone, setGone] = useState(false);
  useEffect(() => { if (!ready) return; const t = window.setTimeout(() => setGone(true), 700); return () => window.clearTimeout(t); }, [ready]);
  return <>
    {!gone && <IslandLoading stage={active ? "loading" : progress >= 100 ? "warming" : "start"} leaving={ready} />}
    {errors.length > 0 && <div className={styles.loading} role="alert">An island asset could not load.<button className={styles.return} onClick={() => window.location.reload()}>Reload island</button></div>}
  </>;
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
    p.hits[w] = 0; // the ruins scene resets itself (wakes you at the gate) without remounting
  }, []);
  const [gate, setGate] = useState<{ open: boolean; reason: string | null }>({ open: false, reason: "Checking the gate…" });
  // Dev: ?at=x,z starts the village walk at that spot (screenshots of shore/shop details); ?at=HH:MM is the clock (useIslandConditions).
  const [devAt] = useState<[number, number, number] | null>(() => { const v = devHome.getAll("at").map(a => a.split(",").map(Number)).find(p => p.length === 2 && p.every(Number.isFinite)); return v ? [v[0], 0, v[1]] : null; });
  // Follow-camera distance scale for close-up captures (dev only, e.g. ?zoom=0.45).
  const [devZoom] = useState(() => Number(devHome.get("zoom")) || 1);
  const [donateOpen, setDonateOpen] = useState(() => devHome.get("sheet") === "donate");
  const [museumWings, setMuseumWings] = useState<MuseumWing[] | null>(null);
  const loadMuseumRef = useRef(false);
  const loadMuseum = useCallback(() => { apiCall<MuseumWing[]>("/api/collections/museum", "wings").then(setMuseumWings, () => {}); }, []);
  const [fading, setFading] = useState(false);
  // The world is revealed (and a door fade lifts) once WarmupProbe says the scene has loaded and compiled (hud-first-login §5).
  const [ready, setReady] = useState(false);
  const [sceneShown, setSceneShown] = useState(0);
  const onSceneReady = useCallback(() => { setReady(true); setFading(false); }, []);
  const [near, setNear] = useState<Near>(null);
  // Dev (screenshots): `?sheet=<name>` opens that sheet (the Oracle path sheet once progression loads; donate, shop and bag too).
  const [sheet, setSheet] = useState<Sheet>(() => (DEV_SHEETS.includes(devHome.get("sheet") as Sheet) ? devHome.get("sheet") as Sheet : null));
  const [shopTab, setShopTab] = useState<"outfits" | "furniture" | null>(() => (devHome.get("sheet") === "shop" ? "furniture" : null));
  // The clean HUD (row 283): the minimap opens on M.
  const [mapOpen, setMapOpen] = useState(false);
  const progression = useProgressionWorld();
  const plot = useDefaultIslandPlot(progression.completedGoals);
  const ceremony = useCeremony(progression.ceremonyGoal, progression.forceCeremony);
  const chapterActions = useChapterActions();
  // First login (row 211, hud-first-login §6): creator → arrival at the wharf → the HQ lead's greeting → the chapter 1 objective.
  const mine = useMyLook();
  const progressionLoaded = useProgression().loaded;
  const [welcomed, setWelcomed] = useState(() => readWelcomed() && devHome.get("welcome") !== "1");
  // idle → arriving (the dock fade) → the lead's line → done (greeted; she waits on the wharf) → gone (the scene changed).
  const [welcome, setWelcome] = useState<"idle" | "arriving" | number | "done" | "gone">("idle");
  const [objectiveNew, setObjectiveNew] = useState(false);
  const chapterFlags = useMemo(() => ({ claim: chapterActions.claim, donate: chapterActions.donate, report: chapterActions.report }),
    [chapterActions.claim, chapterActions.donate, chapterActions.report]);
  useEffect(() => { if (inside === "museum" && !loadMuseumRef.current) { loadMuseumRef.current = true; loadMuseum(); } if (inside !== "museum") loadMuseumRef.current = false; }, [inside, loadMuseum]);
  const peaceful = usePeacefulContext(weather, conditions.now);
  // Audio pass (row 169 / polish-ownership item 9): the hourly music player
  // follows the real clock everywhere on this island; cafe and other
  // interiors override the outdoor block with their own bed.
  const musicOverride = inside === "cafe" ? "cafe" : inside ? "interior" : null;
  useMusicDirector({ season: season.season, override: musicOverride });
  const ambientPhase: AmbientPhase = phase === "evening" ? "dusk" : phase;
  const [fishing, setFishing] = useState(false);
  const [bagOpen, setBagOpen] = useState(() => devHome.get("sheet") === "bag");
  const identity = useWorldIdentity();
  const step = welcomeStep({ lookLoaded: mine.loaded, lookSaved: mine.saved, signedIn: identity.signedIn || devHome.get("welcome") === "1", progressionLoaded, chapterFresh: chapterActions.claim, welcomed });
  const greeting = typeof welcome === "number" ? welcome : null;
  // Arriving or being greeted: the player holds still, so no prompt and no key hints.
  const welcoming = welcome === "arriving" || greeting !== null;
  const moveKeys = useMoveKeys(), abilityKeys = useAbilityKeys(), crouch = crouchKey(moveKeys, useKeyboardLocked());
  const touch = useCoarsePointer() || devHome.get("touch") === "1";
  // Mouse-look (specs/camera-orbit.md): the hint while the mouse is free, the crosshair while it looks in the ruins.
  const captured = useSyncExternalStore(subscribeCapture, readCapture, () => "off" as const);
  const { mouseLook } = useSyncExternalStore(subscribeOrbitPrefs, readOrbitPrefs, () => orbit.prefs);
  // The clean HUD (row 283): the full one while its key is held, in the pause view, on touch, or always by the setting.
  const alwaysFullHud = useAlwaysFullHud();
  const [hudKey, setHudKey] = useState(false);
  const [reveal, setReveal] = useState<{ family: Family; type: string; startedAt: number } | null>(null);
  // Bumped by the Oracle's path sheet after a subclass, loadout or stat change so the encounter re-reads them.
  const [pathTick, setPathTick] = useState(0);
  const [pathView, setPathView] = useState<ProgressionView | null>(null);
  // Classes v2 (§1.9): the subclass aura (its kit at its mastery, the equipped colour).
  const classAura = useMemo(() => {
    const c = pathView?.classes, kit = c?.kit ? classKit(c.kit) : null;
    return kit && c ? { kit, mastery: c.mastery.mastery, colour: c.cosmetics.aura === "mastery:colour" ? kit.look.ramp[0] : null } : null;
  }, [pathView]);
  useEffect(() => {
    const c = pathView?.classes, kit = classAura?.kit, f = c?.cosmetics.frame;
    setClassTag(kit && c ? { icon: kit.look.icon, title: c.title ?? kit.name, color: kit.look.ramp[1], frame: f === "mastery:bronze" ? "bronze" : f === "mastery:silver" ? "silver" : f === "mastery:gold" ? "gold" : null } : null);
  }, [pathView, classAura]);
  // Classes v2 (§1.13): P opens the Path sheet anywhere (the subclass, its kit and mastery, stats).
  const classesOn = !!pathView?.classes && !!pathView.family;
  useEffect(() => {
    if (!classesOn) return;
    const on = (e: KeyboardEvent) => {
      if (e.repeat || e.key.toLowerCase() !== "p" || worldKeysBlocked() || isTyping(e.target as Element)) return;
      setPathTick(n => n + 1); setSheet(s => (s === "path" ? null : s === null ? "path" : s));
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [classesOn]);
  // The tool wheel (specs/game-ui.md): what it holds, what you hold (this device's), your stock for the pins.
  const heldState = useHeld();
  const wheelKeys = useWheelKeys();
  const armed = useCombatValue(() => combat.rt.player.armed);
  const weaponList = useCombatValue(() => combat.rt.player.owned.join(","));
  const runtimeWeapon = useCombatValue(() => combat.rt.player.weapon);
  const [defaultWeapon, setDefaultWeapon] = useState<string | null>(null);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [level, setLevel] = useState<number>();
  useEffect(() => { let alive = true; void combatProgression().then(g => {
    if (!alive) return;
    setGate({ open: g.gateOpen, reason: g.gateOpen ? null : /^Sealed/.test(g.reason ?? "") ? g.reason : `Sealed. ${g.reason ?? ""}`.trim() });
    setPathView(g.view);
    setLevel(g.level);
    if (g.view) setHudXp(g.view.xp);
    // Progression feeds the encounter: stats, max HP, the subclass kit and loadout, weapon durability.
    const p = combat.rt.player;
    p.armed = g.gateOpen;
    if (g.stats) p.stats = g.stats;
    p.level = g.level;
    if (g.maxHp) { p.maxHp = g.maxHp; p.hp = Math.min(p.hp, g.maxHp); }
    // Classes v2 (the flag on and the subclass's family wave landed): its kit at its mastery; otherwise today's kit and loadout.
    const v2 = g.view?.classes?.kit ? classKit(g.view.classes.kit) : null;
    combat.rt.v2 = null;
    if (v2) { equipClassKit(combat.rt, v2, g.view!.classes!.mastery.mastery, g.view!.classes!.mastery, g.view?.traits ?? {}); Object.assign(combat.rt.v2!, { cosmetics: g.view!.classes!.cosmetics, skin: g.view!.classes!.skin }); }
    else equipKit(combat.rt, subclassByKey(g.subclass), g.view?.loadout ?? [], g.view?.traits ?? {});
    setOwnedWeapons(combat.rt, g.weapons);
    setDefaultWeapon(g.weapons.find(w => w.equipped)?.weapon_key ?? null);
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
  const liteMode = graphics.liteMode;
  const castShadows = graphics.shadows && !liteMode;
  const seasonRows = useSeasonPalettes();
  const seasonKey = JSON.stringify(season.weights);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value: the blend object is rebuilt every render.
  const look = useMemo(() => seasonLook(season, paletteBySeason(seasonRows)), [seasonKey, seasonRows]);
  const lookPreset = preset ?? CURRENT;
  // The key light follows the real sun (row 239); /lab/look's edited preset keeps its own sun sliders.
  const sun = preset ? null : conditions.sun;
  // Across a phase boundary the light blends continuously from one phase's look to the next (living-village §5).
  const blend = conditions.blend;
  const light = useMemo(() => withWeather(withSeason(islandLightAt(lookPreset, blend, sun), look), weather), [blend, look, weather, lookPreset, sun]);
  const conditionsLabel = `${season.season[0].toUpperCase()}${season.season.slice(1)}${Object.values(season.weights).some(w => w > 0 && w < 1) ? " (changing)" : ""} · ${weather[0].toUpperCase()}${weather.slice(1)}`;
  const grade = inside === "cafe" ? { ...CLUBHOUSE_LIGHTING[phase].grade, ...CAFE_GRADE } : inside ? CLUBHOUSE_LIGHTING[phase].grade : light.grade;
  const atHome = site === "home";
  const wheelSite: WheelSite = site === "ruins" ? "ruins" : atHome ? "home" : "village";
  const wheelItems = useMemo(() => wheelContents({ site: wheelSite, owned: peaceful.owned, chosen: heldState.chosen, weapons: weaponList.split(","), defaultWeapon, armed, pins: heldState.pins, stock }),
    [wheelSite, peaceful.owned, heldState.chosen, weaponList, defaultWeapon, armed, heldState.pins, stock]);
  // Indoors you walk with empty hands (the wheel is outdoors and in the ruins).
  const held = inside ? null : heldItem(heldState, wheelItems);
  const [eating, setEating] = useState(false);
  const act = useCallback((action: Near) => {
    if (action === "notice") { setSheet("notice"); return; }
    if (action === "cafe") { setSheet("cafe"); return; }
    if (action === "owner") { window.dispatchEvent(new CustomEvent("tsi:cafe-owner-talk")); return; }
    // The catch board's clues are the collection journal's.
    if (action === "catch") { setBagOpen(true); return; }
    if (action === "mailbox") { setSheet("letters"); return; }
    if (action === "curator") { setDonateOpen(true); return; }
    if (action === "display") { setSheet("trophies"); return; }
    if (action === "desk") { setSheet("showcase"); return; }
    // Stepping into the fitting room: its curtain sweeps across (FittingRoom), then the wardrobe opens.
    if (action === "fitting") { window.dispatchEvent(new CustomEvent("tsi:fitting")); window.setTimeout(() => setSheet("fitting"), FITTING_STEP_MS); return; }
    if (action === "closet") { setSheet(action); return; }
    if (action === "altar") { setReveal(null); setSheet("oracle"); return; }
    if (action === "missions") { setSheet("missions"); return; }
    if (action === "trophy" || action === "posters") { setSheet(action === "trophy" ? "tourney" : "posters"); return; }
    // Winter lights and the spring picnic: a moment, not a reward (principle 3: no rewards for online activity).
    if (action === "cocoa" || action === "picnic") {
      toast(action === "cocoa" ? "A hot cocoa, extra marshmallows. The windows fog up a little." : "Petals keep landing in the teacups. Somebody brought far too many sandwiches.", iconUrl(action === "cocoa" ? "lounge-tea" : "beach-towel"));
      return;
    }
    if (action === "lantern") { combat.rt.idol = "carried"; missionEvent(combat.rt, { type: "pickup", item: combat.rt.mission?.def.params.item ?? "old-lantern" }); publishCombat(); return; }
    if (action === "ruins" && !gate.open) { if (gate.reason) toast(gate.reason); return; }
    if (action === "buy") {
      void homeActions.buyRoom(homeActions.roomPrice() ?? ROOM_PRICE.coins).then(result => {
        if (result.ok) { setHudCoins(result.coins); toast(`A new room is ready. ${result.coins.toLocaleString()} TC left.`, iconUrl("home-bed")); }
        else toast(/unauthori[sz]ed/i.test(result.error) ? "Sign in to add a room." : result.error);
      });
      return;
    }
    // The rod, the net and the shovel are the held tool's left click (specs/game-ui.md §2); E picks things up by hand.
    if (action === "fish" || action === "net" || action === "dig") return;
    if (action === "forage") {
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
        if (error) toast(error);
        else if (action === "claim") toast("Plot claimed. Your island is waiting at the end of the pier.");
        else if (action === "donate") toast("Donated. The museum shell has its first exhibit.");
        else toast("Chapter complete: welcome to the island.");
      });
      return;
    }
    if (fading || !action || !["enter", "exit", "house", "home", "village", "museum_enter", "cafe_enter", "oracle_enter", "ruins", "ruins_exit"].includes(action)) return;
    setFading(true); setNear(null);
    // Doors sound as you go in and out (the café bell, row 125, replaces enter.ogg there when it lands); the boat has its own (arrival-wharf).
    if (action !== "home" && action !== "village") AudioManager.playSFX(action === "exit" || action === "ruins_exit" ? "exit" : "enter");
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
      // A fresh warm-up probe for the next scene: the fade lifts when it has loaded and compiled.
      setSceneShown(n => n + 1);
    }, 320);
  }, [fading, chapterActions, homeActions, inside, gate, layout]);
  // Arrive at the wharf: under the loading screen while it is up, otherwise through a short dock fade.
  useEffect(() => {
    if (step !== "welcome" || welcome !== "idle" || inside || site !== "village") return;
    const arrive = () => { setFromBoat(true); setReturned(false); setExitFrom(null); };
    setWelcome("arriving");
    if (!ready) { arrive(); return; }
    setFading(true);
    window.setTimeout(() => { arrive(); setSceneShown(n => n + 1); }, 320);
  }, [step, welcome, inside, site, ready]);
  // On the wharf with the fade lifted, the HQ lead starts talking.
  useEffect(() => {
    if (welcome !== "arriving" || !ready || fading) return;
    const t = window.setTimeout(() => setWelcome(0), 650);
    return () => window.clearTimeout(t);
  }, [welcome, ready, fading]);
  // Her voice on each line: three dialogue blips, as the café owner talks.
  useEffect(() => {
    if (greeting === null) return;
    AudioManager.playBlip();
    const blips = [140, 300].map(ms => window.setTimeout(() => AudioManager.playBlip(), ms));
    return () => blips.forEach(window.clearTimeout);
  }, [greeting]);
  // She stays on the wharf after the greeting until the scene changes under a fade.
  useEffect(() => {
    if (welcome === "done" && (inside || site !== "village")) setWelcome("gone");
  }, [welcome, inside, site]);
  useEffect(() => {
    if (!objectiveNew) return;
    const t = window.setTimeout(() => setObjectiveNew(false), 2600);
    return () => window.clearTimeout(t);
  }, [objectiveNew]);
  const finishWelcome = useCallback(() => {
    markWelcomed(); setWelcomed(true); setWelcome("done"); setObjectiveNew(true);
    AudioManager.playSFX("confirm");
  }, []);
  const nextLine = useCallback(() => {
    if (greeting === null) return;
    if (greeting + 1 < HQ_LEAD.lines.length) setWelcome(greeting + 1);
    else finishWelcome();
  }, [greeting, finishWelcome]);
  // The forage/net prompt names the nearest node, re-read when it changes (it used to keep the first node's name).
  const targetLabel = useSyncExternalStore(subscribePeacefulLabel, peacefulLabel, () => null);
  // ── The tool wheel (specs/game-ui.md) ──
  // Your stock (the pins show while you have some): the server's rows with this browser's record, re-read after a catch or a snack.
  useEffect(() => {
    const load = () => {
      fetch("/api/collections").then(r => (r.ok ? r.json() : null)).then((d: { collections?: { item_key: string; count: number }[] } | null) =>
        setStock(mergeWithLocal(Object.fromEntries((d?.collections ?? []).map(r => [r.item_key, r.count]))))).catch(() => setStock(localCollections()));
    };
    load();
    const events = ["tsi:peaceful-got", "tsi:fish-caught", "tsi:eaten", "tsi:crafted"];
    events.forEach(e => window.addEventListener(e, load));
    return () => events.forEach(e => window.removeEventListener(e, load));
  }, []);
  // In the ruins a weapon is always in hand: what you held outside isn't on its wheel. Elsewhere a held item that isn't
  // on the wheel just isn't shown (your inventory and stock load after the island), never dropped.
  useEffect(() => {
    if (site === "ruins") settleHeld(wheelItems, `weapon:${combat.rt.player.weapon}`);
    if (site === "ruins" && !readHeld().held) holdItem(`weapon:${combat.rt.player.weapon}`);
  }, [wheelItems, site]);
  // A weapon from the wheel goes in hand (and, picked outside a fight's quick swap, becomes your default on the server);
  // R's swap back in the ruins moves the wheel with it.
  useEffect(() => {
    if (held?.kind !== "weapon" || !setWeapon(combat.rt, held.key)) return;
    publishCombat();
    void apiCall("/api/combat/equip", "equip", { weapon: held.key }).catch(() => {});
  }, [held]);
  useEffect(() => { if (site === "ruins" && readHeld().held !== `weapon:${runtimeWeapon}`) holdItem(`weapon:${runtimeWeapon}`); }, [site, runtimeWeapon]);
  // What's in reach for the held tool, and what left click does with it.
  const reach: Reach = useMemo(() => ({ water: near === "fish", bug: near === "net" ? targetLabel : null, dig: near === "dig" ? targetLabel : null }), [near, targetLabel]);
  const toolAction = clickAction(held, reach, wheelSite);
  const applyTool = useCallback(() => {
    if (site === "ruins" || inside || fishing || sheet || bagOpen || decor.decorating || welcoming || fading || eating || !held || !toolAction) return;
    const at: [number, number] = [player.current.x, player.current.z];
    const clip = (name: string) => window.dispatchEvent(new CustomEvent("tsi:emote", { detail: { clip: name } }));
    if (toolAction.verb === "cast") {
      const spot = fishSpot.current;
      // Hold to charge, let go to cast (FishingOverlay); the server rolls on the held rod (its tier) from where you stand.
      if (spot) window.dispatchEvent(new CustomEvent("tsi:fish-start", { detail: { x: spot.target[0], z: spot.target[1], water: spot.water, site: atHome ? "home" : "village", from: at } }));
      return;
    }
    if ((toolAction.verb === "swing" || toolAction.verb === "dig") && toolAction.target) {
      const target = getPeacefulTarget();
      if (target) window.dispatchEvent(new CustomEvent("tsi:peaceful-act", { detail: { id: target.id, tool: held.key } }));
      return;
    }
    if (toolAction.verb === "swing") { clip("Net"); AudioManager.playSFX("blip4", { rate: 0.8, gain: 0.45 }); return; }
    if (toolAction.verb === "dig") { clip("Dig"); window.setTimeout(() => AudioManager.playSFX("footstep", { rate: 0.6, gain: 0.7 }), 540); return; }
    if (toolAction.verb === "attack") {
      const kind = WEAPONS[held.key]?.kind;
      clip(kind === "bow" ? "AttackBow" : kind === "staff" || kind === "summon" ? "AttackCast" : "AttackMelee");
      AudioManager.playSFX("blip4", { rate: 1.1, gain: 0.5 });
      return;
    }
    // Eat: up to the mouth, two bites (the snack goes on the second), a chew; the next one comes out if you have more.
    setEating(true);
    clip("Eat");
    [480, 840].forEach(ms => window.setTimeout(() => AudioManager.playSFX("blip1", { rate: 1.35, gain: 0.4 }), ms));
    const key = held.key;
    void eatItem(key).then(r => {
      if (!r.ok) toast(r.error); else window.dispatchEvent(new CustomEvent("tsi:eaten", { detail: { key, count: r.count } }));
      if (r.ok && r.count === 0) holdItem(null); // the last one: empty hands
      window.setTimeout(() => setEating(false), 820);
    });
  }, [site, inside, fishing, sheet, bagOpen, decor.decorating, welcoming, fading, eating, held, toolAction, atHome, player]);
  // Left click uses what you hold: in mouse-look, or with the mouse-look setting off (a touch screen uses the prompt).
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const down = (e: PointerEvent) => { if (e.button === 0 && e.pointerType === "mouse" && (capture.state === "captured" || capture.state === "off")) applyTool(); };
    el.addEventListener("pointerdown", down);
    return () => el.removeEventListener("pointerdown", down);
  }, [applyTool]);
  const toolNear = near === "fish" || near === "net" || near === "dig";
  // Dev (screenshots without pointer lock): ?hud=clean shows the HUD as it is while exploring in mouse-look.
  const full = isFullHud({ always: alwaysFullHud, keyHeld: hudKey, touch, capture: devHome.get("hud") === "clean" ? "captured" : captured });
  // Hold the HUD key (H) for the full HUD.
  useEffect(() => {
    const key = wheelKeys.hud;
    const down = (e: KeyboardEvent) => { if (e.key.toLowerCase() === key && !e.repeat && !(e.target instanceof HTMLElement && e.target.closest("input, textarea, select"))) setHudKey(true); };
    const up = (e: KeyboardEvent) => { if (e.key.toLowerCase() === key) setHudKey(false); };
    const blur = () => setHudKey(false);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, [wheelKeys.hud]);
  // In the clean HUD the place name shows as a scene comes in, the objective when it changes.
  const headingFlash = useFlash(ready ? sceneShown + 1 : 0, FLASH_MS.heading);
  const objectiveFlash = useFlash(progression.objective.text ?? null, FLASH_MS.objective);
  const needTool = toolNear ? toolNeeded(held, reach) : null;
  // Decorating, the dev panel and the greeting work with the cursor: mouse-look lets go while they are up.
  useEffect(() => { holdCursor("decorate", decor.decorating); holdCursor("greeting", welcoming); holdCursor("options", optionsOpen); }, [decor.decorating, welcoming, optionsOpen]);
  useEffect(() => () => { holdCursor("decorate", false); holdCursor("greeting", false); holdCursor("options", false); }, []);
  const greetingName = identity.display_name !== "You" ? identity.display_name : null;
  const holdObjective = step === "creator" || step === "welcome" || welcome === "arriving" || greeting !== null;
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      // The greeting box takes E, Enter and Space to go on, Escape to skip (principle 7: skippable in one press).
      if (greeting !== null && !event.repeat) {
        if (["e", "enter", " "].includes(event.key.toLowerCase())) { event.preventDefault(); nextLine(); }
        else if (event.key === "Escape") finishWelcome();
        return;
      }
      // Menus follow the account's key bindings (row 220); Escape is fixed.
      const menu = actionForKey(identity.settings, event.key);
      // A dialog is open (lib/game/useWorldDialog): it takes Escape and its own key; the world holds still, and only
      // the tab keys go through, to the top dialog's tabs.
      if (worldKeysBlocked()) {
        if (!event.repeat && (menu === "nextTab" || menu === "prevTab")) window.dispatchEvent(new CustomEvent("tsi:menu-tab", { detail: { step: menu === "nextTab" ? 1 : -1 } }));
        return;
      }
      // Letters in a text field are typing; a focused HUD button doesn't swallow the world's keys any more.
      if (event.repeat || isTyping(event.target as Element)) return;
      if (event.key.toLowerCase() === "e") act(near);
      if (event.key.toLowerCase() === "z" && !inside && !(site === "ruins" && Object.values(abilityKeys).includes("z"))) { toggleZoom(); saveOrbit(); }
      if (menu === "openMap") setMapOpen(value => !value);
      // The naming pass (menus §4): B the Collection (catches), I the Bag (items), K the wallet, J the Journal (quests).
      if (menu === "openJournal") setBagOpen(true);
      if (menu === "openBag") setSheet("bag");
      if (menu === "openWallet") setSheet("wallet");
      if (!menu && event.key.toLowerCase() === "j") setSheet("journal");
      if (menu === "openMail") setSheet("letters");
      // The Esc that ended mouse-look capture is the browser's; a later one closes things (specs/camera-orbit.md), and in a
      // room with nothing open it leaves by the door (interiors §5; lib/game/sceneGate.ts).
      if (event.key === "Escape") {
        const open = !!sheet || bagOpen || donateOpen || !!shopTab || decor.decorating || !!(reveal && inside === "oracle") || studyHoldsPrompt() || !!document.querySelector('[role="dialog"]');
        const esc = escapeAction({ captureEnded: escapeEndedCapture(), fading, open, inside: !!inside });
        if (esc === "close") { setSheet(null); if (decor.selected) decor.cancel(); }
        if (esc === "exit") act("exit");
      }
      if (atHome && event.key.toLowerCase() === "f") decor.toggle();
      if (decor.decorating && event.key.toLowerCase() === "r") decor.rotateSelected();
      if (decor.decorating && event.key.toLowerCase() === "x") decor.putAway();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [act, near, inside, atHome, decor, identity.settings, greeting, nextLine, finishWelcome, site, abilityKeys, sheet, bagOpen, donateOpen, shopTab, reveal, fading]);
  return (
    <main className={`${styles.world} gui`} data-light={phase} data-inside={inside ?? undefined} data-site={site}>
      <Canvas ref={canvasRef} tabIndex={0} role="application" aria-label="Island walking area" style={{ zIndex: 0, imageRendering: graphics.pixelated ? "pixelated" : "auto" }} gl={{ antialias: false, powerPreference: "high-performance" }} dpr={graphics.pixelated ? 0.5 : [1, 1.5]}
        camera={{ position: [0, 10.2, -21], fov: BASE_FOV, near: 0.1, far: 120 }} shadows={castShadows ? "percentage" : false}
        onCreated={({ gl }) => { gl.info.autoReset = false; gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
        <Suspense fallback={null}>
          {site === "ruins" ? <RuinsScene key={`ruins-${ruinsRun}`} level={level} phase={phase} light={light} look={look} weather={weather} liteMode={liteMode} castShadows={castShadows} zoom={devZoom} player={player}
              onNear={n => setNear(n === "exit" ? "ruins_exit" : n)} onDefeat={onRuinsDefeat} start={ruinsRun <= 1 ? devAt : null} glider={peaceful.glider} />
            : inside === "oracle" ? <OracleTemple frozen={fading || sheet === "oracle"} talking={sheet === "oracle"} light={light} player={player} onNear={n => setNear(n)} ceremony={reveal} />
            : inside === "cafe" ? <CafeInterior phase={phase} player={player} frozen={fading || !!sheet} identity={identity} level={level} onNear={setNear} />
            : inside === "museum" ? <MuseumInterior wings={museumWings} frozen={fading || donateOpen} talking={donateOpen} light={light} player={player} onNear={n => setNear(n === "donate" ? "curator" : n)} />
            : inside === "hq" ? <Clubhouse phase={phase} light={light} player={player} frozen={fading} talking={sheet === "showcase"} onNear={setNear} />
            : inside === "house" ? <HomeInterior layout={layout} phase={phase} light={light} frozen={fading} player={player} onNear={(n: HouseNear) => setNear(n)}
              decorating={decor.decorating} selected={decor.selected} onPlace={decor.place} onPickUp={decor.pickUp} />
            : atHome ? <HomeIslandScene held={eating ? null : held} identity={identity} level={level} peaceful={peaceful} fishSpot={fishSpot} fishing={fishing} phase={phase} light={light} look={look} weather={weather} liteMode={liteMode} castShadows={castShadows} zoom={devZoom}
              overview={overview} returned={returned} player={player} onNear={(n: HomeNear) => setNear(n)} outdoor={layout.outdoor}
              decorating={decor.decorating} selected={decor.selected} onPlace={item => decor.place("outdoor", item)} onPickUp={item => decor.pickUp("outdoor", item)} />
            : <IslandScene held={eating ? null : held} identity={identity} level={level} devAt={devAt} exitFrom={exitFrom} peaceful={peaceful} fishSpot={fishSpot} fishing={fishing} chapter={chapterFlags} fromBoat={fromBoat} progression={progressionWorld} ceremony={ceremony} event={islandEvent}
              lead={welcoming || welcome === "done" ? { line: greeting, hold: welcoming } : null} phase={phase} light={light} look={look} weather={weather} overview={overview} zoom={welcoming ? 0.7 : devZoom} reset={reset} returned={returned} liteMode={liteMode} castShadows={castShadows} player={player} onNear={setNear} />}
          {/* Classes v2: the subclass's aura replaces the family's once its kit exists (§1.9). */}
          {identity.aura && (classAura ? <Suspense fallback={null}><SubclassAura player={player} kit={classAura.kit} mastery={classAura.mastery} colour={classAura.colour} /></Suspense>
            : identity.family && <Suspense fallback={null}><FamilyAura player={player} color={FAMILIES[identity.family].light} /></Suspense>)}
          <PostFX antialias={!graphics.liteMode && !graphics.pixelated} grade={grade} fx={lookFx(lookPreset, !liteMode)} />
          <LookMaterials preset={lookPreset} />
          <SunShadows />
          <Performance player={player} output={perfOutput} />
          <QualityProbe onTier={onTier} />
          <WarmupProbe key={sceneShown} onReady={onSceneReady} />
          {children}
          {!inside && !atHome && site !== "ruins" && near !== "enter" && hqDoor && <Html position={[hqDoor[0], 2.9, hqDoor[1]]} center distanceFactor={10} zIndexRange={[3, 0]}>
            <div className={styles.cue}>HQ</div>
          </Html>}
        </Suspense>
      </Canvas>
      <header className={styles.heading} data-fading={fading || !ready || (!full && headingFlash === null)} data-clean={full ? undefined : ""}>
        <h1>{site === "ruins" ? "The ruins" : inside === "oracle" ? "Oracle temple" : inside === "museum" ? "Museum" : inside === "cafe" ? "Café" : inside === "hq" ? "HQ" : inside === "house" ? "Your house" : atHome ? "Your island" : "Tethos Island"}</h1>
        <p>{inside === "cafe" ? "Warm drinks and quiet tables. Find a seat to study." : !inside && !atHome && site === "village" && islandEvent ? `${islandEvent.goal.title} is on.` : "A little space to make our own."}</p>
      </header>
      {/* Top right (hud-first-login §1, §2): coins, level, clock and mail, then sound and the view options; panels open below it. */}
      <TopCluster full={full} weather={weather} phase={phase} unread={progression.unreadLetters} mailKey={keyName(identity.settings.key_bindings.openMail)} onMail={() => setSheet("letters")}>
        <AudioController phase={ambientPhase} weather={weather} season={season.season} className={hudButton} />
        <button className={hudButton} onClick={() => setSheet(value => (value === "settings" ? null : "settings"))} aria-label="Settings" title="Settings: text, sound, keys, look"><Settings size={18} aria-hidden /></button>
        {/* Development only: camera, time of day, the clearing reset and frame timing (hud-first-login §4). */}
        {DEV && <button ref={optionsToggleRef} className={hudButton} aria-expanded={optionsOpen} aria-controls="island-options" onClick={() => setOptionsOpen((open) => !open)} aria-label="Developer view options" title="Developer view options"><Wrench size={17} aria-hidden /></button>}
      </TopCluster>
      {DEV && <section id="island-options" className={styles.panel} data-open={optionsOpen} aria-label="Developer view options" onKeyDown={(event) => {
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
        <label className={styles.preset}>
          <span>Time</span>
          <select value={forced ?? "live"} onChange={(e) => setForced(e.target.value === "live" ? null : e.target.value as IslandPhase)}>
            <option value="live">Live, as in Toronto · {PHASE_NAMES[conditions.livePhase]}</option>
            {ISLAND_PHASES.map((key) => <option key={key} value={key}>{PHASE_NAMES[key]}</option>)}
          </select>
        </label>
        <p className={styles.hint} data-testid="island-conditions">{conditionsLabel}{conditions.sunSource === "fallback" ? " · sun table" : ""}</p>
        <button className={styles.return} onClick={() => { setInside(null); setSite("village"); setReturned(false); setReset((n) => n + 1); setOverview(false); }}>Return to clearing</button>
        <details className={styles.performance} open>
          <summary>Frame timing</summary>
          <output ref={perfOutput}>Measuring…</output>
        </details>
      </section>}
      {near && !toolNear && !sheet && !welcoming && !(reveal && inside === "oracle") && (CLOSED.includes(near)
        ? <p className={styles.interact} data-closed="true" role="status">{NEAR_LABELS[near]}</p>
        : fishing ? null : <button className={styles.interact} onClick={() => act(near)}><kbd>E</kbd>{near === "forage" ? targetLabel ?? NEAR_LABELS[near] : NEAR_LABELS[near]}</button>)}
      {/* The held item's use (specs/game-ui.md §2): what left click does with it here, or the tool something in reach wants. Touch presses the prompt. */}
      {!sheet && !welcoming && !fishing && !inside && site !== "ruins" && (toolAction && (toolAction.target && (toolNear || toolAction.verb === "eat"))
        ? <button className={styles.interact} data-use onPointerDown={e => { if (e.pointerType !== "mouse" || capture.state !== "captured") applyTool(); }}><kbd>{touch ? "Tap" : "Click"}</kbd>{toolAction.label}</button>
        : needTool && <p className={styles.interact} data-closed="true" role="status"><kbd>{touch ? "Wheel" : keyName(wheelKeys.wheel)}</kbd>Take out your {needTool === "rod" ? "fishing rod" : needTool}</p>)}
      <FishingOverlay rod={held?.kind === "rod" && held.tier ? rodByTier(held.tier) : peaceful.rod} onActiveChange={setFishing} />
      <ToolWheel items={wheelItems} held={heldState.held} wheelKey={wheelKeys.wheel} touch={touch} onEquip={holdItem} onSwap={() => swapHeld(wheelItems)}
        enabled={ready && !inside && !fishing && !sheet && !bagOpen && !welcoming && !fading && !decor.decorating && !shopTab} />
      <DonateSheet open={donateOpen} onClose={() => setDonateOpen(false)} onDonated={loadMuseum} />
      <ToastHub />
      {/* Today's gift once the island is showing and nothing else holds the player (first login, a fade, a sheet, a fight). */}
      <DailyGift ready={ready && !fading && !holdObjective && !sheet && site !== "ruins"} />
      {greeting !== null && <div className={styles.greeting} data-welcome>
        <NPCDialogue key={greeting} speaker={`${HQ_LEAD.name} · ${HQ_LEAD.post}`} onContinue={nextLine} continueLabel={greeting + 1 < HQ_LEAD.lines.length ? "Next" : "Let’s go"}>
          <p>{HQ_LEAD.lines[greeting].replace(", {name}", greetingName ? `, ${greetingName}` : "")}</p>
        </NPCDialogue>
        <button className={styles.greetingSkip} onClick={finishWelcome}>Skip</button>
      </div>}
      {/* Study tables are in the village and the café only: the HUD (its polling and session) lives there. */}
      {(inside === "cafe" || (!inside && site === "village")) && <StudyHud />}
      <CraftingSheet />
      <CollectionBook open={bagOpen} onClose={() => setBagOpen(false)} keys={identity.settings.key_bindings.openJournal} />
      {!bagOpen && full && <button className={styles.bagButton} onClick={() => setBagOpen(true)} aria-label="Open your collection"><kbd>{keyName(identity.settings.key_bindings.openJournal)}</kbd> Collection</button>}
      {!inside && !atHome && site !== "ruins" && !holdObjective && <div className={styles.minimap} data-minimap data-new={objectiveNew || undefined}>
        {mapOpen ? <MiniMap playerPosRef={player} plot={objectivePlot} toggleKey={identity.settings.key_bindings.openMap} onClose={() => setMapOpen(false)} />
          : full && <button className={styles.mapButton} onClick={() => setMapOpen(true)} aria-label="Show the island map"><MapIcon size={17} aria-hidden /><kbd>{keyName(identity.settings.key_bindings.openMap)}</kbd> Map</button>}
        {progression.objective.text && (full || mapOpen || objectiveNew || objectiveFlash) && <p className={styles.objective} data-testid="objective" data-flash={full ? undefined : objectiveFlash ?? undefined}><span aria-hidden="true">◆</span> {progression.objective.text}</p>}
      </div>}
      <CeremonyConfetti active={ceremony && !inside && !atHome} />
      {atHome && !decor.decorating && full && <button className={styles.decorateToggle} onClick={decor.toggle}><kbd>F</kbd> Decorate</button>}
      {atHome && decor.decorating && !shopTab && <DecorateSheet indoor={inside === "house"} selected={decor.selected} layout={layout}
        room={inside === "house" ? layout.rooms[roomAt(player.current.x, layout.rooms.length)] ?? null : null}
        onChoose={decor.choose} onRotate={decor.rotateSelected} onPutAway={decor.putAway} onDone={decor.toggle}
        onFinish={(key, value) => decor.setRoomFinish(roomAt(player.current.x, layout.rooms.length), key, value)} onShop={() => setShopTab("furniture")} />}
      {/* Locked wardrobe items and the decorate panel link here; closing remounts them with the new inventory. */}
      <ProgressionPanel open={!!shopTab} onClose={() => setShopTab(null)} title="Shop" wide>{shopTab && <ShopBody initialTab={shopTab} />}</ProgressionPanel>
      <NoticeSheet open={sheet === "notice"} onClose={() => setSheet(null)} keys={STATION_KEY} />
      <LettersSheet open={sheet === "letters"} onClose={() => setSheet(null)} keys={identity.settings.key_bindings.openMail} />
      <InventorySheet open={sheet === "bag"} onClose={() => setSheet(null)} keys={identity.settings.key_bindings.openBag} />
      <WalletSheet open={sheet === "wallet"} onClose={() => setSheet(null)} keys={identity.settings.key_bindings.openWallet} />
      {(sheet === "closet" || sheet === "fitting") && <WardrobeSheet open place={sheet === "closet" ? "closet" : "fitting"} onClose={() => { if (sheet === "fitting") window.dispatchEvent(new CustomEvent("tsi:fitting")); setSheet(null); }} onShop={() => { setSheet(null); setShopTab("outfits"); }} />}
      <PlayerCharacterUI />
      <JournalSheet open={sheet === "journal"} onClose={() => setSheet(null)} keys="j" />
      <OracleQuizSheet open={sheet === "oracle"} onClose={() => setSheet(null)} onResult={onOracleResult} onPath={pathView?.family ? () => { setPathTick(n => n + 1); setSheet("path"); } : undefined} />
      {sheet === "path" && pathView && <PathSheet view={pathView} onClose={() => setSheet(null)} onChanged={() => setPathTick(n => n + 1)} />}
      <SettingsSheet open={sheet === "settings"} onClose={() => setSheet(null)} detectedTier={detectedTier} />
      {reveal && inside === "oracle" && <FamilyReveal family={reveal.family} type={reveal.type} onContinue={() => setReveal(null)} />}
      <TrophySheet open={sheet === "trophies"} onClose={() => setSheet(null)} />
      <ShowcaseSheet open={sheet === "showcase"} onClose={() => setSheet(null)} />
      <MissionBoardSheet open={sheet === "missions"} onClose={() => setSheet(null)} gateNote={gate.open ? null : gate.reason} />
      <TourneySheet open={sheet === "tourney"} onClose={() => setSheet(null)} />
      <PostersSheet open={sheet === "posters"} onClose={() => setSheet(null)} event={islandEvent} />
      <CafeGoalSheet open={sheet === "cafe"} onClose={() => setSheet(null)} />
      {site === "ruins" && <CombatHud player={player} />}
      {welcoming || !full ? null : site === "ruins" ? <div className={styles.controls} data-combat><span>{[moveKeys.forward, moveKeys.left, moveKeys.back, moveKeys.right].map(k => <kbd key={k}>{keyName(k)}</kbd>)} Move</span><span>{mouseLook ? "Mouse Look and aim" : "Mouse Aim"}</span><span>Click Attack</span>{mouseLook && <span>Hold right-click Cursor</span>}<span><kbd>←</kbd><kbd>→</kbd> Turn</span><span><kbd>{keyName(RESET_VIEW_KEY)}</kbd> Reset view</span><span><kbd>{keyName(moveKeys.jump)}</kbd> Jump</span><span><kbd>{keyName(moveKeys.dash)}</kbd> Dodge</span>{crouch && <span><kbd>{keyName(crouch)}</kbd> Slide</span>}<span>{(combat.rt.v2 ? V2_SLOT_IDS : SLOT_IDS).map(s => <kbd key={s}>{keyName(abilityKeys[s])}</kbd>)} Abilities</span>{combat.rt.v2 && <span><kbd>{keyName(abilityKeys.ult)}</kbd> Ultimate</span>}<span><kbd>{keyName(wheelKeys.wheel)}</kbd> Weapons</span><span><kbd>{keyName(abilityKeys.swap)}</kbd> Previous weapon</span><span><kbd>E</kbd> Interact</span></div>
      // Indoors you walk (cafe-polish §4): no run, jump, dash, zoom or map.
      : inside ? <div className={styles.controls}><span>{[moveKeys.forward, moveKeys.left, moveKeys.back, moveKeys.right].map(k => <kbd key={k}>{keyName(k)}</kbd>)} Walk</span><span><kbd>E</kbd> Interact</span><span><kbd>J</kbd> Journal</span><span><kbd>{keyName(identity.settings.key_bindings.openJournal)}</kbd> Collection</span><span><kbd>{keyName(identity.settings.key_bindings.openBag)}</kbd> Bag</span></div>
      : <div className={styles.controls}><span>{[moveKeys.forward, moveKeys.left, moveKeys.back, moveKeys.right].map(k => <kbd key={k}>{keyName(k)}</kbd>)} Walk</span><span><kbd>{keyName(moveKeys.sprint)}</kbd> Run</span><span><kbd>{keyName(moveKeys.jump)}</kbd> Jump</span>{peaceful.glider && <span><kbd>{keyName(moveKeys.jump)}</kbd> again in the air Glide</span>}<span><kbd>{keyName(moveKeys.dash)}</kbd> Dash</span><span><kbd>E</kbd> Interact</span><span><kbd>{keyName(wheelKeys.wheel)}</kbd> Tools</span><span>Click Use</span><span>{mouseLook ? "Mouse or " : ""}<kbd>←</kbd><kbd>→</kbd> Look</span>{mouseLook && <span>Hold right-click Cursor</span>}<span><kbd>{keyName(RESET_VIEW_KEY)}</kbd> Reset view</span><span><kbd>Z</kbd> Zoom</span><span><kbd>{keyName(identity.settings.key_bindings.openMap)}</kbd> Map</span><span><kbd>J</kbd> Journal</span><span><kbd>{keyName(identity.settings.key_bindings.openJournal)}</kbd> Collection</span><span><kbd>{keyName(identity.settings.key_bindings.openBag)}</kbd> Bag</span>{crouch && <span><kbd>{keyName(crouch)}</kbd> Crouch, at speed slide</span>}</div>}
      {/* Clear of the minimap (left) and the audio widget (bottom right). */}
      {touch && (!inside || inside === "cafe") && <TouchControls left="var(--hud-stick-left)" bottom="var(--hud-stick-bottom)" walkOnly={inside === "cafe"} />}
      <p className={styles.touchControls}>Tap the ground to move · two fingers turn the camera</p>
      {captured === "free" && !touch && <p className={styles.lookHint} role="status">Click to look around</p>}
      {captured === "captured" && site === "ruins" && <svg className={styles.crosshair} viewBox="-10 -10 20 20" aria-hidden="true"><circle r="5.5" /><circle r="1.2" /></svg>}
      <div className={styles.fade} data-active={fading} aria-hidden="true" />
      <LoadingStatus ready={ready} />
    </main>
  );
}
