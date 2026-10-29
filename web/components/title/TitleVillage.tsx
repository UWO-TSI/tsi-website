"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { ACNHBuilding, ACNHParts, CHALET_VARIANTS } from "@/components/game/ACNHBuilding";
import CafeBuilding from "@/components/game/study/CafeBuilding";
import { DROPS } from "@/lib/game/drops";
import Wharf from "@/components/game/wharf/Wharf";
import { FadeLight, LANTERN_REACH, Lanterns } from "@/components/game/AmbientProps";
import { landmarks, turn, type Landmark, type VillageIsland } from "@/lib/game/defaultIsland";
import { objectsOf, type Village } from "@/lib/game/villageMap";
import { windowLit, type IslandLight } from "@/lib/game/islandLighting";

/**
 * The village's hero pieces for the title backdrop, read-only: the buildings with their windows on the world clock,
 * the wharf, and the street lamps' night glow (the posts themselves ride in with the scenery props). The pieces the
 * game ties to progression (monument stages, boards, boarded doors) stay out; the title shows the village as lived-in.
 */
export default function TitleVillage({ v, island, light, seen }: { v: Village; island: VillageIsland; light: IslandLight; seen: (s: THREE.Sphere) => boolean }) {
  const marks = new Map(landmarks(v).map(l => [l.id, l]));
  const ground = island.ground;
  const at = (l: Landmark): [number, number, number] => [l.x, ground(l.x, l.z), l.z];
  const hq = marks.get("hq"), shop = marks.get("shop"), oracle = marks.get("oracle");
  const cafe = marks.get("cafe"), museum = marks.get("museum"), wharf = marks.get("wharf");
  const lamps = useMemo(() => objectsOf("lamp", v).map((l): [number, number, number] => [l.x, ground(l.x, l.z), l.z]), [v, ground]);
  return <>
    {hq && <>
      {/* The clubhouse model's origin is 2.35 in front of its footprint centre; porch lamps flank the door. */}
      <group position={[hq.x + Math.sin(hq.yaw ?? 0) * -2.35 * (hq.scale ?? 1), ground(hq.x, hq.z), hq.z - Math.cos(hq.yaw ?? 0) * 2.35 * (hq.scale ?? 1)]} rotation={[0, hq.yaw ?? 0, 0]} scale={hq.scale ?? 1}><ACNHBuilding id="hq" windowColor="#ffc95a" windowGlow={light.windowGlow} /></group>
      {[-2, 2].map(x => { const k = hq.scale ?? 1, [px, pz] = turn(x * k, -3.65 * k, hq.yaw); return <FadeLight key={x} position={[hq.x + px, ground(hq.x, hq.z) + 1.25 * k, hq.z + pz]} color="#ffd17a" intensity={light.lampsOn ? light.lamp * 0.85 : 0} distance={4} decay={2} />; })}
    </>}
    {shop && <group position={at(shop)} rotation={[0, shop.yaw ?? 0, 0]} scale={shop.scale ?? 1}><ACNHBuilding id="shop" lit={windowLit(light)} /></group>}
    {oracle && <group position={at(oracle)} rotation={[0, oracle.yaw ?? 0, 0]} scale={oracle.scale ?? 1}><ACNHBuilding id="oracle" lit={windowLit(light)} /></group>}
    {cafe && <group position={at(cafe)} rotation={[0, cafe.yaw ?? 0, 0]} scale={cafe.scale ?? 1}><CafeBuilding state={DROPS.cafe ? "open" : "soon"} light={light} /></group>}
    {museum && <group position={at(museum)} rotation={[0, museum.yaw ?? 0, 0]} scale={museum.scale ?? 1}><ACNHParts parts={CHALET_VARIANTS.red} lit={windowLit(light)} /></group>}
    {wharf && <Wharf dock={{ x: wharf.x, z: wharf.z, yaw: wharf.yaw ?? 0 }} light={light} place="village" />}
    {/* A light only where it can reach the frame (the island's 59 lamps each looped in every fragment: 55 ms frames). */}
    <Lanterns positions={lamps} lit={at => seen(new THREE.Sphere(new THREE.Vector3(...at), LANTERN_REACH))} intensity={light.lampsOn ? light.lamp * 1.5 : 0} glow={light.lampsOn ? 1.2 : 0} />
  </>;
}
