import { Color } from "three";
import type { PaletteColors, SeasonalPalette } from "@/lib/content/types";
import type { Season, SeasonBlend } from "./season";
import { SEASONS } from "./season";

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

const P = "/assets/acnh/plants/";
/**
 * NatureTree's four slots (oak a, oak b, blossom, cedar) per dominant season.
 * Spring oaks bloom (cherry blossom); summer/autumn oaks are leafy (autumn via
 * the leaf tint); winter uses the dump's snow oak/cedar variants.
 */
export const SEASON_TREES: Record<Season, readonly string[]> = {
  spring: [`${P}tree-blossom.glb`, `${P}tree-blossom.glb`, `${P}tree-blossom.glb`, `${P}tree-cedar.glb`],
  summer: [`${P}tree-hardwood-a.glb`, `${P}tree-hardwood-b.glb`, `${P}tree-hardwood-a.glb`, `${P}tree-cedar.glb`],
  autumn: [`${P}tree-hardwood-a.glb`, `${P}tree-hardwood-b.glb`, `${P}tree-hardwood-b.glb`, `${P}tree-cedar.glb`],
  winter: [`${P}tree-hardwood-snow.glb`, `${P}tree-hardwood-snow.glb`, `${P}tree-hardwood-snow.glb`, `${P}tree-cedar-snow.glb`],
};
/** ACNH bushes flower by season: azalea spring, hydrangea/hibiscus summer, holly winter. */
export const SEASON_BUSHES: Record<Season, string[]> = {
  spring: [`${P}bush-azalea.glb`],
  summer: [`${P}bush-hydrangea.glb`, `${P}bush-hibiscus.glb`],
  autumn: [`${P}bush-holly.glb`, `${P}bush-hydrangea.glb`],
  // The dump's own snow-covered holly (PltBushHolly4Snow), ACNH's winter bush.
  winter: [`${P}bush-holly-snow.glb`],
};
/** Seasonal flower sets. Winter is empty: no blooms standing in the snow. */
export const SEASON_FLOWERS: Record<Season, string[]> = {
  spring: ["tulip", "pansy", "hyacinth", "windflower"].map(f => `${P}flower-${f}.glb`),
  summer: ["lily", "rose", "cosmos", "hyacinth"].map(f => `${P}flower-${f}.glb`),
  autumn: ["mum", "cosmos", "rose", "windflower"].map(f => `${P}flower-${f}.glb`),
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
