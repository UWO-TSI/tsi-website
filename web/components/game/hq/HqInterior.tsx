"use client";

/**
 * HQ, the member clubhouse (specs/interiors/hq.md, ledger row 316): layout B, the gallery, furnished after David's
 * references, two tall storeys (24 x 18 since phase 4). The aquarium fills the back wall straight ahead of the door, the
 * full height of the room; the upper floor wraps the hall in a U. Downstairs: Alice's desk and the register, the green
 * marble coffee bar, the work lounge and the window nook in the entry under the bridge; the big lounge before the tank
 * (the sectional, beanbags, the big rug); the library, co-working, the trophy case, the clock and the Founder's desk
 * under the left arm; the notice board, the club goals, the stair and the one locked admin door under it, under the
 * right; the workbench by the door. Upstairs: the big lounge on the bridge under the walnut oval ceiling, facing the
 * tank; the study on the left arm; reading nooks; the yearly banners off the arms.
 *
 * Every number is lib/game/hqLayout.ts's: the room's walker (createHqWalker) carries you up and down the stair, says
 * which parts of the upper floor show, and the stations answer on their own floor only. The light (specs: "from lamps,
 * strips and track spots, not ceiling panels"): the day through the windows (InteriorDaylight), the lamps' pools faked
 * (LampPools), and six real lights: the entry and the hall, the work floor under the left arm, the right arm's floor, the
 * bridge's lounge, the study, and the aquarium's blue on the lounge before it. The lamps are always on and carry the room
 * at night.
 */
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { ISLAND_LIGHTING, type IslandLight } from "@/lib/game/islandLighting";
import { interiorLight } from "@/lib/game/interiorLight";
import { HQ, HQ_CLOCK_AT, HQ_FLOOR_HEIGHT as F, HQ_ROOM, HQ_SPAWN, HQ_TROPHY, createHqWalker, type Station } from "@/lib/game/hqLayout";
import InteriorDaylight from "../InteriorDaylight";
import { InteriorPlayer, applyInteriorBackdrop, nearestStation, reportIfChanged, type InteriorStation, type RoomBounds } from "../interiorShared";
import Keeper from "../Keeper";
import TickingClock from "../TickingClock";
import TrophyCase from "../TrophyCase";
import { Workbench } from "../crafting/Workshop";
import HqRoom, { preloadHqRoom } from "./HqRoom";
import { afterEntry } from "@/lib/game/sceneGate";

const BOUNDS: RoomBounds = { halfW: HQ_ROOM.halfW, halfD: HQ_ROOM.halfD, spawn: HQ_SPAWN };
const toStation = ({ id, name, pos, action, range }: Station): InteriorStation => ({ id, name, pos, action, range });
/** Each floor's stations: nothing to use from the stair (the admin door is a ground-floor station). */
const GROUND = HQ.stations.filter(s => s.level === 0).map(toStation);
const UPPER = HQ.stations.filter(s => s.level === 1).map(toStation);
const NONE: InteriorStation[] = [];

afterEntry(preloadHqRoom);

/** You arrive a step inside the door, clear of its prompt (it shows when you walk back to it). */
function arrive(player: React.MutableRefObject<THREE.Vector3>) { player.current.set(HQ_SPAWN[0], 0, HQ_SPAWN[1]); }

export default function HqInterior({ light = ISLAND_LIGHTING.day, frozen, talking = false, member, player, onNearestStation }: {
  /** The island's light now: the windows and the lamps follow the time of day. */
  light?: IslandLight;
  frozen: boolean;
  /** Alice's sheet or the visit's card is up: she faces you and talks you through it. */
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
    reportIfChanged(last, nearestStation(list, x, z), onNearestStation);
  }, [walker, onNearestStation]);
  const height = useCallback(() => walker.height, [walker]);
  const { lamps, day } = interiorLight(light);
  const a = HQ.aquarium;

  return (
    <group>
      {/* The fill falls away at night, so the lamps, the strips and the tank carry the room (ref 2's lamp-lit lounge);
          a warm floor stays so no corner goes black (David, 2026-10-22: "so no dark corners at night"). */}
      <InteriorDaylight light={light} shadows scale={{ key: 1.0, ambient: 0.22 + 0.12 * day, hemisphere: 0.14 + 0.16 * day, extent: 14 }} />
      {/* The entry and the hall, the work floor under the left arm, the right arm's floor by the stair: warm, from the
          track spots and the lamps (their pools are LampPools). */}
      <pointLight color="#ffd6a2" intensity={30 * lamps} distance={19} position={[0, 3.8, -2.8]} />
      <pointLight color="#ffd09a" intensity={15 * lamps} distance={12} position={[9.2, 3.0, 2.0]} />
      <pointLight color="#ffd09a" intensity={12 * lamps} distance={11} position={[-8.6, 3.0, 2.6]} />
      {/* Upstairs: the bridge's lounge under the arc lamp's globe, the study down the left arm. */}
      <pointLight color="#ffcb92" intensity={17 * lamps} distance={14} position={[-1.0, F + 2.4, -6.6]} />
      <pointLight color="#ffd4a0" intensity={12 * lamps} distance={11} position={[9.3, F + 2.6, 3.0]} />
      {/* The aquarium's blue on the lounge before it: always on, the tank lights itself. */}
      <pointLight color="#62c9f2" intensity={22} distance={11} position={[(a.x0 + a.x1) / 2, 2.6, a.z0 - 1.9]} />

      <Suspense fallback={null}><HqRoom walker={walker} light={light} /></Suspense>
      {/* This week's biggest catches in 3D (the display's E opens the list), the workbench, the clock on the island's time. */}
      <Suspense fallback={null}><TrophyCase member={member} at={[HQ_TROPHY.x, HQ_TROPHY.z]} yaw={HQ_TROPHY.yaw} /></Suspense>
      <Workbench player={player} />
      <Suspense fallback={null}><TickingClock glassMaterial="FtrAntiqueClock_mat0" position={[HQ_CLOCK_AT.x, 0, HQ_CLOCK_AT.z]} rotY={HQ_CLOCK_AT.yaw} player={player} /></Suspense>

      {/* Alice behind her desk left of the door (lib/game/keepers.ts memberHq). */}
      <Keeper room="memberHq" player={player} frozen={frozen} engaged={talking} />
      <InteriorPlayer frozen={frozen} bounds={BOUNDS} playerPosRef={player} onMove={onMove} constrainMove={walker.constrain} heightAt={height} />
    </group>
  );
}
