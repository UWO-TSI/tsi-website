"use client";

/**
 * ShopInterior: the shop (specs/interiors/shop.md, row 313), reworked from David's references. Phase 1 is the layout
 * only, as a greybox for his approval (ShopGreybox, every number in lib/game/shopLayout.ts). Two floors: the in-game
 * items and the tiled counter downstairs, the shopkeeper behind it at the end of the aisle from the door; the club merch
 * upstairs, by the stair up the right wall. The room's walker (createShopWalker) carries you up and down the stair and
 * says which floor shows. The counter's station opens the counter (ShopCounter: buy and sell with the shopkeeper). The
 * village's shop door comes here (DefaultIslandWorld).
 */

import { useCallback, useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { ISLAND_LIGHTING, type IslandLight } from "@/lib/game/islandLighting";
import { interiorLight } from "@/lib/game/interiorLight";
import {
  SHOP_COUNTER_RANGE, SHOP_COUNTER_SPOT, SHOP_EXIT, SHOP_EXIT_RANGE, SHOP_FLOOR_HEIGHT, SHOP_PENDANT, SHOP_ROOM, SHOP_SPAWN, createShopWalker,
} from "@/lib/game/shopLayout";
import InteriorDaylight from "./InteriorDaylight";
import {
  InteriorPlayer, applyInteriorBackdrop, useNearestStation,
  type InteriorStation, type RoomBounds,
} from "./interiorShared";
import Keeper from "./Keeper";
import ShopGreybox from "./ShopGreybox";

const BOUNDS: RoomBounds = { halfW: SHOP_ROOM.halfW, halfD: SHOP_ROOM.halfD, spawn: SHOP_SPAWN };

export const SHOP_STATIONS: InteriorStation[] = [
  { id: "counter", name: "Counter", pos: SHOP_COUNTER_SPOT, action: "counter", range: SHOP_COUNTER_RANGE },
  { id: "exit", name: "Exit", pos: SHOP_EXIT, action: "exit", range: SHOP_EXIT_RANGE },
];

export default function ShopInterior({
  frozen,
  playerPosRef,
  onNearestStation,
  light = ISLAND_LIGHTING.day,
  talking = false,
}: {
  /** The island's light now: the window follows the time of day. */
  light?: IslandLight;
  /** The counter is open (ShopCounter): the shopkeeper serves you from behind it. */
  talking?: boolean;
  frozen: boolean;
  playerPosRef: React.MutableRefObject<import("three").Vector3>;
  onNearestStation: (s: InteriorStation | null) => void;
}) {
  const { scene } = useThree();
  useEffect(() => applyInteriorBackdrop(scene), [scene]);
  const lamps = interiorLight(light).lamps;
  // One walker a visit: you come in on the ground floor.
  const [walker] = useState(createShopWalker);
  const near = useNearestStation(SHOP_STATIONS, onNearestStation);
  // The counter and the door are downstairs: nothing to use from the stair or the floor above them.
  const onMove = useCallback((x: number, z: number) => near(walker.zone === "ground" ? x : 1e6, z), [near, walker]);
  const height = useCallback(() => walker.height, [walker]);

  return (
    <group>
      {/* Bright and even for reading the layout: the day, a warm-neutral fill, and the pendant's pool over the counter. */}
      <InteriorDaylight light={light} shadows scale={{ key: 1.1, ambient: 0.5, hemisphere: 0.45, extent: 8 }} />
      <ambientLight color="#fff6ea" intensity={0.35} />
      {[2.6, SHOP_FLOOR_HEIGHT + 2.6].map(y => <pointLight key={y} color="#fff1dc" intensity={22 * lamps} distance={18} position={[0, y, 0]} />)}
      <pointLight color="#ffe9c8" intensity={5} distance={4} position={[(SHOP_PENDANT.x0 + SHOP_PENDANT.x1) / 2, SHOP_PENDANT.y - 0.15, SHOP_PENDANT.z]} />

      <ShopGreybox walker={walker} />

      {/* The shopkeeper behind the counter (lib/game/keepers.ts): serves you at the counter and has a word about each sale. */}
      <Keeper room="shop" player={playerPosRef} frozen={frozen} engaged={talking} sayEvent="tsi:shopkeeper-say" />
      <InteriorPlayer
        frozen={frozen}
        bounds={BOUNDS}
        playerPosRef={playerPosRef}
        onMove={onMove}
        constrainMove={walker.constrain}
        heightAt={height}
      />
    </group>
  );
}
