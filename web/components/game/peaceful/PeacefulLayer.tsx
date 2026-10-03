"use client";

/**
 * Peaceful loop in one island scene: forage/bug nodes, the existing fishing
 * bobber and catch FX, and the proximity rule the scene's E prompt uses.
 */
import { useMemo } from "react";
import * as THREE from "three";
import FishingBobber from "../FishingBobber";
import FishCatchFX from "../FishCatchFX";
import VillageLife, { type NodeSpec } from "./VillageLife";
import BagFullNote from "./BagFullNote";
import { gridFishingWaterHeight } from "@/lib/game/fishingWater";
import { fishingSpot, type FishingSpot, type WaterType } from "@/lib/game/fishingSpots";
import { getPeacefulTarget } from "@/lib/game/peacefulNear";
import type { IslandMap } from "@/lib/game/grid";
import type { WorldMoment } from "@/lib/collections/logic";

export type PeacefulNear = "forage" | "net" | "dig" | "fish" | null;

/** Lowest-priority prompt: a forage node (by hand), a catchable bug (the net's) or a dig (the shovel's) in reach, else water in casting reach (the rod's). */
export function peacefulNear(map: IslandMap, classify: (x: number, z: number) => WaterType, x: number, z: number, spotOut: { current: FishingSpot | null }): PeacefulNear {
  const target = getPeacefulTarget();
  if (target) return target.kind === "bug" ? "net" : target.kind === "dig" ? "dig" : "forage";
  spotOut.current = fishingSpot(map, classify, x, z);
  return spotOut.current ? "fish" : null;
}

export default function PeacefulLayer({ map, nodes, moment, member, player, ground, highTier, active, treeModels }: {
  map: IslandMap; nodes: { forage: NodeSpec[]; bugs: NodeSpec[] }; moment: WorldMoment; member: string;
  player: React.RefObject<THREE.Vector3>; ground: (x: number, z: number) => number; highTier: boolean; active: boolean;
  /** The tree models this season draws (SEASON_TREES): the fruit hangs in the crown the tree shows. */
  treeModels?: readonly string[];
}) {
  const waterHeight = useMemo(() => (x: number, z: number) => gridFishingWaterHeight(map, x, z), [map]);
  const playerRef = player as React.MutableRefObject<THREE.Vector3>;
  return <>
    <VillageLife nodes={nodes.forage} bugNodes={nodes.bugs} moment={moment} member={member} player={player} ground={ground} highTier={highTier} active={active} treeModels={treeModels} />
    {/* The throw runs from you to the spot, not along the camera: it turns now (specs/camera-orbit.md). */}
    <FishingBobber towardWater playerPosRef={playerRef} waterHeight={waterHeight} />
    <FishCatchFX playerPosRef={playerRef} />
    <BagFullNote ground={ground} />
  </>;
}
