"use client";

import { useMemo } from "react";
import { Surface, surfaceAt } from "@/lib/game/grid";
import { landmarks, villageScale, wharfDeck } from "@/lib/game/defaultIsland";
import { WATER_CLASS, villageWater } from "@/lib/game/fishingSpots";
import { village } from "@/lib/game/villageMap";
import type { MiniMapPlot } from "./MiniMap";

const FILL: Partial<Record<number, string>> = {
  [Surface.Grass]: "#7EC167", [Surface.Sand]: "#E4CD96", [Surface.Soil]: "#D9B380",
  [Surface.Brick]: "#C98F73", [Surface.Stone]: "#B9B2A4", [Surface.Wood]: "#B98C60", [Surface.River]: "#69A8D0",
};

/**
 * Minimap plot for the default island, drawn from the same grid the world
 * renders (row runs per surface; the open sea is left as the panel's water)
 * plus the landmark table, framed by the map's bounds. World x is mirrored so
 * the map matches the follow camera (+x on screen left). The camera faces
 * west, so north (−x) is on the right edge (row 239).
 */
export function useDefaultIslandPlot(opened: readonly string[] = []): MiniMapPlot {
  const openedKey = opened.join();
  return useMemo(() => {
    const v = village(), { map } = v, water = villageWater(v).classes;
    const runs: { x: number; z: number; w: number; fill: string }[] = [];
    for (let cz = 0; cz < map.depth; cz++) {
      const z = cz + map.originZ;
      let start = 0, current: string | undefined;
      for (let cx = 0; cx <= map.width; cx++) {
        const fill = cx < map.width && water[cz * map.width + cx] !== WATER_CLASS.sea ? FILL[surfaceAt(map, cx, cz)] : undefined;
        if (fill !== current) {
          // Cell edges (centre ∓ 0.5); the code-built plot drew each cell half a cell off.
          if (current) runs.push({ x: start + map.originX - 0.5, z, w: cx - start, fill: current });
          start = cx; current = fill;
        }
      }
    }
    const { x0, x1, z0, z1 } = villageScale(v).minimap, deck = wharfDeck(v);
    const content = <g transform="scale(-1 1)">
      {runs.map((r, i) => <rect key={i} x={r.x} y={-(r.z + 0.5)} width={r.w} height={1.02} fill={r.fill} />)}
      {deck && <rect x={deck.x0} y={-deck.z1} width={deck.x1 - deck.x0} height={deck.z1 - deck.z0} fill="#B98C60" />}
      {landmarks(v, openedKey.split(",")).filter(l => l.half).map(l => <rect key={l.id} x={l.x - l.half![0]} y={-l.z - l.half![1]} width={l.half![0] * 2} height={l.half![1] * 2} rx={0.5}
        fill={l.color} opacity={l.open ? 1 : 0.55} stroke={l.open ? "rgba(0,0,0,0.3)" : "#3b2f25"} strokeWidth={0.35} strokeDasharray={l.open ? undefined : "0.8 0.6"}>
        <title>{l.open ? l.label : `${l.label} (closed)`}</title></rect>)}
    </g>;
    return { viewBox: `${-x1} ${-z1} ${x1 - x0} ${z1 - z0}`, content, north: [-x0 - 2.5, (-z1 - z0) / 2 + 1.5], mirrorX: true,
      label: "Village map. The yellow marker shows your position; north is to the right. Dashed buildings are closed." };
  }, [openedKey]);
}
