"use client";

import { useMemo } from "react";
import { type IslandMap, WATER_DROP } from "@/lib/game/grid";
import { terrainMaterial } from "./terrainMaterials";

/** Continue the grid's water outside its editable rectangle to the horizon. */
export default function GridOcean({ map }: { map: IslandMap }) {
  const material = useMemo(() => terrainMaterial("mRiver")!, []);
  const minX = map.originX - 0.5, minZ = map.originZ - 0.5;
  const maxX = minX + map.width, maxZ = minZ + map.depth;
  const reach = 300;
  const rectangles = [
    [(minX - reach) / 2, (minZ + maxZ) / 2, minX + reach, map.depth],
    [(maxX + reach) / 2, (minZ + maxZ) / 2, reach - maxX, map.depth],
    [0, (minZ - reach) / 2, reach * 2, minZ + reach],
    [0, (maxZ + reach) / 2, reach * 2, reach - maxZ],
  ];
  return <group>{rectangles.map(([x, z, width, depth], i) => (
    <mesh key={i} position={[x, -WATER_DROP, z]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[width, depth, 20, 20]} />
    </mesh>
  ))}</group>;
}
