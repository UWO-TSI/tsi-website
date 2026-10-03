"use client";

/**
 * ShopInterior (2026-07-14) — ux-interiors.md §5, HQ-room pattern. A cozy
 * 10x10 general store in its modelled shell (RoomShell: mint walls over a
 * beadboard wainscot, plank floor, a window each side, a striped awning over
 * the counter, the framed doorway): counter-register station opens the Shop
 * sheet, color-box display shelves flank the walls, barrels + cardboard piles
 * + a stray shopping cart fill the corners.
 */

import { Suspense, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { ISLAND_LIGHTING, type IslandLight } from "@/lib/game/islandLighting";
import { interiorLight } from "@/lib/game/interiorLight";
import InteriorDaylight from "./InteriorDaylight";
import {
  InteriorPlayer, Piece, applyInteriorBackdrop, preloadPieces, useNearestStation,
  type InteriorStation, type RoomBounds,
} from "./interiorShared";
import Keeper from "./Keeper";
import { RoomShell, preloadShells } from "./RoomShell";

const BOUNDS: RoomBounds = { halfW: 5, halfD: 5, spawn: [0, -3.2] };

export const SHOP_STATIONS: InteriorStation[] = [
  { id: "counter", name: "Counter", pos: [0, 2.6], action: "sheet:shop", range: 2.4 },
  { id: "exit", name: "Exit", pos: [0, -4.4], action: "exit", range: 1.1 },
];

preloadPieces(["counter-register", "color-box-shelf", "barrel", "cardboard-pile", "shopping-cart", "yellow-message-mat"]);
preloadShells(["shop"]);

export default function ShopInterior({
  frozen,
  playerPosRef,
  onNearestStation,
  light = ISLAND_LIGHTING.day,
}: {
  /** The island's light now: the windows follow the time of day. */
  light?: IslandLight;
  frozen: boolean;
  playerPosRef: React.MutableRefObject<import("three").Vector3>;
  onNearestStation: (s: InteriorStation | null) => void;
}) {
  const { scene } = useThree();
  useEffect(() => applyInteriorBackdrop(scene), [scene]);
  const lamps = interiorLight(light).lamps;
  const onMove = useNearestStation(SHOP_STATIONS, onNearestStation);

  return (
    <group>
      {/* The day through the two windows; the shop's warm amber lamps come up as it goes (a brighter retail read). */}
      <InteriorDaylight light={light} scale={{ key: 1.2, ambient: 0.36, hemisphere: 0.3, extent: 8 }} />
      <pointLight color="#FFC985" intensity={28 * lamps} distance={17} position={[0, 3.2, 0]} />
      <pointLight color="#FFDB98" intensity={9 * lamps} distance={5} position={[0, 2.2, 2.6]} />

      {/* walls, windows, the awning and the floor (art/interiors/build_interiors.py) */}
      <Suspense fallback={null}><RoomShell room="shop" light={light} /></Suspense>

      <Suspense fallback={null}>
        {/* Counter + register (→ Shop sheet) */}
        <Piece name="counter-register" position={[0, 0, 3.4]} rotY={Math.PI} scale={0.115} />
        {/* Display shelves */}
        <Piece name="color-box-shelf" position={[-4.1, 0, 2.2]} rotY={Math.PI / 2} scale={0.13} />
        <Piece name="color-box-shelf" position={[4.1, 0, 2.2]} rotY={-Math.PI / 2} scale={0.13} />
        <Piece name="color-box-shelf" position={[-4.1, 0, -0.6]} rotY={Math.PI / 2} scale={0.13} />
        {/* Corner clutter */}
        <Piece name="barrel" position={[4.2, 0, -3.9]} scale={0.09} />
        <Piece name="barrel" position={[3.3, 0, -4.3]} scale={0.085} />
        <Piece name="cardboard-pile" position={[-4.0, 0, -4.0]} rotY={0.5} />
        <Piece name="shopping-cart" position={[3.9, 0, 0.9]} rotY={-0.9} scale={0.09} />
        {/* Exit mat */}
        <Piece name="yellow-message-mat" position={[0, 0.015, -4.3]} scale={0.12} />
      </Suspense>

      {/* The shopkeeper behind the counter (lib/game/keepers.ts). */}
      <Keeper room="shop" player={playerPosRef} frozen={frozen} />
      <InteriorPlayer
        frozen={frozen}
        bounds={BOUNDS}
        playerPosRef={playerPosRef}
        onMove={onMove}
      />
    </group>
  );
}
