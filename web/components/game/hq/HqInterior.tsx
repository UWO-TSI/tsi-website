"use client";

/**
 * HQ, the member clubhouse (specs/interiors/hq.md, ledger row 316): layout A, the back mezzanine, furnished after
 * David's references. Two storeys: work downstairs (Wren's desk and the register by the door, the green marble coffee
 * bar, the long walnut co-working desk, the library wall, the notice board and the club goals, the Founder's desk, the
 * trophy case, the clock and the workbench), the lamp-lit lounge before the two-storey aquarium; lounging upstairs (the
 * big lounge under the walnut oval ceiling, the banners on the rail, the two locked admin doors).
 *
 * Every number is lib/game/hqLayout.ts's: the room's walker (createHqWalker) carries you up and down the stair, says
 * when the mezzanine shows, and the stations answer on their own floor only. The light (specs: "from lamps, strips and
 * track spots, not ceiling panels"): the day through the windows (InteriorDaylight), the lamps' pools faked
 * (LampPools), and four real lights: the hall, the work floor under the mezzanine, the upper lounge, and the aquarium's
 * blue on the lounge before it. The lamps are always on and carry the room at night.
 */
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { ISLAND_LIGHTING, type IslandLight } from "@/lib/game/islandLighting";
import { interiorLight } from "@/lib/game/interiorLight";
import { HQ, HQ_BENCH, HQ_CLOCK_AT, HQ_FLOOR_HEIGHT as F, HQ_ROOM, HQ_SPAWN, HQ_TROPHY, createHqWalker, type Station } from "@/lib/game/hqLayout";
import InteriorDaylight from "../InteriorDaylight";
import { InteriorPlayer, applyInteriorBackdrop, nearestStation, type InteriorStation, type RoomBounds } from "../interiorShared";
import Keeper from "../Keeper";
import TickingClock from "../TickingClock";
import TrophyCase from "../TrophyCase";
import { Workbench } from "../crafting/Workshop";
import HqRoom, { preloadHqRoom } from "./HqRoom";

const BOUNDS: RoomBounds = { halfW: HQ_ROOM.halfW, halfD: HQ_ROOM.halfD, spawn: HQ_SPAWN };
const toStation = ({ id, name, pos, action, range }: Station): InteriorStation => ({ id, name, pos, action, range });
/** Each floor's stations: nothing to use from the stair, and the admin doors only from upstairs. */
const GROUND = HQ.stations.filter(s => s.level === 0).map(toStation);
const UPPER = HQ.stations.filter(s => s.level === 1).map(toStation);
const NONE: InteriorStation[] = [];

preloadHqRoom();

/** Module scope (the react compiler forbids writing through hook values): the station in reach, reported when it changes. */
function report(last: { current: InteriorStation | null | undefined }, s: InteriorStation | null, to: (s: InteriorStation | null) => void) {
  if (s !== last.current) { last.current = s; to(s); }
}
/** You arrive a step inside the door, clear of its prompt (it shows when you walk back to it). */
function arrive(player: React.MutableRefObject<THREE.Vector3>) { player.current.set(HQ_SPAWN[0], 0, HQ_SPAWN[1]); }

export default function HqInterior({ light = ISLAND_LIGHTING.day, frozen, talking = false, member, player, onNearestStation }: {
  /** The island's light now: the windows and the lamps follow the time of day. */
  light?: IslandLight;
  frozen: boolean;
  /** Wren's sheet or the visit's card is up: she faces you and talks you through it. */
  talking?: boolean;
  /** The signed-in member (their trophies say "Yours"). */
  member: string | null;
  player: React.MutableRefObject<THREE.Vector3>;
  onNearestStation: (s: InteriorStation | null) => void;
}) {
  const { scene } = useThree();
  useEffect(() => applyInteriorBackdrop(scene, null), [scene]);   // the branded dark behind the canvas (InteriorBackdrop)
  useEffect(() => { arrive(player); onNearestStation(null); }, [player, onNearestStation]);
  // One walker a visit: you come in on the ground floor.
  const [walker] = useState(() => createHqWalker(HQ));
  const last = useRef<InteriorStation | null | undefined>(undefined);
  const onMove = useCallback((x: number, z: number) => {
    const list = walker.zone === "ground" ? GROUND : walker.zone === "upper" ? UPPER : NONE;
    report(last, nearestStation(list, x, z), onNearestStation);
  }, [walker, onNearestStation]);
  const height = useCallback(() => walker.height, [walker]);
  const { lamps, day } = interiorLight(light);
  const a = HQ.aquarium;

  return (
    <group>
      {/* The fill falls away at night, so the lamps, the strips and the tank carry the room (ref 2's lamp-lit lounge). */}
      <InteriorDaylight light={light} shadows scale={{ key: 1.0, ambient: 0.14 + 0.18 * day, hemisphere: 0.1 + 0.18 * day, extent: 12 }} />
      {/* The hall and the work floor: warm, from the track spots and the lamps (their pools are LampPools). */}
      <pointLight color="#ffd6a2" intensity={20 * lamps} distance={14} position={[-1.5, 4.2, -3.4]} />
      <pointLight color="#ffd09a" intensity={13 * lamps} distance={11} position={[0, 1.8, 5.2]} />
      {/* The upper lounge, under the arc lamp's globe. */}
      <pointLight color="#ffcb92" intensity={12 * lamps} distance={9} position={[1.7, F + 2.0, 4.9]} />
      {/* The aquarium's blue on the lounge before it: always on, the tank lights itself. */}
      <pointLight color="#62c9f2" intensity={14} distance={8} position={[a.x0 - 0.9, 2.4, (a.z0 + a.z1) / 2]} />

      <Suspense fallback={null}><HqRoom walker={walker} light={light} /></Suspense>
      {/* This week's biggest catches in 3D (the display's E opens the list), the workbench, the clock on the island's time. */}
      <Suspense fallback={null}><TrophyCase member={member} at={[HQ_TROPHY.x, HQ_TROPHY.z]} yaw={HQ_TROPHY.yaw} /></Suspense>
      <Workbench player={player} at={[HQ_BENCH.x, HQ_BENCH.z]} pile={false} />
      <Suspense fallback={null}><TickingClock glassMaterial="FtrAntiqueClock_mat0" position={[HQ_CLOCK_AT.x, 0, HQ_CLOCK_AT.z]} rotY={Math.PI} player={player} /></Suspense>

      {/* Wren behind her desk by the door (lib/game/keepers.ts memberHq). */}
      <Keeper room="memberHq" player={player} frozen={frozen} engaged={talking} />
      <InteriorPlayer frozen={frozen} bounds={BOUNDS} playerPosRef={player} onMove={onMove} constrainMove={walker.constrain} heightAt={height} />
    </group>
  );
}
