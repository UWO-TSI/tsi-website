"use client";

import { ACNHBuilding, ACNHParts, CHALET_VARIANTS } from "@/components/game/ACNHBuilding";
import CafeBuilding from "@/components/game/study/CafeBuilding";
import Wharf from "@/components/game/wharf/Wharf";
import { FadeLight, Lantern } from "@/components/game/AmbientProps";
import { landmarks, type Landmark, type VillageIsland } from "@/lib/game/defaultIsland";
import { objectsOf, type Village } from "@/lib/game/villageMap";
import { windowLit, type IslandLight } from "@/lib/game/islandLighting";

/**
 * The village's hero pieces for the title backdrop, read-only: the buildings with their windows on the world clock,
 * the wharf, and the street lamps' night glow (the posts themselves ride in with the scenery props). The pieces the
 * game ties to progression (monument stages, boards, boarded doors) stay out; the title shows the village as lived-in.
 */
export default function TitleVillage({ v, island, light }: { v: Village; island: VillageIsland; light: IslandLight }) {
  const marks = new Map(landmarks(v).map(l => [l.id, l]));
  const ground = island.ground;
  const at = (l: Landmark): [number, number, number] => [l.x, ground(l.x, l.z), l.z];
  const hq = marks.get("hq"), shop = marks.get("shop"), oracle = marks.get("oracle");
  const cafe = marks.get("cafe"), museum = marks.get("museum"), wharf = marks.get("wharf");
  return <>
    {hq && <>
      {/* The clubhouse model's origin is 2.35 in front of its footprint centre; porch lamps flank the door. */}
      <group position={[hq.x, ground(hq.x, hq.z), hq.z - 2.35]}><ACNHBuilding id="hq" windowColor="#ffc95a" windowGlow={light.windowGlow} /></group>
      {[-2, 2].map(x => <FadeLight key={x} position={[hq.x + x, ground(hq.x, hq.z) + 1.25, hq.z - 3.65]} color="#ffd17a" intensity={light.lampsOn ? light.lamp * 0.85 : 0} distance={4} decay={2} />)}
    </>}
    {shop && <group position={at(shop)}><ACNHBuilding id="shop" lit={windowLit(light)} /></group>}
    {oracle && <group position={at(oracle)}><ACNHBuilding id="oracle" lit={windowLit(light)} /></group>}
    {cafe && <group position={at(cafe)}><CafeBuilding open light={light} /></group>}
    {museum && <group position={at(museum)}><ACNHParts parts={CHALET_VARIANTS.red} lit={windowLit(light)} /></group>}
    {wharf && <Wharf dock={{ x: wharf.x, z: wharf.z, yaw: wharf.yaw ?? 0 }} light={light} place="village" />}
    {objectsOf("lamp", v).map(l => <Lantern key={l.id} position={[l.x, ground(l.x, l.z), l.z]} intensity={light.lampsOn ? light.lamp * 1.5 : 0} glow={light.lampsOn ? 1.2 : 0} />)}
  </>;
}
