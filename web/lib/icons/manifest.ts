/**
 * Every item's icon (row 281, specs/game-ui.md §4): what it is rendered from and how, for the one renderer
 * (/lab/icons, scripts/render-icons.mjs: three.js offscreen, matte, one light rig, a fixed angle per kind, transparent)
 * that writes public/assets/icons/<key>.webp. Fish stand head up (David's ruling, 2026-07-24), as the book always showed them. The species, the tools, the weapons, the glider, and every shop item:
 * clothes and accessories (their character parts), dyes (the dye bottle in the dye's colour), furniture (the homes
 * pieces), wallpaper and flooring (their textures on a roll and a tile), the merch, the bobber and the recipe cards.
 * Our own models where an item had none (art/props-enemies/build_items.py, build_tools.py). `iconFor` maps an item to
 * its icon for sprite_url and the roster.
 */
import { EVENT_SPECIES, LAUNCH_ROSTER, REEL_FISH } from "@/lib/collections/roster";
import { MATERIALS } from "@/lib/crafting/recipes";
import { WEAPONS } from "@/lib/combat/weapons";
import { FISH } from "@/lib/game/fishing";
import { TOOLS } from "@/lib/game/tools";
import { RETIRED_DYE, iconKey } from "./keys";
import { PALETTE, PART_BY_ID, PARTS } from "@/lib/game/character/look";
import { CATALOGUE as PIECES } from "@/lib/homes/catalogue";
import { FLOORINGS, WALLPAPERS } from "@/lib/homes/layout";
import type { CatalogueEntry } from "@/lib/wallet/catalogue";

/** How an icon looks at its subject: a three-quarter view, a fish's profile, a bug from above, a long thing on the diagonal, a garment from the front, a finish's swatch. */
export type IconView = "three-quarter" | "profile" | "above" | "side" | "diagonal" | "front" | "roll" | "tile";
export interface IconSpec {
  key: string;
  view: IconView;
  /** The model (a GLB), or the texture for a finish. */
  url: string;
  /** Fish from the old dump need the stage's calibration (FishPreview buildFishStage). */
  raw?: boolean;
  /** A character part: its material tints (M_Main…; "none" hides one, the hair tucked under a hat). A dye: the colour of its liquid (M_Dye). */
  tints?: Record<string, string>;
  /** A character part is skinned to the rig. */
  skinned?: boolean;
  /** Stand a model up that was authored lying down (the HHA trophies, as the clubhouse stands them). */
  rotX?: number;
}

export { iconKey, iconUrl, shopIcon } from "./keys";

const ITEMS = "/assets/game/items/";
/** The backpack's upgrades (lib/collections/bag.ts): the bag accessories in their own colours. */
const POCKETS: Record<string, [string, Record<string, string>]> = {
  "bag:30": ["acc_shoulder_bag", { M_Main: "#7fae86", M_Accent: "#8a6a4a" }],
  "bag:40": ["acc_backpack", { M_Main: "#e08a5f", M_Accent: "#8a6a4a", M_Trim: "#f3e3b8" }],
};
const W = "/assets/game/weapons/";
const FISH_BY_KEY = new Map(FISH.map(f => [f.key, f]));
const CRITTER_MODELS: Record<string, string> = {
  bug_common_butterfly: "common-butterfly", bug_agrias_butterfly: "agrias-butterfly", bug_emperor_butterfly: "emperor-butterfly", bug_darner_dragonfly: "darner-dragonfly",
  bug_ladybug: "ladybug", bug_brown_cicada: "brown-cicada", bug_firefly: "firefly", bug_monarch_butterfly: "monarch-butterfly", bug_tiger_butterfly: "tiger-butterfly",
  bug_peacock_butterfly: "peacock-butterfly", bug_red_dragonfly: "red-dragonfly", bug_mantis: "mantis", bug_grasshopper: "grasshopper",
};
/** The island's weapon models (lib/game/combat/data.ts); the guardian drops reuse the crafted ones until their set is modelled. */
const WEAPON_MODEL: Record<string, string> = {
  "sword-driftwood": `${W}sword-driftwood.glb`, "sword-iron": `${W}sword-iron.glb`, "bow-willow": `${W}bow-willow.glb`, "bow-yew": `${W}bow-yew.glb`,
  "revolver-brass": `${W}revolver-brass.glb`, "staff-oak": `${W}staff-oak.glb`, "staff-rune": `${W}staff-rune.glb`, "tome-spirits": `${W}tome-spirits.glb`,
  "sword-guardian": `${W}sword-iron.glb`, "bow-sentinel": `${W}bow-yew.glb`, "staff-sigil": `${W}staff-rune.glb`, "tome-warden": `${W}tome-spirits.glb`,
  "staff-heartstone": `${W}staff-rune.glb`, "wraps-cloth": `${ITEMS}wraps-cloth.glb`, "shield-buckler": `${ITEMS}shield-buckler.glb`, "totem-cedar": "/assets/game/props/totem.glb",
};

function speciesSpec(key: string, sp?: { category: string; model: string | null }): IconSpec | null {
  const fish = FISH_BY_KEY.get(key);
  if (fish?.model) return { key, view: "profile", url: fish.model, raw: !!fish.raw };
  if (CRITTER_MODELS[key]) return { key, view: "above", url: `/assets/acnh/critters/${CRITTER_MODELS[key]}.glb` };
  if (key === "shore_gazami_crab") return { key, view: "above", url: "/assets/acnh/props/crab-gazami.glb" };
  if (key === "shore_hermit_crab") return { key, view: "three-quarter", url: "/assets/acnh/props/crab-hermit.glb" };
  if (key.startsWith("flower_")) return { key, view: "three-quarter", url: `/assets/acnh/plants/flower-${key.slice(7)}.glb` };
  if (key === "wood_branch") return { key, view: "diagonal", url: "/assets/game/props/branch.glb" };
  if (sp?.model) return { key, view: "three-quarter", url: sp.model };
  // Our own: fruit, rocks and ore, mushrooms and the bugs without a critter (build_items.py).
  return { key, view: key.startsWith("bug_") ? "side" : "three-quarter", url: `${ITEMS}${key}.glb` };
}

/** A part's own default tints (the colours it's sold in). */
function partTints(id: string): Record<string, string> {
  const part = PART_BY_ID.get(id);
  const tints: Record<string, string> = {};
  for (const m of part?.materials ?? []) {
    if (m.decal) continue;
    if (m.tint === "outfit") tints[m.name] = PALETTE.outfit[(m.default as number) ?? 0];
    else if (m.tint === "hair") tints[m.name] = "none";
    else if (m.color) tints[m.name] = m.color;
  }
  return tints;
}
const partSpec = (id: string): IconSpec | null => {
  const part = PART_BY_ID.get(id);
  return part ? { key: id, view: part.slot === "accessory" ? "three-quarter" : "front", url: `/assets/characters/v6/${part.glb}`, skinned: true, tints: partTints(id) } : null;
};

/** Every icon the game needs, each once. */
export function iconSpecs(shop: readonly Pick<CatalogueEntry, "slug" | "catalogue_ref" | "category">[]): IconSpec[] {
  const out = new Map<string, IconSpec>();
  const add = (s: IconSpec | null) => { if (s && !out.has(s.key)) out.set(s.key, s); };
  for (const sp of [...LAUNCH_ROSTER, ...EVENT_SPECIES, ...REEL_FISH, ...MATERIALS]) add(speciesSpec(sp.key, sp));
  for (const t of TOOLS) add({ key: t.key, view: "diagonal", url: t.model });
  for (const w of WEAPONS) add(WEAPON_MODEL[w.key] ? { key: w.key, view: w.key === "shield-buckler" || w.key === "totem-cedar" || w.key === "wraps-cloth" || w.key === "tome-spirits" || w.key === "tome-warden" ? "three-quarter" : "diagonal", url: WEAPON_MODEL[w.key] } : null);
  add({ key: "glider_leaf", view: "three-quarter", url: "/assets/game/props/leaf-glider.glb" });
  // The currencies, drawn where an amount shows (the shop, the HUD): play coins and Gems.
  add({ key: "coin", view: "three-quarter", url: `${ITEMS}coin.glb` });
  add({ key: "gem", view: "three-quarter", url: `${ITEMS}gem.glb` });
  for (const e of shop) {
    const key = iconKey(e), ref = e.catalogue_ref ?? "";
    if (out.has(key)) continue;
    if (key === "recipe_card" || key === "bobber-lucky" || key.startsWith("merch-")) add({ key, view: "three-quarter", url: `${ITEMS}${key === "recipe_card" ? "recipe_card" : e.slug}.glb` });
    else if (e.category === "hair") add({ key, view: "three-quarter", url: `${ITEMS}dye_bottle.glb`, tints: { Dye: ref.startsWith("hair:") ? PALETTE.hair[Number(ref.slice(5))] : RETIRED_DYE[e.slug] ?? "#B9B9B9" } });
    else if (e.category === "wallpaper") add({ key, view: "roll", url: `/assets/acnh/interior/wall-${ref}.png` });
    else if (e.category === "flooring") add({ key, view: "tile", url: `/assets/acnh/interior/floor-${ref}.png` });
    else if (e.category === "outfit" || e.category === "accessory") add(partSpec(key));
    else if (e.category === "furniture") { const piece = PIECES.find(p => p.id === ref); add(piece ? { key, view: "three-quarter", url: piece.url, ...(/hha-trophy$/.test(ref) ? { rotX: Math.PI / 2 } : {}) } : null); }
    else if (POCKETS[ref]) { const [part, tints] = POCKETS[ref]; const spec = partSpec(part); add(spec && { ...spec, key, tints }); }
  }
  // Finishes and parts the shop doesn't list yet still get one (the free plaster and parquet, starter clothes).
  for (const w of WALLPAPERS) add({ key: `wall-${w}`, view: "roll", url: `/assets/acnh/interior/wall-${w}.png` });
  for (const f of FLOORINGS) add({ key: `floor-${f}`, view: "tile", url: `/assets/acnh/interior/floor-${f}.png` });
  for (const p of PARTS) if (p.slot !== "bangs" && p.slot !== "back") add(partSpec(p.id));
  return [...out.values()];
}
