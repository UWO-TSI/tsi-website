"use client";

/**
 * HQ's new room, phase 1 (specs/interiors/hq.md, row 316): an option's layout as a walkable greybox for David's pick,
 * shown only where asked for (`?hq=inside&hqLayout=a|b` in development); the live HQ (HQInterior) is untouched until
 * he approves one. The walker (createHqWalker) carries you up and down the stair and cuts away the part of the upper
 * floor you're under. The stations HQ already has (the desk, the board, the Founder's desk, the trophy case, the
 * library, the clock, the door) sit at the option's spots and open what they open now, so the onboarding walks it too.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { ISLAND_LIGHTING, type IslandLight } from "@/lib/game/islandLighting";
import { HQ_FLOOR_HEIGHT, HQ_OPTIONS, HQ_ROOM, HQ_SPAWN, createHqWalker, type Option } from "@/lib/game/hqLayout";
import InteriorDaylight from "../InteriorDaylight";
import { InteriorPlayer, applyInteriorBackdrop, useNearestStation, type InteriorStation, type RoomBounds } from "../interiorShared";
import HqGreybox from "./HqGreybox";

const BOUNDS: RoomBounds = { halfW: HQ_ROOM.halfW, halfD: HQ_ROOM.halfD, spawn: HQ_SPAWN };
/** The stations the island world already answers (its prompts and sheets); the new ones come with phase 2. */
const KNOWN = new Set(["exit", "desk", "board", "founder", "display", "shelf", "clock"]);

export default function HqLayoutInterior({ option, frozen, playerPosRef, onNearestStation, light = ISLAND_LIGHTING.day }: {
  option: Option;
  light?: IslandLight;
  frozen: boolean;
  playerPosRef: React.MutableRefObject<import("three").Vector3>;
  onNearestStation: (s: InteriorStation | null) => void;
}) {
  const o = HQ_OPTIONS[option];
  const { scene } = useThree();
  useEffect(() => applyInteriorBackdrop(scene, null), [scene]);
  const [walker] = useState(() => createHqWalker(o));
  const stations = useMemo(() => o.stations.filter(s => KNOWN.has(s.id)), [o]);
  const levels = useMemo(() => new Map(o.stations.map(s => [s.id, s.level])), [o]);
  const ground = useMemo(() => stations.filter(s => levels.get(s.id) === 0).map(s => ({ id: s.id, name: s.name, pos: s.pos, action: s.action, range: s.range })), [stations, levels]);
  const near = useNearestStation(ground, onNearestStation);
  // Everything HQ already does is downstairs: nothing to use from the stair or the upper floor yet.
  const onMove = useCallback((x: number, z: number) => near(walker.zone === "ground" ? x : 1e6, z), [near, walker]);
  const height = useCallback(() => walker.height, [walker]);
  return <group>
    {/* Bright and even for reading the layout: the day, a warm fill on each floor. */}
    <InteriorDaylight light={light} shadows scale={{ key: 1.1, ambient: 0.45, hemisphere: 0.35, extent: 12 }} />
    <ambientLight color="#fff6ea" intensity={0.25} />
    {[2.8, HQ_FLOOR_HEIGHT + 2.6].map(y => <pointLight key={y} color="#fff1dc" intensity={30} distance={24} position={[0, y, 0]} />)}
    <HqGreybox o={o} walker={walker} />
    <InteriorPlayer frozen={frozen} bounds={BOUNDS} playerPosRef={playerPosRef} onMove={onMove} constrainMove={walker.constrain} heightAt={height} />
  </group>;
}
