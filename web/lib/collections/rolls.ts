/**
 * Server-rolled catches (roadmap "Server-authoritative catch rolls"). The
 * client only asks for a roll at a place; these check the place against the
 * island layouts and roll with the world's own tables and rules
 * (lib/game/peaceful.ts, fishing.ts) on the server's clock and real weather.
 * Pure; the collections service records the result.
 */
import type { NodeSpec } from "@/components/game/peaceful/VillageLife";
import { CAST, rollSize, type FishDef } from "@/lib/game/fishing";
import { fishingSpot, villageWater, type WaterType } from "@/lib/game/fishingSpots";
import { inBounds, worldToCellX, worldToCellZ } from "@/lib/game/grid";
import { createHomeIsland } from "@/lib/game/homeIsland";
import { homeNodes, villageNodes } from "@/lib/game/islandNodes";
import { rosterWeather, type IslandWeather } from "@/lib/game/islandWeather";
import { hourKey, rollFishFor, rollNode } from "@/lib/game/peaceful";
import type { RodTier } from "@/lib/game/rods";
import { village } from "@/lib/game/villageMap";
import type { Weather } from "@/lib/game/weather";
import { torontoParts } from "@/lib/time";
import type { WorldMoment } from "./logic";
import type { Species } from "./roster";

export type Site = "village" | "home";

/** A cast needs this long since the member's previous one; a reel at least MIN_REEL_MS; an unlanded roll lapses after ROLL_TTL_MS (mirrored in 20260929100000_catch_rolls.sql). */
export const CAST_GAP_MS = 4000;
export const MIN_REEL_MS = 3000;
export const ROLL_TTL_MS = 180_000;
/** Forage prompts show within 1.7 of a node and bugs flutter about half a unit: this allows for both. */
export const NODE_REACH = 3;

let sites: Record<Site, { map: ReturnType<typeof createHomeIsland>["map"]; classify: (x: number, z: number) => WaterType }> | null = null;
let nodes: Map<string, NodeSpec & { bug: boolean }> | null = null;
const layouts = () => (sites ??= { village: { map: village().map, classify: villageWater().classify }, home: { map: createHomeIsland().map, classify: () => "sea" } });
const allNodes = () => {
  if (nodes) return nodes;
  const v = villageNodes(), h = homeNodes();
  nodes = new Map([...v.forage, ...h.forage].map(n => [n.id, { ...n, bug: false }]));
  for (const n of [...v.bugs, ...h.bugs]) nodes.set(n.id, { ...n, bug: true });
  return nodes;
};

/** The node with this id on either island, when `at` is within reach of it. */
export function nodeAt(id: string, [x, z]: [number, number]): (NodeSpec & { bug: boolean }) | null {
  const n = allNodes().get(id);
  return n && Math.hypot(n.x - x, n.z - z) <= NODE_REACH ? n : null;
}

/** The world moment VillageLife rolls against (usePeacefulContext): Toronto hour, month, roster weather. */
export function momentAt(now: Date, weather: IslandWeather): WorldMoment {
  const { hour, month } = torontoParts(now);
  return { hour: hour + 0.5, month, weather: rosterWeather(weather) };
}

/** What the node holds for this member this hour, as the world shows it; null when nothing is out. */
export function nodeRoll(member: string, node: NodeSpec & { bug?: boolean }, now: Date, weather: IslandWeather): Species | null {
  const sp = node.drop ?? rollNode(member, node.id, hourKey(now), node.biomes, momentAt(now, weather), node.categories);
  // A bug spot only shows a bug that has a model (VillageLife): nothing to catch otherwise.
  return sp && (!node.bug || sp.assetReady) ? sp : null;
}

/** Forage sizes are uniform in the species range, to 0.1 cm (as VillageLife rolled them). */
export function forageSize(sp: Species, random = Math.random): number | null {
  return sp.size ? Math.round((sp.size[0] + (sp.size[1] - sp.size[0]) * random()) * 10) / 10 : null;
}

/** The water a player standing at `at` casts into, or null when no water is in reach (PeacefulLayer's fishing prompt). */
export function castWater(site: Site, [x, z]: [number, number]): WaterType | null {
  const { map, classify } = layouts()[site];
  if (!inBounds(map, worldToCellX(map, x), worldToCellZ(map, z))) return null;
  return fishingSpot(map, classify, x, z)?.water ?? null;
}

/** Reel weather words from the island's weather states. */
const REEL_WEATHER: Record<IslandWeather, Weather> = { clear: "sunny", rain: "rain", snow: "cloudy", fog: "cloudy", wind: "cloudy" };

/** The fish that bites: the reel's pool (FishingOverlay) for the water, rod and cast power, at the Toronto hour and real weather. */
export function fishRoll(water: WaterType, power: number, rod: RodTier, now: Date, weather: IslandWeather, random = Math.random): { fish: FishDef; size: number } {
  const { hour, minute } = torontoParts(now);
  const luck = power + (power >= CAST.maxZone ? CAST.maxBonus : 0);
  const fish = rollFishFor(water, luck, rod, { hour: hour + minute / 60, weather: REEL_WEATHER[weather] }, random);
  return { fish, size: rollSize(fish.sizeCm, random) };
}
