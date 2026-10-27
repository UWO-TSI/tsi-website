"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import * as THREE from "three";
import { Menu, Settings } from "lucide-react";
import { Toggle } from "@/components/gui";
import GridWorld from "./grid/GridWorld";
import GridOcean from "./grid/GridOcean";
import Seabed from "./water/Seabed";
import WaterContacts from "./water/WaterContacts";
import { cliffBoulders, ROCK_SIZE } from "@/lib/game/rocks";
import GlassWater from "./water/GlassWater";
import DecorativeFish from "./water/DecorativeFish";
import PlayerAvatar from "./PlayerAvatar";
import Residents from "./NPC";
import GameSceneBoundary from "./GameSceneBoundary";
import PostFX from "./PostFX";
import SunShadows from "./SunShadows";
import PerfProbe from "./PerfProbe";
import QualityGovernor from "./QualityGovernor";
import { FadeLight, GlowingLamps, LampGlow, LampPool, Lanterns, lampLight } from "./AmbientProps";
import { GLBProp, sceneryOf } from "./NatureModels";
import { InstancedModels, MergedModels } from "./InstancedNature";
import { ACNHBuilding, ACNHHouses, ACNHParts, CHALET_VARIANTS, type PartsPlacement } from "./ACNHBuilding";
import { FenceLine } from "./NatureModels";
import { BRIDGE_URL, CATCH_BOARD_URL, MAILBOX_URL, MONUMENT_SIGN_URL, NEW_LAMPS, NOTICE_BOARD_URL, STREETLAMP_URL } from "@/lib/game/propModels";
import Wharf from "./wharf/Wharf";
import TripVeil from "./wharf/TripVeil";
import { tripSceneReady, useTripControl } from "./wharf/useTripControl";
import { myTrip } from "@/lib/game/myTrip";
import type { TripPlace } from "@/lib/game/boatTrip";
import { HOME_PIER } from "@/lib/game/homeIsland";
import FittingRoom, { FITTING_STEP_MS } from "./FittingRoom";
import { BASE_FOV } from "./movement/moveFx";
import MiniMap, { MapSheet } from "./MiniMap";
import { useDefaultIslandPlot } from "./DefaultIslandMap";
import LettersSheet from "@/components/progression/LettersSheet";
import NoticeSheet from "@/components/progression/NoticeSheet";
import JournalSheet from "@/components/progression/JournalSheet";
import { useProgressionWorld, useCeremony, useChapterActions, type WorldGoalId } from "@/lib/game/progressionBridge";
import confetti from "canvas-confetti";
import type { InteriorStation } from "./interiorShared";
import { villageIsland, villageSpawn, villageScale, landmark, landmarks, landmarkPoint, turn, wharfDecks, wharfDock, benchSeat, propFootprint, BENCH_SEAT_TOP, houseHalf, houseModel, type Landmark } from "@/lib/game/defaultIsland";
import { village, objectsOf, type Village } from "@/lib/game/villageMap";
import { SELL_BARREL } from "@/lib/game/wharf";
import { LEVEL_STEP, levelAt, worldToCellX, worldToCellZ } from "@/lib/game/grid";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { CLUBHOUSE_LIGHTING, ISLAND_TERRAIN, islandLightAt, smoothWorldLight, weatherLight, windowLit, withSeason, type IslandLight } from "@/lib/game/islandLighting";
import { SEASON_TREES, paletteBySeason, seasonLook, type SeasonLook } from "@/lib/game/seasonalLook";
import { useNPCPersonas, useSeasonPalettes } from "@/lib/content/loader";
import type { IslandWeather } from "@/lib/game/islandWeather";
import { useIslandConditions } from "@/lib/game/useIslandConditions";
import { IslandAtmosphere, useFollowCamera, type TreeSpot } from "./IslandAtmosphere";
import PeacefulLayer, { peacefulNear } from "./peaceful/PeacefulLayer";
import WardrobeSheet from "./peaceful/WardrobeSheet";
import { SellSheet, WalletSheet } from "@/components/economy/EconomySheets";
import { BagSheet } from "./Bag";
import { ChestSheet } from "./ChestSheet";
import { BagButton } from "./BagButton";
import { bagRoom } from "@/lib/game/bagStore";
import { isTyping, worldKeysBlocked } from "@/lib/game/useWorldDialog";
import { apiCall } from "@/lib/apiClient";
import PlayerCharacterUI from "./character/PlayerCharacterUI";
import EmoteWheel from "./emotes/EmoteWheel";
import Campfire from "./campfire/Campfire";
import DanceSync from "./dance/DanceSync";
import { playWheelEntry } from "@/lib/game/emotePlay";
import { campfireSite } from "@/lib/game/campfireSite";
import { useCreatorOpen } from "@/lib/game/character/creatorPresence";
import CharacterCrowd from "./character/CharacterCrowd";
import OracleTemple from "./oracle/OracleTemple";
import RuinsScene from "./combat/RuinsScene";
import CombatHud from "./combat/CombatHud";
import { PlaytestControls, PlaytestHud } from "./combat/Playtest";
import MissionBoardSheet from "./combat/MissionBoardSheet";
import { attachProgressId, combat, publishCombat, setMission, setOwnedWeapons, useCombatValue } from "@/lib/game/combat/runtime";
import { missionEvent } from "@/lib/game/combat/abilities";
import { combatProgression, postWear, startMissionRemote, type ProgressionView } from "@/lib/game/combat/progression";
import { equipKit } from "@/lib/game/combat/abilities";
import { equipClassKit } from "@/lib/game/combat/classRuntime";
import { beastKit, setTamed } from "@/lib/game/combat/beasts";
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
import { keyName, useAbilityKeys, useMoveKeys } from "@/lib/game/movement/keys";
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
import RewardCard from "./RewardCard";
import GlideGuide, { GlideGuideHint } from "./GlideGuide";
import BorderNotice from "./BorderNotice";
import ShopInterior from "./ShopInterior";
import InteriorBackdrop from "./InteriorBackdrop";
import ShopCounter from "./ShopCounter";
import ShopkeeperChoice, { MERCH_LINE, type ShopSection } from "./ShopkeeperChoice";
import IslandLoading from "./IslandLoading";
import { loadGameWorld } from "@/lib/game/world/load";
import { GAME_WORLD, worldModel } from "@/lib/game/world/active";
import TalkBox from "./TalkBox";
import { emptyTalkView, onTalkEnd, requestTalk, subscribeTalk, talkStore, talkView } from "@/lib/game/residentTalk";
import DailyGift from "./DailyGift";
import { markWelcomed, welcomeStep } from "@/lib/game/welcome";
import Arrival from "./arrival/Arrival";
import ArrivalWorld, { crateSpots, placeWorld, withCrates } from "./arrival/ArrivalWorld";
import { arrivalEvent, bramNear, bramPrompt, useArrivalPhase, useArrivalTools, useTutorialQuest } from "@/lib/game/arrival/arrivalStore";
import { routeFor } from "@/lib/game/arrival/routes";
import { gateWheel } from "@/lib/game/arrival/tools";
import { postArrival, useArrivalFlag } from "@/lib/game/arrival/arrivalFlag";
import { BRAM, TUTORIAL_REWARD, type HintKeys } from "@/lib/game/arrival/lines";
import { useMoveUnlocks } from "@/lib/game/moveUnlocks";
import { loadFriends, talkedTo } from "@/lib/game/friendship";
import { isCampfireHour } from "@/lib/game/campfire";
import { friendNote } from "@/lib/npc/friendship";
import { useHqOnboarding } from "./hq/useHqOnboarding";
import { CheckInCard, PlaqueCard, RegisterCard } from "./hq/HqCards";
import HqInterior from "./hq/HqInterior";
import { HQ_LINES } from "@/lib/game/hqLayout";
import { hqEvent } from "@/lib/game/arrival/hq/store";
import { WREN } from "@/lib/game/arrival/hq/lines";
import { phaseInstant, solarPosition } from "@/lib/game/sunPath";
import type { WeatherBlend } from "@/lib/game/islandWeather";
import { saveName } from "./character/PlayerCharacterUI";
import { saveMyLook, useMyLook } from "@/lib/game/character/lookStore";
import { useProgression } from "@/lib/progression/useProgression";
import { WarmupProbe } from "./LoadGate";
import { escapeAction } from "@/lib/game/sceneGate";
import TopCluster, { HudClock, hudButton } from "./TopCluster";
import { setHudCoins, setHudXp } from "@/lib/game/hudStore";
import CollectionBook from "./CollectionBook";
import { usePeacefulContext } from "@/lib/game/usePeacefulContext";
import ToolWheel from "./ToolWheel";
import { clickAction, heldItem, toolNeeded, wheelContents, type Reach, type WheelItem, type WheelSite } from "@/lib/game/toolWheel";
import { holdItem, swapHeld, useHeld } from "@/lib/game/heldStore";
import { useRuinsHand } from "@/lib/game/ruinsHand";
import { useWheelKeys } from "@/lib/game/movement/keys";
import { rodByTier } from "@/lib/game/rods";
import { eatItem, localCollections, mergeWithLocal } from "@/lib/game/collections";
import { capture } from "@/lib/game/orbitCamera";
import { iconUrl } from "@/lib/icons/keys";
import { FLASH_MS, compactTouchHud, fullHud as isFullHud, setClassTag, useAlwaysFullHud } from "@/lib/game/hudPrefs";
import { nextLayer, subscribePause, type EscLayer } from "@/lib/game/escMenu";
import { MenuDock, SystemMenu } from "./EscLayers";
import QuestTracker from "./QuestTracker";
import { chapterQuest } from "@/lib/game/questTracker";
import { setNetSheet } from "./net/sheets";
import { useNetStatus, useRoster } from "@/lib/net/netStore";
import { useFriends } from "./net/friendActions";
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
import { PROBE_FRAMES, PROBE_WARMUP, medianFrameMs, tierDpr, tierForFrameMs, type QualityTier } from "@/lib/game/qualityTier";
import { ISLAND_PHASES, torontoHour, type IslandPhase } from "@/lib/game/islandTime";
import CraftingSheet, { BeachBottle } from "./crafting/Workshop";
import StudySeats from "./study/StudySeats";
import StudyHud from "./study/StudyHud";
import CafeInterior from "./study/CafeInterior";
import CafeGoalSheet from "./study/CafeGoalSheet";
import MonumentSheet from "@/components/progression/MonumentSheet";
import CafeBuilding from "./study/CafeBuilding";
import CafeSweeper, { cafeSweeper } from "./study/CafeSweeper";
import SushiBar from "./SushiBar";
import { BAR_LIGHT, barOf, barOpen, barSeat, type BarView } from "@/lib/game/sushiBar";
import { SWEEPER_TALK } from "@/lib/game/cafe";
import { DROPS } from "@/lib/game/drops";
import HalloweenLayer, { knockAt, knockNear } from "./Halloween";
import { useTraditions, type TraditionsNow } from "@/lib/game/useTraditions";
import { fogNightLight, type KnockDoor } from "@/lib/game/halloween";
import { CAFE_GRADE, CAFE_OWNER } from "@/lib/game/cafe";
import { studyHoldsPrompt } from "@/lib/study/worldStore";
import "@/lib/game/aerialFog";
import { CURRENT, lookFx, type LookPreset } from "@/lib/game/lookPreset";
import LookMaterials from "./LookMaterials";
import { EventDecor, eventSpots, PostersSheet, TourneySheet } from "./SeasonalEvents";
import { useIslandEvent, type IslandEvent } from "@/lib/game/seasonalEvents";
import { AIM_Y, escapeEndedCapture, holdCursor, readAimTarget, readCapture, requestResume, saveOrbit, subscribeAim, subscribeCapture, toggleZoom } from "@/lib/game/orbitCamera";
import { boxOccluder, treeOccluder } from "@/lib/game/occluders";
import type { Area } from "@/lib/net/protocol";
import NetWorld from "./net/NetWorld";
import NetHud from "./net/NetHud";
import PhotoMode from "./photo/PhotoMode";
import PhotoCamera from "./photo/PhotoCamera";
import { photoRig, usePhoto } from "@/lib/game/photoMode";
import { remoteSeatOutranks, remoteSeatTaken } from "./net/active";
import LabelLayer from "./LabelLayer";
import LandmarkTag from "./LandmarkTag";
import { worldLabels } from "@/lib/game/labelLayout";
import { localAvatar } from "@/lib/net/localAvatar";
import { isSeatedPose, seatPrompt } from "@/lib/game/seatPrompt";
import { roomHeading } from "@/lib/game/roomHeading";
import { DevUiTheme } from "@/components/gui/DevUiTheme";
import styles from "./DefaultIslandWorld.module.css";

type Near = "knock" | "shop_enter" | "counter" | "enter" | "exit" | "board" | "display" | "desk" | "shelf" | "clock" | "notice" | "catch" | "cafe" | "museum" | "ruins" | "mailbox" | "monument" | "home" | "house" | "village" | "buy" | "claim" | "donate" | "report" | "fish" | "forage" | "net" | "dig" | "museum_enter" | "cafe_enter" | "curator" | "closet" | "fitting" | "oracle_enter" | "altar" | "missions" | "ruins_exit" | "lantern" | "bench" | "stool" | "bed" | "trophy" | "posters" | "cocoa" | "picnic" | "owner" | "chest" | "talk" | "bram" | "founder" | "coffee" | "aquarium" | "admin" | "sell" | null;
type Sheet = "counter" | "shopkeeper" | "notice" | "letters" | "journal" | "trophies" | "showcase" | "closet" | "fitting" | "oracle" | "path" | "settings" | "missions" | "tourney" | "posters" | "cafe" | "bag" | "wallet" | "chest" | "plaque" | "sell" | "monument" | null;
const DEV = process.env.NODE_ENV !== "production";
const DEV_SHEETS: readonly Sheet[] = ["counter", "shopkeeper", "notice", "letters", "journal", "trophies", "showcase", "closet", "fitting", "oracle", "path", "settings", "missions", "tourney", "posters", "cafe", "wallet", "chest"];
/** Sheets opened at a station with E: E closes them again (the dialog system's opening key). */
const STATION_KEY = "e";
const PHASE_NAMES: Record<IslandPhase, string> = { dawn: "Dawn", day: "Daylight", evening: "Evening", night: "Night" };
const NEAR_LABELS: Record<Exclude<Near, null>, string> = {
  enter: "Enter HQ", exit: "Return to the island", board: "Read the notice board",
  display: "Look at the trophy case", desk: "Front desk · profile showcase", shelf: "Browse the library", clock: "Check the clock",
  notice: "Read the notice board", catch: "Check the catch board", mailbox: "Check the mailbox", monument: "See the club goal",
  museum_enter: "Enter the museum", cafe_enter: "Enter the café", curator: "Talk to the curator", closet: "Open the closet", fitting: "Try on outfits", oracle_enter: "Enter the Oracle temple", altar: "Consult the crystal",
  home: "Take the boat home", fish: "Cast your line", forage: "Gather", net: "Swing the net", dig: "Dig", claim: "Claim your plot", donate: "Donate your first catch to the museum", report: "Report back to Alice", house: "Enter your house", village: "Take the boat to the village",
  buy: `Add a room · ${ROOM_PRICE.coins} TC + ${ROOM_PRICE.materials}`,
  cafe: "Boarded up · help reopen it at the monument", museum: "Museum · Closed for now", ruins: "Enter the ruins", missions: "Read the mission board", ruins_exit: "Back to the village", lantern: "Pick it up",
  bench: "Sit on the bench", stool: "Enter the sushi bar", bed: "Sleep in your bed", chest: "Open your storage chest",
  trophy: "Read the tourney board", posters: "Look at the GENESIS posters", cocoa: "Get a hot cocoa", picnic: "Join the picnic",
  knock: "Knock: trick or treat",
  owner: `Talk to ${CAFE_OWNER.name}`,
  shop_enter: "Enter the shop", counter: "Buy and sell at the counter",
  // The resident in reach says their own name (TalkPrompt).
  talk: "Talk",
  // Bram on the walk-along (lib/game/arrival): talk to him, or on to his next line (bramPrompt).
  bram: "Talk to Bram",
  founder: "Look at the Founder's desk",
  // HQ's new stations (specs/interiors/hq.md; the lines are drafts for David).
  coffee: "Get a coffee", aquarium: "Look at the aquarium", admin: "Try the door",
  // The new world's quick-sell barrel by the fish market.
  sell: "Quick sell your catch",
};
const CLOSED: Near[] = ["museum"];
/** The door in reach for trick-or-treat (components/game/Halloween.tsx): IslandScene writes it each frame, E knocks. */
const knockSpot: { current: KnockDoor | null } = { current: null };
/** The village bench in reach as a `tsi:sit` detail: IslandScene writes it each frame, E sits (or stands) there. */
const benchSpot: { current: { x: number; z: number; yaw: number; seatY: number } | null } = { current: null };
/** Distance from a point to a landmark's footprint edge. */
const footprintDistance = (l: Landmark, x: number, z: number) => Math.hypot(Math.max(0, Math.abs(x - l.x) - (l.half?.[0] ?? 0)), Math.max(0, Math.abs(z - l.z) - (l.half?.[1] ?? 0)));
const PROMPT_IDS: readonly Landmark["id"][] = ["notice", "catch", "museum", "ruins", "mailbox", "monument"];
/** The tool that acts on each peaceful target (a resident in reach takes the prompt from the target otherwise). */
const TOOL_FOR: Record<"fish" | "net" | "dig", string> = { fish: "rod", net: "net", dig: "shovel" };
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
  const decks = wharfDecks(v);
  const fitting = objectsOf("fitting", v)[0], missions = objectsOf("missions", v)[0], marks = landmarks(v), fire = campfireSite(v);
  const island = villageIsland(v), trees = objectsOf("tree", v).map((o): TreeSpot => ({ x: o.x, z: o.z, seed: o.seed ?? 0 }));
  // The residents' houses (the `house` kind; none on a map that places none) stand like the landmarks.
  const houses = objectsOf("house", v), houseBoxes = houses.map(o => ({ x: o.x, z: o.z, half: houseHalf(o.yaw, o.scale) }));
  const buildings = [...marks.filter(l => l.half && Math.max(...l.half) >= 1), ...houseBoxes].map(l => boxOccluder(l.x, l.z, l.half![0], l.half![1], island.ground(l.x, l.z), 5));
  return {
    island,
    landmarks: marks,
    trees,
    /** What can stand between the orbit camera and you: the buildings and the trees' canopies (lib/game/occluders.ts). */
    occluders: [...buildings, ...trees.map(t => treeOccluder(t.x, t.z, island.ground(t.x, t.z)))],
    /** What hides a label (lib/game/labelLayout.ts): the buildings only, a canopy is see-through enough. */
    buildings,
    /** Inside a building's footprint, with a step's margin (the glide guide never marks a ledge behind one). */
    underBuilding: (x: number, z: number) => [...marks, ...houseBoxes].some(l => !!l.half && Math.abs(x - l.x) < l.half[0] + 0.5 && Math.abs(z - l.z) < l.half[1] + 0.5),
    houses,
    dock: wharfDock(v),
    // Round the bushes (the new world's wild shrubs).
    fireflies: [...objectsOf("bush", v), ...objectsOf("prop", v).filter(o => o.model?.startsWith("shrub-"))].map(xz),
    /** The beach campfire (specs/v1-drop.md §3): the map's, or open sand by the beach until one is placed. */
    campfire: fire,
    puddles: objectsOf("puddle", v).map(xz),
    benches: objectsOf("bench", v),
    lamps: objectsOf("lamp", v),
    bridges: objectsOf("bridge", v).map(o => ({ ...o, y: levelAt(v.map, worldToCellX(v.map, o.x), worldToCellZ(v.map, o.z)) * LEVEL_STEP - 0.065 })),
    doors: { hq: landmarkPoint("hq", "door", v), oracle: landmarkPoint("oracle", "door", v), boat: landmarkPoint("wharf", "door", v), cafe: landmarkPoint("cafe", "door", v), shop: landmarkPoint("shop", "door", v) },
    spawns: {
      start: villageSpawn(v), returned: spot(landmarkPoint("hq", "exit", v)), oracle: spot(landmarkPoint("oracle", "exit", v)),
      museum: spot(landmarkPoint("museum", "exit", v)), cafe: spot(landmarkPoint("cafe", "exit", v)), ruins: spot(landmarkPoint("ruins", "exit", v)), boat: spot(landmarkPoint("wharf", "exit", v)),
      shop: spot(landmarkPoint("shop", "exit", v)),
    },
    /** Fitting room beside the shop; ruins mission board beside the cliff gate (combat-foundation.md §6). */
    fitting: fitting ? xz(fitting) : null,
    /** The new world's coral reefs, where its fish gather. */
    reefs: objectsOf("prop", v).filter(o => o.model?.startsWith("coral-reef-")).map(xz),
    /** The new world's quick-sell barrel (lib/game/wharf.ts SELL_BARREL), or none. */
    sellBarrel: (b => (b ? xz(b) : null))(objectsOf("prop", v).find(o => o.id === SELL_BARREL)),
    missions: missions ? { at: xz(missions), yaw: missions.yaw ?? 0 } : null,
    // The ruins gate is combat's (lib/game/drops.ts): before its drop the gate is fallen rubble, nothing to press.
    prompts: marks.filter(l => PROMPT_IDS.includes(l.id) && (l.id !== "ruins" || DROPS.combat)),
    nodes: villageNodes(v),
    water: villageWater(v).classify,
    scale: villageScale(v),
    /** Ambient life (AmbientFauna): flowers for the butterflies, the water's kinds, gulls off the shores in view. */
    fauna: { site: { map: v.map, flowers: objectsOf("flower", v).map(xz), water: villageWater(v).classify, ...(v.terrain && fire ? { beach: [fire.x, fire.z, 30] as const } : {}) }, gulls: gullAnchors(v.bounds), perches: gullPerchSpots(v, island.ground) },
    /**
     * The map's rocks (centre and footprint radius): the ones standing in the water wear a foam ring (WaterContacts). A
     * rock model without a measured footprint rings at half a unit times its scale. The cliff-foot boulders standing in
     * the sea (`lib/game/rocks.ts` cliffBoulders, the `wet` ones) ring the same way.
     */
    rocks: [
      ...objectsOf("rock", v).map(o => { const f = propFootprint(o); return { x: o.x, z: o.z, r: f ? Math.max(f[0], f[1]) : 0.5 * (o.scale ?? 1) }; }),
      // (The smooth world has no kit cliffs, so no cliff-foot boulders: specs/world-editor.md.)
      ...(v.terrain ? [] : cliffBoulders(v.map, v.field).filter(r => r.wet).map(r => ({ x: r.x, z: r.z, r: Math.max(...ROCK_SIZE[r.model].half) * r.scale }))),
    ],
    /** No water glints (nor seabed props, nor fish) under the wharf's decks: they sit a few centimetres above the water and they would show through. */
    underWharf: (x: number, z: number) => decks.some(deck => x > deck.x0 - 0.4 && x < deck.x1 + 0.4 && z > deck.z0 - 0.4 && z < deck.z1 + 0.4),
  };
}
/** Our own still models (no sway, no glow of their own), merged in the new world (InstancedNature MergedModels). */
const STILL = /^\/assets\/game\/(props|wharf|buildings|water)\//;
/** Floating names; the ruins gate and the Oracle temple only once their drops are out (lib/game/drops.ts). */
const SIGNS: Partial<Record<Landmark["id"], string>> = { museum: "Museum · Closed", notice: "Notices", catch: "Catch board", shop: "Shop",
  ...(DROPS.combat ? { ruins: "Ruins gate" } : {}), ...(DROPS.oracle ? { oracle: "Oracle temple" } : {}) };

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


/** The wardrobe's and the decorate panel's "shop" links: the shop is a place now (its counter, ShopCounter), not a panel. */
const toShop = (what: string) => toast(`${what} at the shop in the village: buy it at the counter.`, iconUrl("shopping-cart"));

/** Module scope: the react compiler forbids writing through a prop. */
const writeText = (el: HTMLElement | null, text: string) => { if (el) el.textContent = text; };
/** A weapon picked on the wheel becomes your default on the server. */
const equipOnServer = (weapon: string) => { void apiCall("/api/combat/equip", "equip", { weapon }).catch(() => {}); };

/**
 * The aim dot (playtest round 1): under mouse-look outside combat a click aims from here, a little above your head. A
 * player or resident under it turns it to a ring with their name: a click opens their card (or talks), E still
 * interacts with what's in reach.
 */
function AimDot() {
  const target = useSyncExternalStore(subscribeAim, readAimTarget, () => null);
  return <div className={styles.aimDot} style={{ top: `${(1 - AIM_Y) * 50}%` }} data-on={target !== null || undefined} aria-hidden="true">
    <i />{target ? <span>{target}</span> : null}
  </div>;
}

/** Whether you sit (or lie) on a seat now, from the local avatar's pose, handed up only when it changes. */
function SeatWatch({ onChange }: { onChange: (seated: boolean) => void }) {
  const last = useRef(false);
  useFrame(() => {
    const seated = isSeatedPose(localAvatar()?.motion.current?.pose);
    if (seated !== last.current) { last.current = seated; onChange(seated); }
  });
  return null;
}

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

function IslandScene({ held, identity, level, devAt, exitFrom, peaceful, fishSpot, fishing, chapter, phase, campfireHour, light, look, weather, overview, zoom, reset, returned, fromBoat, liteMode, castShadows, player, onNear, progression, ceremony, event, arriving, hintKeys, talking, traditions, fogNight, onBar }: {
  /** Campfire hour (lib/game/campfire.ts): the fire burns, the drum circle plays, sitting by it earns the bonus. */
  campfireHour: boolean;
  /** Near the sushi bar (its music): lib/game/sushiBar.ts BAR_MUSIC_IN. */
  onBar: (near: boolean) => void;
  /** The traditions running now (lib/game/useTraditions.ts) and the fog night's strength (0 to 1): Halloween's layer. */
  traditions: TraditionsNow; fogNight: number;
  /** What the player holds from the tool wheel (specs/game-ui.md), drawn in the hand. */
  held: WheelItem | null;
  /** Talking with a resident (TalkBox): you stand still and face them. */
  talking: boolean;
  progression: { stage: number; opened: readonly WorldGoalId[] }; ceremony: boolean; fromBoat: boolean; event: IslandEvent | null;
  /** The arrival before its walk-along (specs/v1-drop.md §1): the player holds still (the crossing's boat carries them). */
  arriving: boolean;
  /** The keys Bram's hints name (the player's own bindings, or touch wording). */
  hintKeys: HintKeys;
  chapter: { claim: boolean; donate: boolean; report: boolean };
  peaceful: { moment: WorldMoment; member: string; glider: boolean }; fishSpot: { current: FishingSpot | null }; fishing: boolean; exitFrom: "museum" | "oracle" | "ruins" | "cafe" | "shop" | null; devAt: [number, number, number] | null; identity: WorldIdentity; level?: number;
  phase: IslandPhase; light: IslandLight; look: SeasonLook; weather: IslandWeather; overview: boolean; zoom: number; reset: number; returned: boolean; liteMode: boolean; castShadows: boolean;
  player: React.RefObject<THREE.Vector3>; onNear: (near: Near) => void;
}) {
  const v = village();
  const layout = useMemo(() => villageLayout(v), [v]);
  const { island, spawns, doors } = layout;
  // Photo mode holds you still while you frame a photo.
  const photoOpen = usePhoto().open;
  const { data: personas } = useNPCPersonas({ permanentOnly: true });
  const exitSpot = exitFrom === "museum" ? spawns.museum : exitFrom === "cafe" ? spawns.cafe : exitFrom === "oracle" ? spawns.oracle : exitFrom === "ruins" ? spawns.ruins : exitFrom === "shop" ? spawns.shop : null;
  const spawn = (devAt && !returned && !fromBoat && !exitFrom ? devAt : fromBoat ? spawns.boat : exitSpot ?? (returned ? spawns.returned : null)) ?? spawns.start;
  const terrain = useMemo(() => ({ ...ISLAND_TERRAIN, grass: look.grass }), [look.grass]);
  // No blades through a building, a trunk or a rock: where something solid stands, its top is above the ground.
  const grassClear = useMemo(() => (x: number, z: number) => island.top(x, z) <= island.ground(x, z) + 0.01, [island]);
  const scenery = useMemo(() => sceneryOf(v, island.ground, look.season), [v, island, look.season]);
  // The new world's still props (our own art: props, the wharf kit, buildings, coral) merge by look into a few draws.
  // The plaza fountain at night (David, R2e: "lighting in the fountain"): a glow over its pool, a halo on its top jet and
  // one warm light in its basin. Its pool is 0.4 up and its jet 3.14 in the model's units.
  const fountain = useMemo(() => {
    const f = scenery.find(p => p.url.endsWith("/plaza-fountain.glb"));
    if (!f) return null;
    const [x, y, z] = f.position, s = f.scale ?? 1;
    return { jet: [[x, y + 3.14 * s, z]] as const, water: () => y + 0.36 * s, light: [x, y + 0.9 * s, z] as const };
  }, [scenery]);
  const [sceneryStill, sceneryMoving] = useMemo(() => (v.terrain ? [scenery.filter(p => STILL.test(p.url)), scenery.filter(p => !STILL.test(p.url))] : [[], scenery]), [v, scenery]);
  // The lamps by model: the street lamp (none), or the new world's (propModels NEW_LAMPS), each turned by its yaw.
  const lampSets = useMemo(() => (["", ...Object.keys(NEW_LAMPS) as (keyof typeof NEW_LAMPS)[]] as const).map(kind => {
    const ls = layout.lamps.filter(l => (l.model ?? "") === kind);
    return { kind, positions: ls.map((l): [number, number, number] => [l.x, island.ground(l.x, l.z), l.z]), yaws: kind ? ls.map(l => l.yaw ?? 0) : undefined };
  }).filter(s => s.positions.length), [layout, island]);
  const lampModels = useMemo(() => lampSets.flatMap(s => s.positions.map((position, i) => ({ url: s.kind ? NEW_LAMPS[s.kind].url : STREETLAMP_URL, position, rotation: s.yaws?.[i] }))), [lampSets]);
  const lampPoints = useMemo(() => lampSets.flatMap(s => (s.kind === "hand" ? [] : s.positions.map((p, i) => lampLight(p, s.yaws?.[i] ?? 0, s.kind ? NEW_LAMPS[s.kind].light : [0, 2.4, 0])))), [lampSets]);
  const handPoints = useMemo(() => lampSets.flatMap(s => (s.kind === "hand" ? s.positions.map((p, i) => lampLight(p, s.yaws?.[i] ?? 0, NEW_LAMPS.hand.light)) : [])), [lampSets]);
  // The sushi bar (game/sushi-bar): E at its entrance seats you on a stool while it's open, its light is one of the pool's points (over its counter).
  const bar = useMemo(() => barOf(v), [v]), barY = bar ? island.ground(bar.x, bar.z) : 0, barView = useRef<BarView | null>(null);
  const poolPoints = useMemo(() => (bar ? [...lampPoints, lampLight([bar.x, barY, bar.z], bar.yaw ?? 0, BAR_LIGHT)] : lampPoints), [lampPoints, bar, barY]);
  const near = useRef<Near>(null);
  const fauna = useMemo(() => ({ ...layout.fauna, ground: island.ground, standable: island.standable, surface: island.surface, top: island.top, player }), [layout, island, player]);
  // The arrival (components/game/arrival): Bram walks you through, the fish crate on the pier until the tour is over.
  const arrivalPhase = useArrivalPhase();
  const dock = layout.dock;
  const crated = useMemo(() => (dock ? withCrates(island, crateSpots(routeFor(GAME_WORLD), placeWorld(dock, v))) : null), [island, dock, v]);
  const walkOn = crated && (arrivalPhase === "crossing" || arrivalPhase === "landing" || arrivalPhase === "tutorial") ? crated : island;
  const spots = useMemo(() => eventSpots(event?.decor ?? null), [event]);
  const cafeAt = useMemo(() => { const c = layout.landmarks.find(l => l.id === "cafe"); return c ? { x: c.x, z: c.z, yaw: c.yaw ?? 0, scale: c.scale ?? 1 } : null; }, [layout]);
  useEffect(() => { player.current.set(...spawn); }, [reset, spawn, player]);
  useEffect(() => { worldLabels.setOccluders(layout.buildings); return () => worldLabels.setOccluders([]); }, [layout]);
  const focus = useRef(new THREE.Vector3(...spawn));
  const follow = useMemo(() => ({ ground: island.ground, player, occluders: layout.occluders, seat: barView }), [island, player, layout]);
  useFollowCamera(focus, zoom, overview ? layout.scale.overview : null, follow);
  useFrame(() => {
    const px = player.current.x, pz = player.current.z;
    const gap = (p: [number, number] | null) => (p ? Math.hypot(px - p[0], pz - p[1]) : Infinity);
    const within = (p: [number, number] | null, r: number) => gap(p) < r;
    // Chapter 1 at the clubhouse door: claim the plot first, report back when ready, otherwise enter. Doors to what a
    // later drop opens (lib/game/drops.ts) offer nothing yet: the boat home, the Oracle temple, the café, the mission board.
    // Before the café's drop Rosa sweeps out front: the café's prompt is hers.
    const sweeper: [number, number] | null = !DROPS.cafe && cafeSweeper.on ? [cafeSweeper.x, cafeSweeper.z] : null;
    const door: [Near, [number, number] | null] = within(doors.hq, 2) ? [chapter.claim ? "claim" : chapter.report ? "report" : "enter", doors.hq]
      // Not while Bram brings you in and walks you round (the arrival): the boat home waits for after.
      : DROPS.homeIsland && within(doors.boat, 1.6) && !arrivalPhase ? ["home", doors.boat]
      : within(layout.fitting, 1.5) ? ["fitting", layout.fitting]
      : within(layout.sellBarrel, 2.2) ? ["sell", layout.sellBarrel]
      : DROPS.oracle && within(doors.oracle, 1.6) ? ["oracle_enter", doors.oracle]
      : within(doors.shop, 1.6) ? ["shop_enter", doors.shop]
      : DROPS.cafe && within(doors.cafe, CAFE_DOOR_RANGE) ? [progression.opened.includes("cafe") ? "cafe_enter" : "cafe", doors.cafe]
      : within(sweeper, SWEEPER_TALK) ? ["owner", sweeper]
      : DROPS.combat && within(layout.missions?.at ?? null, 1.5) ? ["missions", layout.missions!.at] : [null, null];
    let next: Near = door[0], nextD = gap(door[1]);
    const b = benchSeat(px, pz, 1.3, v, layout.benches, remoteSeatTaken), stool = !b && bar ? barSeat(bar, px, pz, barOpen(phase), remoteSeatTaken, remoteSeatOutranks) : null;
    benchSpot.current = b ? { ...b, seatY: island.ground(b.x, b.z) + BENCH_SEAT_TOP } : stool && { ...stool, seatY: barY + stool.top };
    // Another's claim on your stool outranks yours (you both pressed E together): on to the next free one, or up.
    if (stool?.clash) window.dispatchEvent(new CustomEvent("tsi:sit", { detail: benchSpot.current }));
    // An event spot and a bench both in reach: the nearer one takes E.
    const ev = spots.find(s => within([s.x, s.z], s.range)), seat = benchSpot.current;
    const nearer = (p: { x: number; z: number }) => Math.hypot(px - p.x, pz - p.z);
    if (!next && (ev || seat)) { const e = ev && (!seat || nearer(ev) < nearer(seat)); next = e ? ev!.near : stool ? "stool" : "bench"; nextD = nearer(e ? ev! : seat!); }
    // Trick-or-treat: the door's pumpkin in reach (someone behind it hasn't answered you tonight) beats the door itself.
    const kd = knockNear(px, pz);
    knockSpot.current = kd;
    if (kd && (!next || nearer(kd) < nextD)) { next = "knock"; nextD = nearer(kd); }
    if (!next) {
      let best = 1.4;
      for (const l of layout.prompts) {
        // An opened goal building (boards off) no longer shows its closed prompt.
        const opened = progression.opened.includes(l.id as WorldGoalId);
        if (opened && l.id !== "museum") continue;
        const d = footprintDistance(l, px, pz);
        if (opened && d < best) { best = d; next = "museum_enter"; continue; }
        if (d < best) { best = d; next = l.id === "museum" && chapter.donate ? "donate" : l.id as Near; }
      }
      if (next) nextD = best;
    }
    // A resident in reach (the residents' frame wrote them just before this one): they take E unless a door, a seat or
    // a sign is nearer. Talking (or fishing, or at a study seat) offers nothing else.
    const tn = talkStore.near;
    if (tn.id && !fishing && tn.d < nextD) next = "talk";
    if (studyHoldsPrompt() || talking) next = null;
    // Bram waiting at his stop on the walk-along (or talking): E is his.
    else if (!fishing && bramNear(px, pz)) next = "bram";
    else if (!fishing && (next === null || next === "talk")) {
      const peace = peacefulNear(island.map, layout.water, px, pz, fishSpot);
      // A flower or shell nearer than the resident is picked up first. Water, a bug or a dig spot keep the prompt only
      // with the tool for it in hand (its click; E there still talks to the resident, the key handler); empty-handed,
      // the resident's "Talk to" beats "Take out your rod".
      if (next === null) next = peace;
      else if (peace && (peace === "forage" ? (getPeacefulTarget()?.distance ?? Infinity) < tn.d : held?.kind === TOOL_FOR[peace])) next = peace;
    }
    if (near.current !== next) { near.current = next; onNear(next); }
  }, -2);
  return (
    <>
      <IslandAtmosphere phase={phase} light={light} look={look} weather={weather} liteMode={liteMode} castShadows={castShadows} overview={overview} overviewFog={layout.scale.overviewFog}
        ground={island.ground} puddles={layout.puddles} cloudSize={layout.scale.cloudSize} shadowExtent={layout.scale.shadowExtent} shadowFollow={v.terrain ? player : undefined} fireflyAnchors={layout.fireflies} trees={layout.trees} fauna={fauna} />
      <GridWorld map={island.map} field={v.field} light={light} palette={terrain} windScale={liteMode ? 0 : weather === "wind" ? 2.2 : 1} lite={liteMode} clear={grassClear} terrain={v.terrain} waves ownGround />
      <GridOcean map={island.map} lite={liteMode} skip={layout.underWharf} radius={layout.scale.glintRadius} waves ownGround />
      <Suspense fallback={null}><Seabed map={island.map} lite={liteMode} skip={layout.underWharf} submerged={!!v.terrain} /></Suspense>
      <WaterContacts map={island.map} player={player} ground={island.ground} rocks={layout.rocks} />
      <GlassWater />
      <Suspense fallback={null}><DecorativeFish map={island.map} lite={liteMode} skip={layout.underWharf} max={v.terrain ? 40 : undefined} near={layout.reefs} /></Suspense>
      <PeacefulLayer map={island.map} nodes={layout.nodes} moment={peaceful.moment} member={peaceful.member} player={player} ground={island.ground} highTier={!liteMode} active={!fishing} treeModels={SEASON_TREES[look.season]} />
      <BeachBottle player={player} ground={island.ground} />
      {/* After the first leaf glider is made: a marked edge and a ring to land in (the guided first glide). */}
      <GlideGuide map={island.map} ground={island.ground} player={player} owned={peaceful.glider} active={!fishing && !arriving} blocked={layout.underBuilding} />
      <BorderNotice village={v} player={player} />
      <StudySeats area="village" player={player} ground={island.ground} open={DROPS.cafe} />
      <VillageLandmarks layout={layout} ground={island.ground} opened={progression.opened} stage={progression.stage} ceremony={ceremony} light={light} />
      {!DROPS.cafe && cafeAt && <CafeSweeper cafe={cafeAt} ground={island.ground} player={player} night={phase === "night"} />}
      {layout.fitting && <FittingRoom at={layout.fitting} ground={island.ground} player={player} />}
      <EventDecor event={event} ground={island.ground} light={light} weather={weather} />
      <HalloweenLayer content={traditions.content} v={v} island={island} light={light} night={phase === "night"} fog={fogNight} weather={weather} residents={personas} />
      {layout.bridges.map(b => <GLBProp key={b.id} url={BRIDGE_URL} position={[b.x, b.y, b.z]} rotation={[0, b.yaw ?? 0, 0]} />)}
      {/* The new world's lamps only glow; their pools come from the few nearest you (LampPool). */}
      {v.terrain
        ? <Suspense fallback={null}><GlowingLamps items={lampModels} glow={light.lampsOn ? 1.2 : 0} /></Suspense>
        : lampSets.map(s => <Lanterns key={s.kind} positions={s.positions} yaws={s.yaws} lamp={s.kind ? NEW_LAMPS[s.kind] : undefined} intensity={light.lampsOn ? light.lamp * 1.5 : 0} glow={light.lampsOn ? 1.2 : 0} />)}
      {v.terrain && <LampPool points={poolPoints} intensity={light.lampsOn ? light.lamp * 2 : 0} reach={11} player={player} />}
      {/* Every lamp's warm halo and ground pool, breathing like a flame (two draws a set). */}
      {v.terrain && <LampGlow points={lampPoints} ground={island.ground} on={light.lampsOn} />}
      {v.terrain && <LampGlow points={handPoints} ground={island.ground} on={light.lampsOn} halo={1.1} pool={2.2} />}
      {fountain && <LampGlow points={fountain.jet} ground={fountain.water} on={light.lampsOn} halo={2.4} pool={3} color="#a8e8ff" />}
      {fountain && <FadeLight position={fountain.light} color="#ffd59a" intensity={light.lampsOn ? light.lamp * 2 : 0} distance={12} />}
      {bar && <Suspense fallback={null}><SushiBar bar={bar} y={barY} player={player} phase={phase} viewRef={barView} onNear={onBar} /></Suspense>}
      {layout.campfire && <Campfire site={layout.campfire} ground={island.ground} phase={phase} hour={campfireHour} player={player} walled={!!v.terrain} />}
      {/* Nature and props from the map, instanced: one draw per model sub-mesh however many the island has. */}
      <InstancedModels items={sceneryMoving} />
      {sceneryStill.length > 0 && <Suspense fallback={null}><MergedModels items={sceneryStill} /></Suspense>}
      {/* Residents walk their routines on the world clock (residentRoutine.ts); during a ceremony they gather at the monument and cheer.
          While Bram brings a new arrival in and walks them round, his walking self stays out of sight: one Bram. */}
      <Residents personas={personas} phase={phase} ceremony={ceremony} player={player} island={island} v={v} away={arrivalPhase ? BRAM.slug : null}
        playerName={identity.display_name !== "You" ? identity.display_name : null} />
      <PlayerAvatar key={`${reset}-${returned}-${fromBoat}-${exitFrom}`} spawnPosition={spawn} playerName={identity.display_name} playerLevel={level} member={identity.member} player={player} frozen={fishing || arriving || talking || photoOpen}
        ride={myTrip.ride}
        world={walkOn} groundHeight={island.ground} groundSurface={island.surface} camTarget={focus} glider={peaceful.glider} held={held} />
      <CharacterCrowd player={player} ground={island.ground} stepWorld={island} />
      {dock && <ArrivalWorld v={v} island={island} player={player} dock={dock} held={held} keys={hintKeys} />}
    </>
  );
}

const F = "/assets/acnh/furniture/";
/**
 * Club monument (row 182): five build stages from dump furniture and our
 * "coming soon" board. 0 roped-off plot + the board; 1 scaffold + materials;
 * 2 rock monument rises inside the scaffold; 3 banners go up; 4 complete
 * (scaffold, sign and ropes gone, lanterns lit).
 */
function ClubMonument({ position, stage, ceremony }: { position: [number, number, number]; stage: number; ceremony: boolean }) {
  const done = stage >= 4;
  return <group position={position}>
    {!done && <>
      <GLBProp url={MONUMENT_SIGN_URL} position={[1.3, 0, -1.25]} rotation={[0, -0.3, 0]} />
      {[[-1.1, -1.1, 0], [1.1, -1.1, 0], [-1.1, 1.1, Math.PI], [1.1, 1.1, Math.PI]].map(([x, z, r], i) => (
        <GLBProp key={i} url={worldModel("/assets/acnh/props/fence-rope-a.glb")} position={[x, 0, z]} rotation={[0, r, 0]} />
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
  const { hq, shop, oracle, cafe, museum, ruins, monument, mailbox, notice } = Object.fromEntries(placed) as Partial<Record<Landmark["id"], Landmark>>;
  const board = placed.get("catch"), { missions } = layout;
  // The residents' houses by colourway, each set instanced (one draw per part for all its houses).
  const houseSets = useMemo(() => (Object.keys(CHALET_VARIANTS) as (keyof typeof CHALET_VARIANTS)[]).map(colour => [CHALET_VARIANTS[colour], layout.houses
    .filter(h => houseModel(h.model) === `chalet-${colour}`)
    .map((h): PartsPlacement => ({ position: [h.x, ground(h.x, h.z), h.z], yaw: h.yaw ?? 0, scale: h.scale ?? 1 }))] as const).filter(([, at]) => at.length), [layout, ground]);
  return <>
    {hq && <>
      {/* The clubhouse model's origin is 2.35 in front of its footprint centre; porch lamps flank the door.
          `scale` (the world map's bigger buildings): the offsets scale with the model. */}
      <group position={[hq.x + Math.sin(hq.yaw ?? 0) * -2.35 * (hq.scale ?? 1), ground(hq.x, hq.z), hq.z - Math.cos(hq.yaw ?? 0) * 2.35 * (hq.scale ?? 1)]} rotation={[0, hq.yaw ?? 0, 0]} scale={hq.scale ?? 1}><ACNHBuilding id="hq" windowColor="#ffc95a" windowGlow={light.windowGlow} /></group>
      {[-2, 2].map(x => { const k = hq.scale ?? 1, [px, pz] = turn(x * k, -3.65 * k, hq.yaw); return <FadeLight key={x} position={[hq.x + px, ground(hq.x, hq.z) + 1.25 * k, hq.z + pz]} color="#ffd17a" intensity={light.lampsOn ? light.lamp * 0.85 : 0} distance={4} decay={2} />; })}
      <FadeLight position={[hq.x + turn(0, -3.75 * (hq.scale ?? 1), hq.yaw)[0], ground(hq.x, hq.z) + 1.6 * (hq.scale ?? 1), hq.z + turn(0, -3.75 * (hq.scale ?? 1), hq.yaw)[1]]} color="#ffd68b" intensity={light.lamp * 1.5} distance={5.5} />
    </>}
    {shop && <group position={at(shop)} rotation={[0, shop.yaw ?? 0, 0]} scale={shop.scale ?? 1}><ACNHBuilding id="shop" lit={windowLit(light)} /></group>}
    {oracle && <group position={at(oracle)} rotation={[0, oracle.yaw ?? 0, 0]} scale={oracle.scale ?? 1}><ACNHBuilding id="oracle" lit={windowLit(light)} /></group>}
    {/* Before its drop the café is built but not open (lib/game/drops.ts): warm, an "Opening soon" chalkboard, no door. */}
    {cafe && <group position={at(cafe)} rotation={[0, cafe.yaw ?? 0, 0]} scale={cafe.scale ?? 1}><CafeBuilding state={!DROPS.cafe ? "soon" : opened.includes("cafe") ? "open" : "boarded"} light={light} /></group>}
    {museum && <group position={at(museum)} rotation={[0, museum.yaw ?? 0, 0]} scale={museum.scale ?? 1}><ACNHParts parts={CHALET_VARIANTS.red} lit={windowLit(light)} /></group>}
    {/* The residents' houses: the chalet in the colourway its model names. */}
    {houseSets.length > 0 && <ACNHHouses sets={houseSets} lit={windowLit(light)} />}
    {/* Boarded doors: the connectable fence across the museum's entrance, three posts and their rails (lib/game/fences.ts;
        the café boards its own, CafeBuilding). */}
    {museum && !opened.includes(museum.id as WorldGoalId) && <FenceLine x0={museum.x - 1} z0={front(museum) - 0.35} dx={1} dz={0} n={3} ground={ground} />}
    {/* The ruins gate once the ruins open; before, fallen stones and roots block it (lib/game/barriers.ts GATE_RUBBLE, in the scenery). */}
    {ruins && DROPS.ruins && <FenceLine x0={ruins.x} z0={ruins.z - 1.5} dx={0} dz={1} n={4} ground={ground} />}
    {ruins && DROPS.ruins && [-1.9, 1.9].map(dz => <GLBProp key={dz} url="/assets/acnh/props/stone-lantern.glb" position={[ruins.x, ground(ruins.x, ruins.z + dz), ruins.z + dz]} />)}
    {monument && <ClubMonument position={at(monument)} stage={stage} ceremony={ceremony} />}
    {mailbox && <GLBProp url={MAILBOX_URL} position={at(mailbox)} />}
    {/* The boards' cork faces +z; the plaza boards stand in front of the HQ, so they turn to face the plaza (a painter yaw adds on). */}
    {notice && <GLBProp url={NOTICE_BOARD_URL} position={at(notice)} rotation={[0, Math.PI + (notice.yaw ?? 0), 0]} />}
    {board && <GLBProp url={CATCH_BOARD_URL} position={at(board)} rotation={[0, Math.PI + (board.yaw ?? 0), 0]} />}
    {missions && DROPS.combat && <GLBProp url={NOTICE_BOARD_URL} position={[missions.at[0], ground(...missions.at), missions.at[1] + 0.3]} rotation={[0, missions.yaw, 0]} />}
    {layout.dock && <Wharf dock={layout.dock} light={light} place="village" dressed={!layout.dock.y} />}
    {layout.landmarks.filter(l => SIGNS[l.id] && !opened.includes(l.id as WorldGoalId)).map(l => <LandmarkTag key={l.id} position={[l.x, ground(l.x, l.z) + (l.half && l.half[0] > 1 ? 3.6 : 2.3), l.z - (l.half?.[1] ?? 0)]} closed={!l.open}>
      {SIGNS[l.id]}
    </LandmarkTag>)}
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
  // The member island's world (NEXT_PUBLIC_GAME_WORLD): the new world loads into the village's place before anything mounts.
  const [loading] = useState(loadGameWorld);
  const [worldReady, setWorldReady] = useState(!loading);
  useEffect(() => { void loading?.then(() => setWorldReady(true)); }, [loading]);
  if (!worldReady) return <IslandLoading />;
  return <GameSceneBoundary><DefaultIslandWorldContent preset={preset}>{children}</DefaultIslandWorldContent></GameSceneBoundary>;
}

function DefaultIslandWorldContent({ preset, children }: { preset?: LookPreset; children?: ReactNode }) {
  const [graphics, actions] = useGraphicsSettings();
  const conditions = useIslandConditions();
  const islandEvent = useIslandEvent(conditions.now);
  // The traditions calendar (lib/content/traditions.ts): Halloween's pumpkins, costumes, trick-or-treat and fog nights.
  const traditions = useTraditions(conditions.now);
  const { phase, forcedPhase: forced, setForcedPhase: setForced, weather, season } = conditions;
  // The Esc layers (playtest round 1, decision 3; lib/game/escMenu.ts): the UI view (Esc 1) and the system menu (Esc 2).
  const [layer, setLayer] = useState<EscLayer>(null);
  // Development only: the dev panel, shown from Settings' Dev tab.
  const [devPanel, setDevPanel] = useState(false);
  const [overview, setOverview] = useState(false);
  const [reset, setReset] = useState(0);
  // Dev: ?home=1 starts on the home island, ?home=inside in the house; ?decorate=1&place=<piece> opens decorating.
  const [devHome] = useState(() => (process.env.NODE_ENV !== "production" && typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams()));
  const [site, setSite] = useState<"village" | "home" | "ruins">(devHome.get("home") ? "home" : devHome.get("ruins") ? "ruins" : "village");
  const [inside, setInside] = useState<"hq" | "house" | "museum" | "oracle" | "cafe" | "shop" | null>(devHome.get("home") === "inside" ? "house" : devHome.get("cafe") === "inside" ? "cafe" : devHome.get("museum") === "inside" ? "museum" : devHome.get("hq") === "inside" ? "hq" : devHome.get("temple") === "inside" ? "oracle" : devHome.get("shop") === "inside" ? "shop" : null);
  // The shop has no multiplayer area yet (lib/net/protocol.ts AREAS is snapshot-locked): inside it you're offline, never
  // shown in the village at the room's coordinates.
  const area: Area = site === "ruins" ? "ruins" : site === "home" ? (inside === "house" ? "house" : "home") : inside === "shop" ? "village" : inside ?? "village";
  const netReady = inside !== "shop";
  const [layout, setLayout, , homeActions] = useHomeLayout();
  const decor = useDecorate(layout, setLayout, { on: devHome.get("decorate") === "1", piece: devHome.get("place") && catalogueItem(devHome.get("place")!) ? devHome.get("place") : null });
  const [returned, setReturned] = useState(false);
  const [fromBoat, setFromBoat] = useState(false);
  const [exitFrom, setExitFrom] = useState<"museum" | "oracle" | "ruins" | "cafe" | "shop" | null>(null);
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
  // Campfire hour (s-campfire): the HUD says so as it starts, or as you arrive during it.
  const campfireHour = isCampfireHour(torontoHour(new Date(conditions.now)));
  const campfireCall = ready && campfireHour;
  useEffect(() => { if (campfireCall) toast("Campfire hour! The drums are going by the campfire. Sit by the fire a while for a little bonus."); }, [campfireCall]);
  const [sceneShown, setSceneShown] = useState(0);
  const onSceneReady = useCallback(() => { setReady(true); setFading(false); tripSceneReady(); }, []);
  const [near, setNear] = useState<Near>(null);
  // HQ's stations answer by what they do (lib/game/hqLayout.ts).
  const hqStation = useCallback((s: InteriorStation | null) => setNear((s?.action as Near) ?? null), []);
  // On a bench or in bed the seat's prompt stands you up (world audit item 17).
  const [seated, setSeated] = useState(false);
  // Dev (screenshots): `?sheet=<name>` opens that sheet (the Oracle path sheet once progression loads; donate, shop and bag too).
  const [sheet, setSheet] = useState<Sheet>(() => (DEV_SHEETS.includes(devHome.get("sheet") as Sheet) ? devHome.get("sheet") as Sheet : null));
  // The shopkeeper's answer: the shop opens on the game's things or on the club merch.
  const [shopSection, setShopSection] = useState<ShopSection>(() => (devHome.get("shopSection") === "merch" ? "merch" : "items"));
  // The island map (M, or Map in the UI view's dock); the minimap itself is always on in the village.
  const [mapOpen, setMapOpen] = useState(false);
  const progression = useProgressionWorld();
  const plot = useDefaultIslandPlot(progression.completedGoals);
  const ceremony = useCeremony(progression.ceremonyGoal, progression.forceCeremony);
  const chapterActions = useChapterActions();
  // First login (row 211; specs/v1-drop.md §1): the arrival, once per account (Bram's boat, the reflection
  // creator, the crossing, the walk-along), then the chapter 1 objective. Dev: ?arrival=1 replays it.
  const mine = useMyLook();
  const { loaded: progressionLoaded, state: progressionState } = useProgression();
  const [arrived, setArrived] = useState(false);
  const [objectiveNew, setObjectiveNew] = useState(false);
  const chapterFlags = useMemo(() => ({ claim: chapterActions.claim, donate: chapterActions.donate, report: chapterActions.report }),
    [chapterActions.claim, chapterActions.donate, chapterActions.report]);
  useEffect(() => { if (inside === "museum" && !loadMuseumRef.current) { loadMuseumRef.current = true; loadMuseum(); } if (inside !== "museum") loadMuseumRef.current = false; }, [inside, loadMuseum]);
  // The glider waits for the mountain expansion (lib/game/moveUnlocks.ts); the dash is everyone's from the start.
  const unlocks = useMoveUnlocks();
  // Resident friendship (d-friends): the day's first talk with a resident raises it; a level's letter or gift is told.
  useEffect(() => { loadFriends(); return onTalkEnd(slug => void talkedTo(slug).then(f => { if (f?.leveled) toast(friendNote(f, f.name)); })); }, []);
  const peacefulRaw = usePeacefulContext(weather, conditions.now);
  const peaceful = useMemo(() => ({ ...peacefulRaw, glider: peacefulRaw.glider && unlocks.glider }), [peacefulRaw, unlocks.glider]);
  // Audio pass (row 169 / polish-ownership item 9): the hourly music player
  // follows the real clock everywhere on this island; cafe and other
  // interiors override the outdoor block with their own bed.
  const [atBar, setAtBar] = useState(false);
  const musicOverride = inside === "cafe" ? "cafe" : inside ? "interior" : atBar ? (phase === "night" ? "bar-night" : "bar-evening") : null;
  useMusicDirector({ season: season.season, override: musicOverride });
  useEffect(() => AudioManager.prepare(), []); // behind the loading screen, not mid-walk
  const ambientPhase: AmbientPhase = phase === "evening" ? "dusk" : phase;
  const [fishing, setFishing] = useState(false);
  const [bagOpen, setBagOpen] = useState(() => devHome.get("sheet") === "bag");
  const identity = useWorldIdentity();
  const arrivalFlag = useArrivalFlag(identity.signedIn);
  const step = welcomeStep({ lookLoaded: mine.loaded, lookSaved: mine.saved, signedIn: identity.signedIn, progressionLoaded, chapterFresh: chapterActions.fresh,
    arrived: arrived || arrivalFlag.arrived, replay: DEV && !arrived && devHome.get("arrival") === "1" });
  const arrivalPhase = useArrivalPhase();
  // Arriving (before the walk-along): the player holds still, so no prompt and no key hints; the HUD stands back.
  const welcoming = arrivalPhase !== null && arrivalPhase !== "tutorial";
  // Golden hour for the crossing, whatever the real time (specs/v1-drop.md §1.4): the light, the sun and a clear sky.
  // From the boat's first beat: aboard and in the creator the island is paused under the reflection, so the golden
  // island mounts there unseen and is compiled before the crossing shows it (ArrivalWorld WarmCrossing).
  const golden = arrivalPhase === "aboard" || arrivalPhase === "creator" || arrivalPhase === "clearing" || arrivalPhase === "crossing";
  // Talking with a resident (lib/game/residentTalk.ts): this viewer's own; who's in reach names the prompt.
  const talkNow = useSyncExternalStore(subscribeTalk, talkView, emptyTalkView);
  const talking = talkNow.activeId !== null;
  // The boat between the village and your island, and a first login's arrival by it (arrival-wharf.md §3).
  const villageDock = useMemo(() => wharfDock(), []);
  const dockOf = useCallback((place: TripPlace) => (place === "home" ? HOME_PIER : villageDock), [villageDock]);
  const goTo = useCallback((place: TripPlace) => {
    setSite(place); setInside(null); setReturned(false); setExitFrom(null); setFromBoat(place === "village");
    setSceneShown(n => n + 1); // a fresh scene gate: the boat comes in once the island has loaded and warmed up
  }, []);
  const trip = useTripControl({ dockOf, goTo, site, ready });
  const { start: startTrip, arrive: arriveByBoat } = trip;
  // A trip or the arrival: the world's prompts, tools and hints stand back.
  const cinematic = welcoming || trip.active;
  const moveKeys = useMoveKeys(), abilityKeys = useAbilityKeys();
  const touch = useCoarsePointer() || devHome.get("touch") === "1";
  // Row 312: the HQ visit with Alice after Bram's tour, and the tools residents hand over (components/game/hq).
  const closeMenu = useCallback(() => setLayer(null), []);
  const hq = useHqOnboarding({ inside, free: ready && !fading && !sheet && !mapOpen && !bagOpen && !donateOpen && !talking, menuOpen: layer === "ui", mapOpen,
    touch, name: identity.signedIn ? identity.display_name : null, owned: peaceful.owned, arriving: arrivalPhase !== null, closeMenu }, DEV ? devHome : null);
  const hqArrived = hq.arrived;
  // Mouse-look (specs/camera-orbit.md): the hint while the mouse is free, the crosshair while it looks in the ruins.
  const captured = useSyncExternalStore(subscribeCapture, readCapture, () => "off" as const);
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
    const c = DROPS.classes ? pathView?.classes : null, kit = classAura?.kit, f = c?.cosmetics.frame;
    setClassTag(kit && c ? { icon: kit.look.icon, title: c.title ?? kit.name, color: kit.look.ramp[1], frame: f === "mastery:bronze" ? "bronze" : f === "mastery:silver" ? "silver" : f === "mastery:gold" ? "gold" : null } : null);
  }, [pathView, classAura]);
  // Classes v2 (§1.13) opened the Path sheet with P; v1 gives P to photo mode (specs/v1-drop.md §9, David) while the
  // classes wait for v3. The Path sheet stays a click away from the Oracle.
  // The tool wheel (specs/game-ui.md): what it holds, what you hold (this device's), your stock for the pins.
  const heldState = useHeld();
  const wheelKeys = useWheelKeys();
  // Bram's hints name your own keys (or say it for a touch screen).
  const hintKeys = useMemo<HintKeys>(() => ({ move: [moveKeys.forward, moveKeys.left, moveKeys.back, moveKeys.right].map(keyName).join(" "), jump: keyName(moveKeys.jump),
    wheel: keyName(wheelKeys.wheel), bag: keyName(identity.settings.key_bindings.openJournal), touch }), [moveKeys, wheelKeys.wheel, identity.settings.key_bindings.openJournal, touch]);
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
    // Weapons across your back and on the wheel are combat's drop (lib/game/drops.ts).
    p.armed = g.gateOpen && DROPS.weapons;
    if (g.stats) p.stats = g.stats;
    p.level = g.level;
    if (g.maxHp) { p.maxHp = g.maxHp; p.hp = Math.min(p.hp, g.maxHp); }
    // Classes v2 (the flag on and the subclass's family wave landed): its kit at its mastery; otherwise today's kit and loadout.
    const v2 = g.view?.classes?.kit ? classKit(g.view.classes.kit) : null;
    combat.rt.v2 = null;
    setTamed(combat.rt, v2 && beastKit(v2) ? g.view!.classes!.tamed ?? [] : null); // the Summoner's tamed beasts (the rest wait at the ritual circle)
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
  // Dev (evidence scripts): where HQ's door is and where the bugs live (row 312's tool quests).
  useEffect(() => { if (DEV) Object.assign(window, { __hqWorld: { door: hqDoor, bugs: villageNodes().bugs.map(b => ({ id: b.id, x: b.x, z: b.z })) } }); }, [hqDoor]);
  const [detectedTier, setDetectedTier] = useState<QualityTier | null>(null);
  const onTier = useCallback((tier: QualityTier) => {
    setDetectedTier(tier);
    actions.detect({ liteMode: tier === "light" });
  }, [actions]);
  const liteMode = graphics.liteMode;
  // The canvas's resolution: half with the pixel finish; without it up to 1.5 device pixels per CSS pixel, but never
  // past 1 on Lite (the weaker GPUs Lite is for draw every extra pixel; v1 performance, specs/perf/2026-10-v1-results.md).
  const canvasDpr = tierDpr(liteMode, graphics.pixelated ? 0.5 : [1, 1.5]);
  const castShadows = graphics.shadows && !liteMode;
  // The creator and the wardrobe cover the screen: the island stops drawing under them (it resumes as they close).
  const creatorOpen = useCreatorOpen();
  const seasonRows = useSeasonPalettes();
  const seasonKey = JSON.stringify(season.weights);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value: the blend object is rebuilt every render.
  const look = useMemo(() => seasonLook(season, paletteBySeason(seasonRows)), [seasonKey, seasonRows]);
  const lookPreset = preset ?? CURRENT;
  // The key light follows the real sun (row 239); /lab/look's edited preset keeps its own sun sliders. The arrival's
  // crossing is always dawn's golden light under a clear sky; you step into real island time on the dock.
  const dawnStep = golden ? Math.floor(conditions.now / 600_000) : 0;
  const dawnSun = useMemo(() => solarPosition(phaseInstant("dawn", new Date(dawnStep * 600_000))), [dawnStep]);
  const sun = preset ? null : golden ? dawnSun : conditions.sun;
  // Across a phase boundary the light blends continuously from one phase's look to the next (living-village §5).
  const blend = useMemo(() => (golden ? { from: "dawn" as IslandPhase, to: "dawn" as IslandPhase, t: 0 } : conditions.blend), [golden, conditions.blend]);
  const weatherBlend = useMemo((): WeatherBlend => (golden ? { from: "clear", to: "clear", t: 1 } : conditions.weatherBlend), [golden, conditions.weatherBlend]);
  const sceneWeather: IslandWeather = golden ? "clear" : weather;
  const scenePhase: IslandPhase = golden ? "dawn" : phase;
  const dayLight = useMemo(() => weatherLight(withSeason(islandLightAt(lookPreset, blend, sun), look), weatherBlend), [blend, look, weatherBlend, lookPreset, sun]);
  // A fog night eases in with the dark (the porch-light curve) while a tradition has fog nights on; never on the crossing.
  const fogNight = traditions.content.fog_nights && !inside && !golden ? windowLit(dayLight) : 0;
  // The new world (a heightfield in the village's place) has its own warmer fog and livelier night.
  const smooth = useMemo(() => !!village().terrain, []);
  const light = useMemo(() => fogNightLight(smooth ? smoothWorldLight(dayLight) : dayLight, fogNight), [smooth, dayLight, fogNight]);
  const conditionsLabel = `${season.season[0].toUpperCase()}${season.season.slice(1)}${Object.values(season.weights).some(w => w > 0 && w < 1) ? " (changing)" : ""} · ${weather[0].toUpperCase()}${weather.slice(1)}`;
  const grade = inside === "cafe" ? { ...CLUBHOUSE_LIGHTING[phase].grade, ...CAFE_GRADE } : inside ? CLUBHOUSE_LIGHTING[phase].grade : light.grade;
  const atHome = site === "home";
  const heading = roomHeading({ site, inside, atHome, event: islandEvent?.goal.title ?? null });
  const wheelSite: WheelSite = site === "ruins" ? "ruins" : atHome ? "home" : "village";
  // A first arrival starts with an empty tool bag: the wheel holds only what Bram has handed over (lib/game/arrival/tools.ts).
  const arrivalTools = useArrivalTools();
  // After it (row 312), a new arrival's net and shovel come from residents: `taught`, and `owned` with what they've handed over.
  const wheelItems = useMemo(() => gateWheel(wheelContents({ site: wheelSite, owned: hq.owned, chosen: heldState.chosen, weapons: weaponList.split(","), defaultWeapon, armed, pins: heldState.pins, stock, taught: hq.taught }), arrivalTools),
    [wheelSite, hq.owned, hq.taught, heldState.chosen, weaponList, defaultWeapon, armed, heldState.pins, stock, arrivalTools]);
  // Indoors you walk with empty hands (the wheel is outdoors and in the ruins).
  const held = inside ? null : heldItem(heldState, wheelItems);
  const [eating, setEating] = useState(false);
  const act = useCallback((action: Near) => {
    // What a later drop opens never acts, whatever asks (lib/game/drops.ts).
    if ((!DROPS.homeIsland && (action === "home" || action === "claim")) || (!DROPS.combat && (action === "ruins" || action === "missions"))
      || (!DROPS.oracle && action === "oracle_enter") || (!DROPS.cafe && (action === "cafe" || action === "cafe_enter"))) return;
    // The plaza's board and HQ's own (the visit with Alice waits for you to read it there).
    if (action === "notice" || action === "board") { setSheet("notice"); if (action === "board") hqEvent("board"); return; }
    if (action === "founder") { setSheet("plaque"); return; }
    // HQ's coffee bar, aquarium and locked admin doors: a line each, nothing more (principle 3: no reward for visiting).
    if (action === "coffee" || action === "aquarium" || action === "admin") { toast(HQ_LINES[action], action === "coffee" ? iconUrl("lounge-tea") : undefined); return; }
    // In the shop, the shopkeeper asks what you're after first (ShopkeeperChoice): the game's things, or the club merch.
    if (action === "counter") { setSheet(inside === "shop" ? "shopkeeper" : "counter"); return; }
    if (action === "cafe") { setSheet("cafe"); return; }
    if (action === "sell") { setSheet("sell"); return; }
    if (action === "owner") { window.dispatchEvent(new CustomEvent("tsi:cafe-owner-talk")); return; }
    if (action === "talk") { requestTalk(talkStore.near.id); return; }
    if (action === "bram") { arrivalEvent("talked"); return; }
    if (action === "knock") { if (knockSpot.current) void knockAt(knockSpot.current); return; }
    // The catch board's clues are the collection journal's.
    if (action === "catch") { setBagOpen(true); return; }
    if (action === "mailbox") { setSheet("letters"); return; }
    if (action === "monument") { setSheet("monument"); return; }
    if (action === "curator") { setDonateOpen(true); return; }
    if (action === "display") { setSheet("trophies"); return; }
    // Reporting to Alice (the visit's first step): the desk is hers to talk at; otherwise the profile showcase.
    if (action === "desk") { if (hq.waiting === "wren") hqEvent("wren"); else setSheet("showcase"); return; }
    // Stepping into the fitting room: its curtain sweeps across (FittingRoom), then the wardrobe opens.
    if (action === "fitting") { window.dispatchEvent(new CustomEvent("tsi:fitting")); window.setTimeout(() => setSheet("fitting"), FITTING_STEP_MS); return; }
    if (action === "closet" || action === "chest") { setSheet(action); return; }
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
    if (action === "bench" || action === "stool") { if (benchSpot.current) window.dispatchEvent(new CustomEvent("tsi:sit", { detail: benchSpot.current })); return; }
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
    if (action === "home" || action === "village") { if (!fading) { setNear(null); startTrip(atHome ? "home" : "village", action); } return; }
    if (fading || !action || !["enter", "exit", "house", "museum_enter", "cafe_enter", "oracle_enter", "shop_enter", "ruins", "ruins_exit"].includes(action)) return;
    setFading(true); setNear(null);
    // Doors sound as you go in and out (the café bell, row 125, replaces enter.ogg there when it lands).
    AudioManager.playSFX(action === "exit" || action === "ruins_exit" ? "exit" : "enter");
    window.setTimeout(() => {
      if (action === "enter") setInside("hq");
      if (action === "house") setInside("house");
      if (action === "museum_enter") setInside("museum");
      if (action === "cafe_enter") setInside("cafe");
      if (action === "exit") setExitFrom(inside === "museum" || inside === "oracle" || inside === "cafe" || inside === "shop" ? inside : null);
      if (action === "shop_enter") setInside("shop");
      if (action === "oracle_enter") setInside("oracle");
      if (action === "ruins") { setSite("ruins"); setInside(null); setRuinsRun(n => n + 1); }
      if (action === "ruins_exit") {
        setSite("village"); setExitFrom("ruins"); setReturned(true);
        const p = combat.rt.player;
        for (const w of Object.keys(p.hits) as (keyof typeof p.hits)[]) if (p.hits[w]) { void postWear(w, p.hits[w], false); p.hits[w] = 0; }
      }
      if (action === "exit") { setInside(null); setReturned(true); }
      if (action === "exit" || action === "enter") setFromBoat(false);
      // A fresh warm-up probe for the next scene: the fade lifts when it has loaded and compiled.
      setSceneShown(n => n + 1);
    }, 320);
  }, [fading, chapterActions, homeActions, inside, gate, layout, startTrip, atHome, hq.waiting]);
  // The arrival (components/game/arrival): it starts once the island is up on the village; the crossing is the boat's.
  const arrivalPlays = step === "arrival" && ready && !inside && site === "village";
  const startCrossing = useCallback(() => arriveByBoat("village", true, true), [arriveByBoat]);
  const keepLook = useCallback((look: Parameters<typeof saveMyLook>[0], name: string | null) => {
    void saveMyLook(look).then(() => (name ? saveName(name) : undefined));
  }, []);
  // Arrived: the account's flag and Bram's reward (once), his old rod's card, the chapter 1 objective.
  const finishArrival = useCallback(() => {
    markWelcomed(); setArrived(true); arrivalFlag.markArrived(); setObjectiveNew(true);
    window.dispatchEvent(new CustomEvent("tsi:gift", { detail: { key: TUTORIAL_REWARD.rod, name: TUTORIAL_REWARD.name, title: TUTORIAL_REWARD.title, note: TUTORIAL_REWARD.note } }));
    // A new arrival (row 312): its tools are taught and the visit with Alice starts. A dev replay signed out counts as one.
    void postArrival().then(r => { if (r?.granted) setHudCoins(r.balance); hqArrived(r ? r.taught : DEV && devHome.get("arrival") === "1"); });
  }, [arrivalFlag, hqArrived, devHome]);
  // The walk-along waits for the bag (the Collection, B) to be opened once.
  useEffect(() => { if (bagOpen) arrivalEvent("bagOpened"); }, [bagOpen]);
  useEffect(() => {
    if (!objectiveNew) return;
    const t = window.setTimeout(() => setObjectiveNew(false), 2600);
    return () => window.clearTimeout(t);
  }, [objectiveNew]);
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
    const events = ["tsi:peaceful-got", "tsi:fish-caught", "tsi:eaten", "tsi:crafted", "tsi:bag-got", "tsi:bag-changed"];
    events.forEach(e => window.addEventListener(e, load));
    return () => events.forEach(e => window.removeEventListener(e, load));
  }, []);
  // The ruins' hand (lib/game/ruinsHand.ts): the wheel and the weapon in hand kept in step. Elsewhere a held item that
  // isn't on the wheel just isn't shown (your inventory and stock load after the island), never dropped.
  useRuinsHand(site, wheelItems, held, runtimeWeapon, equipOnServer);
  // What's in reach for the held tool, and what left click does with it.
  const reach: Reach = useMemo(() => ({ water: near === "fish", bug: near === "net" ? targetLabel : null, dig: near === "dig" ? targetLabel : null }), [near, targetLabel]);
  const toolAction = clickAction(held, reach, wheelSite);
  const applyTool = useCallback(() => {
    if (site === "ruins" || inside || fishing || sheet || bagOpen || decor.decorating || cinematic || talking || fading || eating || !held || !toolAction) return;
    const at: [number, number] = [player.current.x, player.current.z];
    const clip = (name: string) => window.dispatchEvent(new CustomEvent("tsi:emote", { detail: { clip: name } }));
    if (toolAction.verb === "cast") {
      const spot = fishSpot.current;
      // A full bag has no slot for a fish (the server refuses it too): the note over the water, no cast.
      if (spot && !bagRoom()) { window.dispatchEvent(new CustomEvent("tsi:bag-full", { detail: { x: spot.target[0], z: spot.target[1] } })); return; }
      // Hold to charge, let go to cast (FishingOverlay); the server rolls on the held rod (its tier) from where you stand.
      if (spot) window.dispatchEvent(new CustomEvent("tsi:fish-start", { detail: { x: spot.target[0], z: spot.target[1], water: spot.water, site: atHome ? "home" : "village", from: at } }));
      return;
    }
    if ((toolAction.verb === "swing" || toolAction.verb === "dig") && toolAction.target) {
      const target = getPeacefulTarget();
      if (target) window.dispatchEvent(new CustomEvent("tsi:peaceful-act", { detail: { id: target.id, tool: held.key } }));
      return;
    }
    // The net through the air: the footstep quickened as the whoosh (the combat swing's stand-in), never a dialogue blip.
    if (toolAction.verb === "swing") { clip("Net"); AudioManager.playSFX("footstep", { rate: 1.5, gain: 0.45 }); return; }
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
  }, [site, inside, fishing, sheet, bagOpen, decor.decorating, cinematic, talking, fading, eating, held, toolAction, atHome, player]);
  // Left click uses what you hold: in mouse-look, or with the mouse-look setting off (a touch screen uses the prompt).
  // Someone under the aim dot takes the click instead (their card, a talk).
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const down = (e: PointerEvent) => { if (e.button === 0 && e.pointerType === "mouse" && (capture.state === "captured" || capture.state === "off") && readAimTarget() === null) applyTool(); };
    el.addEventListener("pointerdown", down);
    return () => el.removeEventListener("pointerdown", down);
  }, [applyTool]);
  const toolNear = near === "fish" || near === "net" || near === "dig";
  // Talking, the arrival and the boat trip are cinematic (world audit item 7): the HUD stands back, flashes included,
  // leaving the dialogue or the trip's Skip. They let the cursor go, but they aren't the pause view.
  const hudCinematic = cinematic || talking;
  // Photo mode (v1): the HUD steps away and the camera is free; it may open while nothing else holds the world.
  const photo = usePhoto();
  const photoAllowed = ready && !fading && !hudCinematic && !fishing && !sheet && !bagOpen && !donateOpen && !decor.decorating && !trip.active;
  // The UI view (Esc 1): the fuller HUD over the live game; it stands back for a cinematic.
  const uiView = layer !== null && !hudCinematic;
  const full = isFullHud({ always: alwaysFullHud, keyHeld: hudKey, uiView, cinematic: hudCinematic });
  // On a phone the menu button opens the UI view; the heading and touch hint flash (world audit item 11).
  const compact = compactTouchHud({ touch, always: alwaysFullHud });
  // Mouse-look ending on its own (Esc, the window losing focus) opens the UI view; capturing again closes the layers.
  useEffect(() => subscribePause(() => setLayer(l => l ?? "ui")), []);
  useEffect(() => { if (captured === "captured") setLayer(null); }, [captured]);
  // The island map is the village's (the minimap and M). At HQ (Alice shows you the map there, row 312) it opens with you
  // at HQ's door; the minimap stays outdoors.
  const mapHere = !inside && !atHome && site !== "ruins";
  const mapOpenable = mapHere || (inside === "hq" && site === "village");
  const mapPlayer = useMemo(() => ({ current: new THREE.Vector3(hqDoor?.[0] ?? 0, 0, hqDoor?.[1] ?? 0) }), [hqDoor]);
  // The dock's counts: friend requests waiting, and who's on the island while you're with the others.
  const friends = useFriends(), roster = useRoster(), netStatus = useNetStatus();
  // Hold the HUD key (H) for the full HUD.
  useEffect(() => {
    const key = wheelKeys.hud;
    const down = (e: KeyboardEvent) => { if (e.key.toLowerCase() === key && !e.repeat && !(e.target instanceof HTMLElement && e.target.closest("input, textarea, select"))) setHudKey(true); };
    const up = (e: KeyboardEvent) => { if (e.key.toLowerCase() === key) setHudKey(false); };
    const blur = () => setHudKey(false);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, [wheelKeys.hud]);
  // In the minimal HUD the place name shows as a scene comes in.
  const headingFlash = useFlash(ready ? sceneShown + 1 : 0, FLASH_MS.heading);
  // Only a tool you have on the wheel (a first arrival's bag is empty until Bram hands over his rod).
  const wantTool = toolNear ? toolNeeded(held, reach) : null;
  const needTool = wantTool && wheelItems.some(i => i.kind === wantTool) ? wantTool : null;
  // Decorating, the dev panel and the arrival work with the cursor: mouse-look lets go while they are up.
  useEffect(() => { holdCursor("decorate", decor.decorating); holdCursor("greeting", welcoming); holdCursor("talk", talking); holdCursor("options", devPanel); }, [decor.decorating, welcoming, talking, devPanel]);
  useEffect(() => () => { holdCursor("decorate", false); holdCursor("greeting", false); holdCursor("talk", false); holdCursor("options", false); }, []);
  const holdObjective = step === "creator" || step === "arrival" || arrivalPhase !== null || trip.active;
  // The quest tracker (playtest round 1): the walk-along's steps while Bram shows you round, otherwise the chapter being
  // worked on (none while the member mutes the HUD's quests: the objective is empty then).
  const tutorialQuest = useTutorialQuest({ bag: keyName(identity.settings.key_bindings.openJournal), touch });
  const trackedChapter = useMemo(() => chapterQuest(progressionState.chapters, !!progression.objective.text), [progressionState.chapters, progression.objective.text]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      // Arriving, the keys are the arrival's (components/game/arrival: a press skips the beat showing).
      if (welcoming) return;
      // On a boat trip the keys are the trip's (a press skips it: useTripControl); nothing opens over it.
      if (myTrip.current) return;
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
      // E at the water's edge (or by a bug or a dig spot) is the held tool's click's: there it talks to a resident in reach.
      if (event.key.toLowerCase() === "e") act((near === "fish" || near === "net" || near === "dig") && talkStore.near.id ? "talk" : near);
      if (event.key.toLowerCase() === "z" && !inside && !(site === "ruins" && Object.values(abilityKeys).includes("z"))) { toggleZoom(); saveOrbit(); }
      if (menu === "openMap" && mapOpenable) setMapOpen(true);
      // The naming pass (menus §4): B the Collection (catches), I the Bag (items), K the wallet, J the Journal (quests).
      if (menu === "openJournal") setBagOpen(true);
      if (menu === "openBag") setSheet("bag");
      if (menu === "openWallet") setSheet("wallet");
      if (!menu && event.key.toLowerCase() === "j") setSheet("journal");
      if (menu === "openMail") setSheet("letters");
      // The Esc that ended mouse-look is the browser's (it opened the UI view); a later one closes what's open, then
      // steps through the Esc layers, indoors too (playtest round 1: a room is left by its door; lib/game/sceneGate.ts).
      if (event.key === "Escape") {
        const open = !!sheet || bagOpen || donateOpen || decor.decorating || !!(reveal && inside === "oracle") || studyHoldsPrompt() || !!document.querySelector('[role="dialog"]');
        const locked = capture.state === "captured" && !!document.pointerLockElement;
        const esc = escapeAction({ captureEnded: escapeEndedCapture(), locked, fading, open });
        if (esc === "close") { setSheet(null); if (decor.selected) decor.cancel(); }
        // An Escape that came through with the mouse still held lets it go: the end of the lock opens the UI view.
        if (esc === "layer") { if (locked) document.exitPointerLock(); else setLayer(nextLayer); }
      }
      if (atHome && event.key.toLowerCase() === "f") decor.toggle();
      if (decor.decorating && event.key.toLowerCase() === "r") decor.rotateSelected();
      if (decor.decorating && event.key.toLowerCase() === "x") decor.putAway();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [act, near, inside, atHome, decor, identity.settings, welcoming, site, abilityKeys, sheet, bagOpen, donateOpen, reveal, fading, mapOpenable]);
  // Development only (the old wrench panel, hud-first-login §4): Settings' Dev tab shows or hides it; it stays mounted
  // (the class playtest's harness and slow motion run from it) and stands on the left, clear of the minimap.
  const devTools = DEV ? <>
    <Toggle checked={devPanel} onChange={setDevPanel} hint="The class playtest (?combat=demo), the camera view, the time of day, the clearing reset and frame timing.">Show the dev panel</Toggle>
    <p className={styles.hint} data-testid="island-conditions">{conditionsLabel}{conditions.sunSource === "fallback" ? " · sun table" : ""}</p>
  </> : undefined;
  return (
    <main className={`${styles.world} gui`} data-light={phase} data-inside={inside ?? undefined} data-site={site} data-trip={trip.active || undefined} data-cinematic={hudCinematic || undefined} data-compact={compact || undefined} data-ui={uiView || undefined} data-photo={photo.open || undefined}>
      {/* The branded dark round the rooms that show the space outside them (InteriorBackdrop): behind the canvas. */}
      {inside === "shop" || inside === "hq" || inside === "museum" || inside === "cafe" ? <InteriorBackdrop room={inside} /> : null}
      <DevUiTheme />
      <Canvas ref={canvasRef} tabIndex={0} role="application" aria-label="Island walking area" style={{ zIndex: 0, imageRendering: graphics.pixelated ? "pixelated" : "auto" }} gl={{ antialias: false, powerPreference: "high-performance" }} dpr={canvasDpr}
        camera={{ position: [0, 10.2, -21], fov: BASE_FOV, near: 0.1, far: 120 }} shadows={castShadows ? "percentage" : false} frameloop={creatorOpen ? "never" : "always"}
        onCreated={({ gl }) => { gl.info.autoReset = false; gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
        <Suspense fallback={null}>
          {site === "ruins" ? <RuinsScene key={`ruins-${ruinsRun}`} level={level} phase={phase} light={light} look={look} weather={weather} liteMode={liteMode} castShadows={castShadows} zoom={devZoom} player={player}
              onNear={n => setNear(n === "exit" ? "ruins_exit" : n)} onDefeat={onRuinsDefeat} start={ruinsRun <= 1 ? devAt : null} glider={peaceful.glider} />
            : inside === "oracle" ? <OracleTemple frozen={fading || sheet === "oracle"} talking={sheet === "oracle"} light={light} player={player} onNear={n => setNear(n)} ceremony={reveal} />
            : inside === "cafe" ? <CafeInterior phase={phase} player={player} frozen={fading || !!sheet} identity={identity} level={level} onNear={setNear} />
            : inside === "shop" ? <ShopInterior frozen={fading || sheet === "counter" || sheet === "shopkeeper" || sheet === "fitting"} talking={sheet === "counter" || sheet === "shopkeeper"} light={light} playerPosRef={player}
              onNearestStation={s => setNear(s?.id === "counter" ? "counter" : s?.id === "exit" ? "exit" : s?.id.startsWith("fitting") ? "fitting" : null)} />
            : inside === "museum" ? <MuseumInterior wings={museumWings} frozen={fading || donateOpen} talking={donateOpen} light={light} player={player} onNear={n => setNear(n === "donate" ? "curator" : n)} />
            : inside === "hq" ? <HqInterior light={light} player={player} frozen={fading} talking={sheet === "showcase" || hq.card !== null || (talking && talkNow.slug === WREN.slug)} member={peaceful.member} onNearestStation={hqStation} />
            : inside === "house" ? <HomeInterior layout={layout} phase={phase} light={light} frozen={fading} player={player} onNear={(n: HouseNear) => setNear(n)}
              decorating={decor.decorating} selected={decor.selected} onPlace={decor.place} onPickUp={decor.pickUp} />
            : atHome ? <HomeIslandScene held={eating || trip.active ? null : held} identity={identity} level={level} peaceful={peaceful} fishSpot={fishSpot} fishing={fishing} phase={phase} light={light} look={look} weather={weather} liteMode={liteMode} castShadows={castShadows} zoom={devZoom}
              overview={overview} returned={returned} player={player} onNear={(n: HomeNear) => setNear(n)} outdoor={layout.outdoor}
              decorating={decor.decorating} selected={decor.selected} onPlace={item => decor.place("outdoor", item)} onPickUp={item => decor.pickUp("outdoor", item)} />
            : <IslandScene held={eating || trip.active ? null : held} identity={identity} level={level} devAt={devAt} exitFrom={exitFrom} peaceful={peaceful} fishSpot={fishSpot} fishing={fishing} chapter={chapterFlags} fromBoat={fromBoat} progression={progressionWorld} ceremony={ceremony} event={islandEvent} traditions={traditions} fogNight={fogNight}
              arriving={welcoming} hintKeys={hintKeys} campfireHour={campfireHour} talking={talking} phase={scenePhase} light={light} look={look} weather={sceneWeather} overview={overview} zoom={devZoom} reset={reset} returned={returned} liteMode={liteMode} castShadows={castShadows} player={player} onNear={setNear} onBar={setAtBar} />}
          {/* Classes v2: the subclass's aura replaces the family's once its kit exists (§1.9). */}
          {DROPS.classes && identity.aura && (classAura ? <Suspense fallback={null}><SubclassAura player={player} kit={classAura.kit} mastery={classAura.mastery} colour={classAura.colour} /></Suspense>
            : identity.family && <Suspense fallback={null}><FamilyAura player={player} color={FAMILIES[identity.family].light} /></Suspense>)}
          <PostFX antialias={!graphics.liteMode && !graphics.pixelated} grade={grade} fx={lookFx(lookPreset, !liteMode)} dof={photo.open ? { at: photoRig.focus, strength: photo.focus } : null} />
          <LookMaterials preset={lookPreset} />
          <SunShadows />
          <Performance player={player} output={perfOutput} />
          {DEV && <PerfProbe />}
          <QualityGovernor dpr={canvasDpr} scene={`${site}:${inside ?? ""}`} />
          <QualityProbe onTier={onTier} />
          <SeatWatch onChange={setSeated} />
          <WarmupProbe key={sceneShown} onReady={onSceneReady} />
          {children}
          <NetWorld area={area} player={player} ready={ready && !fading && netReady} />
          <DanceSync player={player} />
          {!inside && !atHome && site !== "ruins" && near !== "enter" && hqDoor && <LandmarkTag position={[hqDoor[0], 2.9, hqDoor[1]]}>HQ</LandmarkTag>}
          <LabelLayer focus={player} />
          {/* Last, so its frame follows the follow camera's: photo mode's free camera (v1). */}
          {photo.open && <PhotoCamera player={player} />}
        </Suspense>
      </Canvas>
      <header className={styles.heading} data-fading={fading || !ready || hudCinematic || ((!full || compact) && headingFlash === null)} data-clean={full && !compact ? undefined : ""}>
        <h1>{heading.title}</h1>
        {heading.subtitle && <p>{heading.subtitle}</p>}
      </header>
      <AudioController phase={ambientPhase} weather={weather} season={season.season} />
      {/* Top right (playtest round 1, decision 3): while you play, the quest line left of the minimap, the time under it;
          the UI view (Esc 1) grows the minimap and adds coins, the level and the gear left of the quest line. */}
      <div className={styles.hudRight} data-hidden={hudCinematic || undefined}>
        <div className={styles.hudLead} data-new={objectiveNew || undefined}>
          <TopCluster className={styles.rightCluster} full={full} buttons={uiView} hidden={hudCinematic}
            onWallet={() => setSheet(value => (value === "wallet" ? null : "wallet"))} walletKey={keyName(identity.settings.key_bindings.openWallet)}>
            <button className={hudButton} onClick={() => setSheet("settings")} aria-label="Settings" title="Settings"><Settings size={18} aria-hidden /></button>
          </TopCluster>
          {/* Bram's walk-along, then the HQ visit with Alice and a tool's little quest (row 312), then the chapter. */}
          <QuestTracker className={styles.questSlot} quest={tutorialQuest ?? hq.quest ?? trackedChapter} hidden={tutorialQuest || hq.quest ? false : holdObjective} onOpen={() => setSheet("journal")} />
        </div>
        <div className={styles.hudColumn} data-minimap data-new={objectiveNew || undefined}>
          {mapHere && !holdObjective && <MiniMap playerPosRef={player} plot={objectivePlot} big={uiView} onOpen={() => setMapOpen(true)} />}
          <HudClock weather={weather} phase={phase} />
          {/* Kept for a mini health bar when combat drops (playtest round 1); nothing drawn yet. */}
          <div className={styles.healthSlot} data-slot="health" aria-hidden="true" />
        </div>
      </div>
      {DEV && <section id="island-options" className={styles.panel} data-open={devPanel} aria-label="Developer view options" onKeyDown={(event) => {
        if (devPanel && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDevPanel(false); }
      }}>
        {/* The class playtest (specs/classes/playtest.md): ?combat=demo only. */}
        <PlaytestControls ruins={site === "ruins"} onChanged={() => setPathTick(n => n + 1)} />
        <div className={styles.views} aria-label="Camera view">
          <button aria-pressed={!overview} onClick={() => setOverview(false)}>Walk</button>
          <button aria-pressed={overview} onClick={() => setOverview(true)}>Overview</button>
        </div>
        {/* The time of day: the kit's segmented pills, not a dropdown (playtest round 1). */}
        <div className={styles.preset}><span>Time</span></div>
        <div className={styles.segmented} role="group" aria-label="Time of day" data-testid="time-of-day" data-wrap="">
          <button aria-pressed={!forced} onClick={() => setForced(null)} title={`Live, as in Toronto · ${PHASE_NAMES[conditions.livePhase]}`}>Live</button>
          {ISLAND_PHASES.map((key) => <button key={key} aria-pressed={forced === key} onClick={() => setForced(key)}>{PHASE_NAMES[key]}</button>)}
        </div>
        <p className={styles.hint}>{conditionsLabel}{conditions.sunSource === "fallback" ? " · sun table" : ""}</p>
        <button className={styles.return} onClick={() => { setInside(null); setSite("village"); setReturned(false); setReset((n) => n + 1); setOverview(false); }}>Return to clearing</button>
        <details className={styles.performance} open>
          <summary>Frame timing</summary>
          <output ref={perfOutput}>Measuring…</output>
        </details>
        <button className={styles.return} onClick={() => setDevPanel(false)}>Close the dev panel</button>
      </section>}
      {near && !toolNear && !sheet && !hq.card && !cinematic && !talking && !(reveal && inside === "oracle") && (CLOSED.includes(near)
        ? <p className={styles.interact} data-closed="true" role="status">{NEAR_LABELS[near]}</p>
        : fishing ? null : <button className={styles.interact} onClick={() => act(near)}><kbd>{touch ? "Tap" : "E"}</kbd>{near === "forage" ? targetLabel ?? NEAR_LABELS[near] : near === "talk" && talkNow.nearName ? `Talk to ${talkNow.nearName}` : near === "bram" ? bramPrompt() : near === "desk" && hq.waiting === "wren" ? `Talk to ${WREN.name}` : near === "stool" && seated ? "Leave the bar" : near === "bench" || near === "stool" || near === "bed" ? seatPrompt(NEAR_LABELS[near], seated) : NEAR_LABELS[near]}</button>)}
      {/* The held item's use (specs/game-ui.md §2): what left click does with it here, or the tool something in reach wants. Touch presses the prompt. */}
      {!sheet && !cinematic && !talking && !fishing && !inside && site !== "ruins" && (toolAction && (toolAction.target && (toolNear || toolAction.verb === "eat"))
        ? <button className={styles.interact} data-use onPointerDown={e => { if (e.pointerType !== "mouse" || capture.state !== "captured") applyTool(); }}><kbd>{touch ? "Tap" : "Click"}</kbd>{toolAction.label}</button>
        : needTool && <p className={styles.interact} data-closed="true" role="status"><kbd>{touch ? "Wheel" : keyName(wheelKeys.wheel)}</kbd>Take out your {needTool === "rod" ? "fishing rod" : needTool}</p>)}
      <FishingOverlay rod={held?.kind === "rod" && held.tier ? rodByTier(held.tier) : peaceful.rod} onActiveChange={setFishing} />
      <ToolWheel items={wheelItems} held={heldState.held} wheelKey={wheelKeys.wheel} touch={touch} onEquip={holdItem} onSwap={() => swapHeld(wheelItems)}
        enabled={ready && !inside && !fishing && !sheet && !bagOpen && !cinematic && !talking && !fading && !decor.decorating && !(touch && uiView)} />
      <EmoteWheel emoteKey={wheelKeys.emote} touch={touch} onPlay={entry => playWheelEntry(entry, player.current)}
        enabled={ready && site !== "ruins" && !fishing && !sheet && !bagOpen && !cinematic && !talking && !fading && !decor.decorating && !(touch && uiView)} />
      <DonateSheet open={donateOpen} onClose={() => setDonateOpen(false)} onDonated={loadMuseum} />
      <ToastHub />
      {/* What a catch, a find, a craft or a bottle gave you: one card with its art, beside the Bag's fly-in. */}
      <RewardCard />
      <GlideGuideHint show={ready && !fading && !inside && site === "village" && !sheet && !cinematic && !talking} />
      {/* Today's gift once the island is showing and nothing else holds the player (first login, a fade, a sheet, a fight). */}
      <DailyGift ready={ready && !fading && !holdObjective && !sheet && !talking && site !== "ruins"} />
      {/* Talking with a resident: the dialogue box (its own keys; the world holds still under it). */}
      <TalkBox />
      {/* Study tables are in the village and the café only: the HUD (its polling and session) lives there. */}
      {(inside === "cafe" || (!inside && site === "village" && DROPS.cafe)) && <StudyHud />}
      <CraftingSheet />
      <CollectionBook open={bagOpen} onClose={() => setBagOpen(false)} keys={identity.settings.key_bindings.openJournal} />
      {/* The Bag shows only as a pickup flies into it; a touch screen's menu button opens the UI view (it has no Esc). */}
      <div className={styles.bagButtons}>
        {touch && !hudCinematic && <button className={styles.menuButton} onClick={() => setLayer(l => (l ? null : "ui"))} aria-expanded={uiView} aria-label={uiView ? "Close the menu" : "Menu"}><Menu size={20} aria-hidden /></button>}
        <BagButton full={false} keyLabel={keyName(identity.settings.key_bindings.openBag)} onOpen={() => setSheet("bag")} />
      </div>
      {/* The UI view's dock (Esc 1): the menu entries over the live game. Their sheets close back to it. */}
      {uiView && <MenuDock touch={touch} unread={progression.unreadLetters} asking={friends.asking} people={netStatus.kind === "joined" ? roster.length : null}
        keys={{ map: keyName(identity.settings.key_bindings.openMap), journal: "J", bag: keyName(identity.settings.key_bindings.openBag), collection: keyName(identity.settings.key_bindings.openJournal), mail: keyName(identity.settings.key_bindings.openMail) }}
        onMap={mapOpenable ? () => setMapOpen(true) : null} onJournal={() => setSheet("journal")} onBag={() => setSheet("bag")} onCollection={() => setBagOpen(true)}
        onFriends={() => setNetSheet("friends")} onPeople={() => setNetSheet("people")} onMail={() => setSheet("letters")} />}
      {/* Esc 2: the system menu. Resume asks for the mouse again; Escape (or ✕) goes back to the game. */}
      <SystemMenu open={layer === "system" && !hudCinematic} signedIn={identity.signedIn} name={identity.display_name} onClose={() => setLayer(null)}
        onResume={() => { setLayer(null); requestResume(); }} onSettings={() => setSheet("settings")} />
      <MapSheet open={mapOpen && mapOpenable} onClose={() => setMapOpen(false)} playerPosRef={mapHere ? player : mapPlayer} plot={objectivePlot} toggleKey={identity.settings.key_bindings.openMap} />
      <CeremonyConfetti active={ceremony && !inside && !atHome} />
      {atHome && !decor.decorating && full && <button className={styles.decorateToggle} onClick={decor.toggle}><kbd>F</kbd> Decorate</button>}
      {atHome && decor.decorating && <DecorateSheet indoor={inside === "house"} selected={decor.selected} layout={layout}
        room={inside === "house" ? layout.rooms[roomAt(player.current.x, layout.rooms.length)] ?? null : null}
        onChoose={decor.choose} onRotate={decor.rotateSelected} onPutAway={decor.putAway} onDone={decor.toggle}
        onFinish={(key, value) => decor.setRoomFinish(roomAt(player.current.x, layout.rooms.length), key, value)} onShop={() => toShop("More furniture")} />}
      <NoticeSheet open={sheet === "notice"} onClose={() => setSheet(null)} keys={STATION_KEY} />
      {/* The HQ visit's cards (row 312): the register, where the check-in code goes, the Founder's plaque. */}
      <RegisterCard open={hq.card === "register"} name={identity.signedIn ? identity.display_name : null} friendCode={friends.view?.code ?? null} letters={progression.unreadLetters ?? null} onDone={() => hqEvent("signed")} />
      <CheckInCard open={hq.card === "checkin"} onDone={() => hqEvent("checkin")} />
      <PlaqueCard open={sheet === "plaque"} onClose={() => { setSheet(null); hqEvent("founder"); }} />
      <ShopkeeperChoice open={sheet === "shopkeeper"} onClose={() => setSheet(null)} onChoose={section => {
        setShopSection(section);
        if (section === "merch") window.dispatchEvent(new CustomEvent("tsi:shopkeeper-say", { detail: { line: MERCH_LINE, clip: "Chat" } }));
        setSheet("counter");
      }} />
      <ShopCounter open={sheet === "counter"} section={inside === "shop" ? shopSection : undefined} onClose={() => setSheet(null)} />
      <LettersSheet open={sheet === "letters"} onClose={() => setSheet(null)} keys={identity.settings.key_bindings.openMail} />
      <BagSheet open={sheet === "bag"} onClose={() => setSheet(null)} keys={identity.settings.key_bindings.openBag} />
      <ChestSheet open={sheet === "chest"} onClose={() => setSheet(null)} keys={STATION_KEY} />
      <SellSheet open={sheet === "sell"} onClose={() => setSheet(null)} keys={STATION_KEY} />
      <WalletSheet open={sheet === "wallet"} onClose={() => setSheet(null)} keys={identity.settings.key_bindings.openWallet} />
      <WardrobeSheet open={sheet === "closet" || sheet === "fitting"} place={sheet === "closet" ? "closet" : "fitting"} onClose={() => { if (sheet === "fitting") window.dispatchEvent(new CustomEvent("tsi:fitting")); setSheet(null); }} onShop={() => { setSheet(null); toShop("More clothes"); }} />
      <PlayerCharacterUI creator={step === "creator"} />
      <JournalSheet open={sheet === "journal"} onClose={() => setSheet(null)} keys="j" />
      <OracleQuizSheet open={sheet === "oracle"} onClose={() => setSheet(null)} onResult={onOracleResult} onPath={pathView?.family ? () => { setPathTick(n => n + 1); setSheet("path"); } : undefined} />
      {pathView && DROPS.classes && <PathSheet open={sheet === "path"} view={pathView} onClose={() => setSheet(null)} onChanged={() => setPathTick(n => n + 1)} />}
      <SettingsSheet open={sheet === "settings"} onClose={() => setSheet(null)} detectedTier={detectedTier} dev={devTools} />
      <FamilyReveal open={!!reveal && inside === "oracle"} family={reveal?.family ?? null} type={reveal?.type ?? ""} onContinue={() => setReveal(null)} />
      <TrophySheet open={sheet === "trophies"} onClose={() => setSheet(null)} />
      <ShowcaseSheet open={sheet === "showcase"} onClose={() => setSheet(null)} />
      <MissionBoardSheet open={sheet === "missions"} onClose={() => setSheet(null)} gateNote={gate.open ? null : gate.reason} />
      <TourneySheet open={sheet === "tourney"} onClose={() => setSheet(null)} />
      <PostersSheet open={sheet === "posters"} onClose={() => setSheet(null)} event={islandEvent} />
      <CafeGoalSheet open={sheet === "cafe"} onClose={() => setSheet(null)} />
      <MonumentSheet open={sheet === "monument"} onClose={() => setSheet(null)} keys={STATION_KEY} />
      {site === "ruins" && <CombatHud player={player} />}
      {DEV && site === "ruins" && <PlaytestHud />}
      {/* Clear of the minimap (left) and the audio widget (bottom right). */}
      {/* A touch screen's UI view is for its menus: the stick and buttons step aside for the dock. */}
      {touch && !hudCinematic && !uiView && (!inside || inside === "cafe") && <TouchControls left="var(--hud-stick-left)" bottom="var(--hud-stick-bottom)" walkOnly={inside === "cafe"} />}
      {(!compact || (headingFlash !== null && !hudCinematic)) && <p className={styles.touchControls} data-flash={compact ? headingFlash ?? undefined : undefined}>Tap the ground to move · two fingers turn the camera</p>}
      {captured === "free" && !touch && !hudCinematic && <p className={styles.lookHint} role="status">Click to look around</p>}
      {captured === "captured" && site === "ruins" && <svg className={styles.crosshair} viewBox="-10 -10 20 20" aria-hidden="true"><circle r="5.5" /><circle r="1.2" /></svg>}
      {captured === "captured" && site !== "ruins" && !inside && !hudCinematic && !photo.open && <AimDot />}
      <div className={styles.fade} data-active={fading} aria-hidden="true" />
      {trip.active && !trip.crossing && <TripVeil phase={trip.phase} to={trip.to} firstLogin={trip.firstLogin} quick={trip.quick} haze={light.fogColor} touch={touch} onSkip={trip.skip} />}
      {/* The arrival (specs/v1-drop.md §1): over everything while it plays, its glyphs and way out during the walk-along. */}
      <Arrival play={arrivalPlays} look={mine.look} askName={identity.signedIn ? { current: identity.display_name } : undefined} touch={touch}
        keys={{ wheel: keyName(wheelKeys.wheel), bag: keyName(identity.settings.key_bindings.openJournal) }} onCross={startCrossing} onSaveLook={keepLook} onDone={finishArrival} />
      <div className={styles.netHud} data-hidden={hudCinematic || undefined}><NetHud area={area} hidden={hudCinematic || photo.open} expanded={uiView} /></div>
      <PhotoMode allowed={photoAllowed} />
      <LoadingStatus ready={ready} />
    </main>
  );
}
