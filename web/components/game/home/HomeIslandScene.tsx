"use client";

/**
 * Personal home island (specs/homes.md §1): same terrain, lighting, time,
 * season and weather as the village via IslandAtmosphere. Small dump house,
 * mailbox, the pier with the boat back to the village (the wharf's, arrival-wharf.md §2),
 * and outdoor decorating with the shared placement code.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import GridWorld from "../grid/GridWorld";
import GridOcean from "../grid/GridOcean";
import PlayerAvatar from "../PlayerAvatar";
import type { WheelItem } from "@/lib/game/toolWheel";
import { ACNHParts, CHALET_VARIANTS } from "../ACNHBuilding";
import { GLBProp, NatureTree, NatureBush, NatureFlowerCluster } from "../NatureModels";
import { IslandAtmosphere, useFollowCamera, type TreeSpot } from "../IslandAtmosphere";
import { PlacementLayer, type GridMapping } from "./PlacementLayer";
import { createHomeIsland, homeBoatPrompt, underHomePier, HOME_SPAWN, HOUSE, HOME_MAILBOX, HOME_PIER, HOME_TREES, HOME_TREE_SEEDS, HOME_BUSHES, HOME_FLOWERS, HOME_RADII } from "@/lib/game/homeIsland";
import { ISLAND_TERRAIN, windowLit, type IslandLight } from "@/lib/game/islandLighting";
import { FadeLight } from "../AmbientProps";
import { SEASON_TREES, SEASON_BUSHES, SEASON_FLOWERS, type SeasonLook } from "@/lib/game/seasonalLook";
import type { IslandWeather } from "@/lib/game/islandWeather";
import type { IslandPhase } from "@/lib/game/islandTime";
import { catalogueItem } from "@/lib/homes/catalogue";
import { footprint, type PlacedItem, type Rotation } from "@/lib/homes/layout";
import PeacefulLayer, { peacefulNear } from "../peaceful/PeacefulLayer";
import { homeNodes } from "@/lib/game/islandNodes";
import type { FishingSpot } from "@/lib/game/fishingSpots";
import type { WorldMoment } from "@/lib/collections/logic";
import { gullAnchors } from "@/lib/game/ambientFauna";
import { boxOccluder, treeOccluder } from "@/lib/game/occluders";
import Wharf from "../wharf/Wharf";
import { myTrip } from "@/lib/game/myTrip";
import styles from "../DefaultIslandWorld.module.css";

const HOME_NODES = homeNodes();
const SEA = () => "sea" as const;

export type HomeNear = "house" | "village" | "mailbox" | "fish" | "forage" | "net" | "dig" | null;
const TREES: TreeSpot[] = HOME_TREES.map(([x, z], i) => ({ x, z, seed: HOME_TREE_SEEDS[i] }));
const DOOR_SPAWN: [number, number, number] = [HOUSE.door[0], 0, HOUSE.door[1] - 0.6];
/** The islet's sea is all one: gulls off its shores in view, butterflies on its flowers, crabs on its sand ring. */
const HOME_GULLS = gullAnchors({ minX: -HOME_RADII.x, maxX: HOME_RADII.x, minZ: -HOME_RADII.z, maxZ: HOME_RADII.z, cx: 0, cz: 0 });

export default function HomeIslandScene({ held = null, identity, level, peaceful, fishSpot, fishing, phase, light, look, weather, liteMode, castShadows, zoom, overview, returned, player, onNear, outdoor, decorating, selected, onPlace, onPickUp }: {
  phase: IslandPhase; light: IslandLight; look: SeasonLook; weather: IslandWeather; liteMode: boolean; castShadows: boolean; zoom: number; overview: boolean;
  /** Came out of the house (spawn at the door) rather than off the boat. */
  returned: boolean;
  player: React.RefObject<THREE.Vector3>; onNear: (near: HomeNear) => void;
  outdoor: readonly PlacedItem[]; decorating: boolean; selected: { piece: string; rot: Rotation; uid?: string } | null;
  onPlace: (item: PlacedItem) => void; onPickUp: (item: PlacedItem) => void;
  identity?: { display_name: string; member: boolean }; level?: number;
  /** What the player holds from the tool wheel (specs/game-ui.md), drawn in the hand. */
  held?: WheelItem | null;
  peaceful: { moment: WorldMoment; member: string; glider: boolean }; fishSpot: { current: FishingSpot | null }; fishing: boolean;
}) {
  const home = useMemo(() => createHomeIsland(), []);
  const world = useMemo(() => home.worldWith(outdoor), [home, outdoor]);
  const spawn = returned ? DOOR_SPAWN : HOME_SPAWN;
  const terrain = useMemo(() => ({ ...ISLAND_TERRAIN, grass: look.grass }), [look.grass]);
  const near = useRef<HomeNear>(null);
  const fauna = useMemo(() => ({ site: { map: home.map, flowers: HOME_FLOWERS, water: SEA }, ground: home.ground, standable: home.fixedFree, surface: home.surface, gulls: HOME_GULLS, player }), [home, player]);
  useEffect(() => { player.current.set(...spawn); }, [spawn, player]);
  const focus = useRef(new THREE.Vector3(...spawn));
  const follow = useMemo(() => ({ ground: home.ground, player, occluders: [boxOccluder(HOUSE.x, HOUSE.z, HOUSE.halfW, HOUSE.halfD, 0, 5), ...TREES.map(t => treeOccluder(t.x, t.z, home.ground(t.x, t.z)))] }), [home, player]);
  useFollowCamera(focus, zoom, overview ? { focus: [0, 0, 0], offset: [6, 13, -16] } : null, follow);
  useFrame(() => {
    const p = player.current;
    const next: HomeNear = Math.hypot(p.x - HOUSE.door[0], p.z - HOUSE.door[1]) < 1.3 ? "house"
      : homeBoatPrompt(p.x, p.z) ? "village"
      : Math.hypot(p.x - HOME_MAILBOX[0], p.z - HOME_MAILBOX[1]) < 1.3 ? "mailbox"
      : decorating || fishing ? null : peacefulNear(home.map, SEA, p.x, p.z, fishSpot);
    if (near.current !== next) { near.current = next; onNear(next); }
  });
  // Outdoor grid: cells are whole world units; +x is screen left, so no mirroring is needed.
  const mapping: GridMapping = useMemo(() => ({
    fromPoint: (point, piece, rot) => {
      const [w, d] = footprint(catalogueItem(piece)?.size ?? [1, 1], rot);
      return { cell: [Math.floor(point.x - w / 2 + 0.5), Math.floor(point.z - d / 2 + 0.5)] };
    },
    toWorld: (item) => {
      const [w, d] = footprint(catalogueItem(item.piece)?.size ?? [1, 1], item.rot);
      const x = item.cell[0] + w / 2, z = item.cell[1] + d / 2;
      return { position: [x, home.ground(x, z), z], rotY: item.rot * Math.PI / 2 };
    },
    footprintQuad: (item) => {
      const [w, d] = footprint(catalogueItem(item.piece)?.size ?? [1, 1], item.rot);
      const x = item.cell[0] + w / 2, z = item.cell[1] + d / 2;
      return { center: [x, home.ground(x, z) + 0.03, z], size: [w, d], rotY: 0 };
    },
  }), [home]);
  return <>
    <IslandAtmosphere phase={phase} light={light} look={look} weather={weather} liteMode={liteMode} castShadows={castShadows} overview={overview}
      ground={home.ground} cloudSize={[HOME_RADII.x * 2 + 4, HOME_RADII.z * 2 + 4]} shadowExtent={16} fireflyAnchors={HOME_BUSHES} trees={TREES} fauna={fauna} />
    <GridWorld map={home.map} light={light} palette={terrain} windScale={liteMode ? 0 : weather === "wind" ? 2.2 : 1} />
    <GridOcean map={home.map} lite={liteMode} skip={underHomePier} />
    <PeacefulLayer map={home.map} nodes={HOME_NODES} moment={peaceful.moment} member={peaceful.member} player={player} ground={home.ground} highTier={!liteMode} active={!fishing && !decorating} treeModels={SEASON_TREES[look.season]} />
    {/* The dump's chalet house (5 × 4.2 cells, same model family as the village café/museum). */}
    <group position={[HOUSE.x, 0, HOUSE.z]}><ACNHParts parts={CHALET_VARIANTS.brown} lit={windowLit(light)} /></group>
    <FadeLight position={[HOUSE.door[0], 1.4, HOUSE.door[1] - 0.2]} color="#ffd68b" intensity={light.lampsOn ? light.lamp * 1.2 : 0} distance={4} />
    <GLBProp url="/assets/acnh/furniture/mailbox.glb" position={[HOME_MAILBOX[0], home.ground(...HOME_MAILBOX), HOME_MAILBOX[1]]} scale={0.1} />
    <Wharf dock={HOME_PIER} light={light} place="home" />
    <Html position={[HOUSE.x, 4.2, HOUSE.z - HOUSE.halfD]} center distanceFactor={10} zIndexRange={[3, 0]}><div className={styles.cue}>Your house</div></Html>
    {TREES.map(({ x, z, seed }, i) => <NatureTree key={i} position={[x, home.ground(x, z), z]} seed={seed} models={SEASON_TREES[look.season]} />)}
    {HOME_BUSHES.map(([x, z], i) => <NatureBush key={i} position={[x, home.ground(x, z), z]} seed={i} models={SEASON_BUSHES[look.season]} />)}
    {SEASON_FLOWERS[look.season].length > 0 && HOME_FLOWERS.map(([x, z], i) => <NatureFlowerCluster key={i} position={[x, home.ground(x, z), z]} seed={i * 3} models={SEASON_FLOWERS[look.season]} />)}
    <PlacementLayer items={outdoor} mapping={mapping} context={{ inside: home.placeable }} active={decorating} selected={selected}
      onPlace={onPlace} onPickUp={onPickUp} plane={{ center: [0, 0.02, 0], size: [HOME_RADII.x * 2, HOME_RADII.z * 2] }} />
    <PlayerAvatar key={`home-${returned}`} spawnPosition={spawn} playerName={identity?.display_name ?? "You"} playerLevel={level} member={identity?.member} player={player} frozen={fishing || (decorating && !!selected)} ride={myTrip.ride}
      world={world} groundHeight={home.ground} groundSurface={home.surface} camTarget={focus} glider={peaceful.glider} held={held} />
  </>;
}
