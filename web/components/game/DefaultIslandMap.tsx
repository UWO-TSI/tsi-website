"use client";

import { useMemo } from "react";
import { Surface } from "@/lib/game/grid";
import { LANDMARKS, ISLAND_RADII, WHARF_DECK, createDefaultIsland } from "@/lib/game/defaultIsland";
import type { MiniMapPlot } from "./MiniMap";

const FILL: Partial<Record<number, string>> = {
  [Surface.Grass]: "#7EC167", [Surface.Sand]: "#E4CD96", [Surface.Soil]: "#D9B380",
  [Surface.Brick]: "#C98F73", [Surface.Stone]: "#B9B2A4", [Surface.Wood]: "#B98C60", [Surface.River]: "#69A8D0",
};

/**
 * Minimap plot for the default island, drawn from the same grid the world
 * renders (row runs per surface) plus the landmark table. World x is mirrored
 * so the map matches the follow camera (+x on screen left).
 */
export function useDefaultIslandPlot(): MiniMapPlot {
  return useMemo(() => {
    const { map, surface } = createDefaultIsland();
    const runs: { x: number; z: number; w: number; fill: string }[] = [];
    for (let cz = 0; cz < map.depth; cz++) {
      const z = cz + map.originZ;
      let start = 0, current: string | undefined;
      for (let cx = 0; cx <= map.width; cx++) {
        const x = cx + map.originX;
        const inIsland = Math.hypot((x + 0.5) / ISLAND_RADII.x, (z + 0.5) / ISLAND_RADII.z) < 1;
        const fill = cx < map.width && inIsland ? FILL[surface(x + 0.5, z + 0.5)] : undefined;
        if (fill !== current) {
          if (current) runs.push({ x: start + map.originX, z, w: cx - start, fill: current });
          start = cx; current = fill;
        }
      }
    }
    const pad = 2, hx = ISLAND_RADII.x + pad, hz = ISLAND_RADII.z + pad + 3;
    const content = <g transform="scale(-1 1)">
      {runs.map((r, i) => <rect key={i} x={r.x} y={-(r.z + 1)} width={r.w} height={1.02} fill={r.fill} />)}
      <rect x={WHARF_DECK.x0} y={-WHARF_DECK.z1} width={WHARF_DECK.x1 - WHARF_DECK.x0} height={WHARF_DECK.z1 - WHARF_DECK.z0} fill="#B98C60" />
      {LANDMARKS.filter(l => l.half).map(l => <rect key={l.id} x={l.x - l.half![0]} y={-l.z - l.half![1]} width={l.half![0] * 2} height={l.half![1] * 2} rx={0.5}
        fill={l.color} opacity={l.open ? 1 : 0.55} stroke={l.open ? "rgba(0,0,0,0.3)" : "#3b2f25"} strokeWidth={0.35} strokeDasharray={l.open ? undefined : "0.8 0.6"}>
        <title>{l.open ? l.label : `${l.label} (closed)`}</title></rect>)}
    </g>;
    return { viewBox: `${-hx} ${-hz + 3} ${hx * 2} ${hz * 2 - 3}`, content, north: [hx - 2.5, -hz + 7], mirrorX: true,
      label: "Village map. The yellow marker shows your position; north is up. Dashed buildings are closed." };
  }, []);
}
