"use client";

/**
 * Peaceful loop in one island scene: forage/bug nodes, the scene's water for
 * casts (the bobber, the line and the catch are drawn on the angler's rod:
 * character/FishingRig.tsx), and the proximity rule the scene's E prompt uses.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import VillageLife, { type NodeSpec } from "./VillageLife";
import BagFullNote from "./BagFullNote";
import { gridFishingWaterHeight } from "@/lib/game/fishingWater";
import { fishingSpot, type FishingSpot, type WaterType } from "@/lib/game/fishingSpots";
import { getPeacefulTarget } from "@/lib/game/peacefulNear";
import { setSceneWater } from "@/lib/game/fishingRig";
import { isGroundAtWorld, type IslandMap } from "@/lib/game/grid";
import type { WorldMoment } from "@/lib/collections/logic";

export type PeacefulNear = "forage" | "net" | "dig" | "fish" | null;

/** The spot the per-frame check writes (one scene runs it at a time): read at the click, copied into the cast's event. */
const SPOT: FishingSpot = { target: [0, 0], water: "river" };
/** Lowest-priority prompt: a forage node (by hand), a catchable bug (the net's) or a dig (the shovel's) in reach, else water in casting reach (the rod's). */
export function peacefulNear(map: IslandMap, classify: (x: number, z: number) => WaterType, x: number, z: number, spotOut: { current: FishingSpot | null }): PeacefulNear {
  const target = getPeacefulTarget();
  if (target) return target.kind === "bug" ? "net" : target.kind === "dig" ? "dig" : "forage";
  spotOut.current = fishingSpot(map, classify, x, z, SPOT);
  return spotOut.current ? "fish" : null;
}

export default function PeacefulLayer({ map, nodes, moment, member, player, ground, highTier, active, treeModels }: {
  map: IslandMap; nodes: { forage: NodeSpec[]; bugs: NodeSpec[] }; moment: WorldMoment; member: string;
  player: React.RefObject<THREE.Vector3>; ground: (x: number, z: number) => number; highTier: boolean; active: boolean;
  /** The tree models this season draws (SEASON_TREES): the fruit hangs in the crown the tree shows. */
  treeModels?: readonly string[];
}) {
  const waterHeight = useMemo(() => (x: number, z: number) => gridFishingWaterHeight(map, x, z), [map]);
  const isWater = useMemo(() => (x: number, z: number) => !isGroundAtWorld(map, x, z), [map]);
  // Every angler's throw here lands on this water, never past the far bank (lib/game/fishingCast.ts).
  useEffect(() => setSceneWater(isWater, waterHeight), [isWater, waterHeight]);
  return <>
    <VillageLife nodes={nodes.forage} bugNodes={nodes.bugs} moment={moment} member={member} player={player} ground={ground} highTier={highTier} active={active} treeModels={treeModels} />
    <BagFullNote ground={ground} />
  </>;
}
