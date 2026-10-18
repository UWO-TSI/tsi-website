import { Color } from "three";
import type { PaletteColors, SeasonalPalette } from "@/lib/content/types";
import type { Season, SeasonBlend } from "./season";
import { SEASONS } from "./season";
import { CEDAR_SNOW_URL, CEDAR_URL, TREE_SHAPES, flowerUrl, treeUrl } from "./natureParts";

/**
 * Seasonal dressing for the member island (decisions 99, 161, 176): tints are
 * blended by season weight; model swaps (blossom, snow trees, bushes, flowers)
 * follow the dominant season, as ACNH swaps them on a date rather than morphing.
 */
export interface SeasonLook {
  /** Ground tint over the grass texture. */
  grass: string;
  /** Oak foliage tint over the greyscale leaf albedo. */
  leaf: string;
  /** Hue/saturation the sky and fog lean toward (lightness kept per phase). */
  sky: string;
  fog: string;
  water: string;
  /** 0..1 snow cover on the ground. */
  snow: number;
  season: Season;
}

/**
 * NatureTree's four slots per dominant season (game/remodel-trees): our broadleaf trees (art/trees/build_broadleaf.py)
 * round, wide and tall in the season's dress (cherry blossom in spring, autumn colour, snow in winter), and our cedar
 * (art/trees/build_conifers.py), snowed on in winter. Each dress is the same silhouette, so a tree keeps its shape
 * through the year.
 */
const broadleaf = (season: Season) => TREE_SHAPES.map(shape => treeUrl(shape, season));
export const SEASON_TREES: Record<Season, readonly string[]> = {
  spring: [...broadleaf("spring"), CEDAR_URL],
  summer: [...broadleaf("summer"), CEDAR_URL],
  autumn: [...broadleaf("autumn"), CEDAR_URL],
  winter: [...broadleaf("winter"), CEDAR_SNOW_URL],
};
/**
 * The dump's leafy bushes, closed all round and in season colours (art/nature/close_bushes.py, game/remodel-r2): the
 * azalea and a fresh-green hydrangea in spring, the hydrangea and hibiscus in their own deep greens in summer, the holly
 * in rust and the hydrangea in amber in autumn, the dump's snow-covered holly (PltBushHolly4Snow) in winter.
 */
const B = "/assets/game/plants/";
export const SEASON_BUSHES: Record<Season, string[]> = {
  spring: [`${B}bush-azalea-spring.glb`, `${B}bush-hydrangea-spring.glb`],
  summer: [`${B}bush-hydrangea-summer.glb`, `${B}bush-hibiscus-summer.glb`],
  autumn: [`${B}bush-holly-autumn.glb`, `${B}bush-hydrangea-autumn.glb`],
  winter: [`${B}bush-holly-winter.glb`],
};
/** Seasonal flower sets, our flowers (art/trees/build_flowers.py). Winter is empty: no blooms standing in the snow. */
export const SEASON_FLOWERS: Record<Season, string[]> = {
  spring: ["tulip", "pansy", "hyacinth", "windflower"].map(flowerUrl),
  summer: ["lily", "rose", "cosmos", "hyacinth"].map(flowerUrl),
  autumn: ["mum", "cosmos", "rose", "windflower"].map(flowerUrl),
  winter: [],
};

function mixHex(parts: { hex: string; weight: number }[]): string {
  const out = new Color(0, 0, 0), c = new Color();
  let total = 0;
  for (const { hex, weight } of parts) {
    if (weight <= 0) continue;
    // Colors mix in linear space (three.js Color stores linear RGB).
    out.add(c.set(hex).multiplyScalar(weight));
    total += weight;
  }
  return `#${out.multiplyScalar(total > 0 ? 1 / total : 1).getHexString()}`;
}

export function paletteBySeason(rows: readonly SeasonalPalette[]): Partial<Record<Season, PaletteColors>> {
  return Object.fromEntries(rows.filter(r => (SEASONS as readonly string[]).includes(r.slug)).map(r => [r.slug, r.palette]));
}

const SUMMER_FALLBACK = { island_grass: "#91B47F", leaf: "#9BC87E", sky: "#BFE9FA", fog: "#CDEBF7", water: "#398D9F" };

export function seasonLook(blend: SeasonBlend, palettes: Partial<Record<Season, PaletteColors>>): SeasonLook {
  const pick = (key: keyof typeof SUMMER_FALLBACK) => mixHex(SEASONS.map(season => ({
    hex: (palettes[season]?.[key] as string | undefined) ?? SUMMER_FALLBACK[key], weight: blend.weights[season],
  })));
  return {
    grass: pick("island_grass"), leaf: pick("leaf"), sky: pick("sky"), fog: pick("fog"), water: pick("water"),
    snow: blend.weights.winter, season: blend.season,
  };
}

/** Lean `base` toward `tint`'s hue/saturation by `amount`, keeping base lightness (night stays night). */
export function leanHue(base: string, tint: string, amount: number): string {
  const b = new Color(base), t = new Color(tint), hb = { h: 0, s: 0, l: 0 }, ht = { h: 0, s: 0, l: 0 };
  b.getHSL(hb); t.getHSL(ht);
  const mixed = new Color().setHSL(ht.h, ht.s, hb.l);
  return `#${b.lerp(mixed, amount).getHexString()}`;
}

/** Nudge a water colour (hex int) toward the season water by `amount`. */
export function leanWater(base: number, tint: string, amount: number): number {
  return new Color(base).lerp(new Color(tint), amount).getHex();
}
