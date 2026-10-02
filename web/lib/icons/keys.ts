/**
 * An item's icon (row 281, specs/game-ui.md §4): public/assets/icons/<key>.webp, rendered by lib/icons/manifest.ts's
 * renderer. Shop rows share where they're the same thing (a tool and its shop row, every recipe card); the shop's
 * sprite_url and the client both read it from here. Light on imports: the catalogues use it.
 */
import { toolByKey } from "@/lib/game/tools";

export const iconUrl = (key: string) => `/assets/icons/${key}.webp`;

/** Retired shop rows (pre-ownership, no character part): shown as the part closest to what they were. */
export const RETIRED_PART: Record<string, string> = {
  "outfit-sage-overalls": "onepiece_jumpsuit", "outfit-cream-knit": "top_sweater_vest", "outfit-wharf-raincoat": "top_raincoat", "outfit-club-tee": "top_tee",
  "acc-round-glasses": "acc_glasses_round", "acc-bandana": "acc_scarf",
};
/** Retired hair dyes: their dye bottle's colour. */
export const RETIRED_DYE: Record<string, string> = { "hair-chestnut": "#7A4A2E", "hair-sea-glass": "#8FC7C0", "hair-sunset": "#E8875A" };

/** The fields of a shop row an icon depends on. */
export interface IconRow { slug: string; catalogue_ref: string | null; category: string }
/** The icon key an item uses (several shop rows share one: a tool and its shop row, every recipe card). */
export function iconKey(e: IconRow): string {
  const ref = e.catalogue_ref ?? "";
  if (e.category === "tool") {
    if (ref.startsWith("recipe:")) return "recipe_card";
    if (e.slug === "rod-basic") return "rod_flimsy";
    if (ref === "glider_leaf") return "glider_leaf";
    const tool = toolByKey(ref) ?? toolByKey(e.slug);
    return tool?.key ?? e.slug;
  }
  if (e.category === "hair") return ref.startsWith("hair:") ? `dye-${ref.slice(5)}` : e.slug;
  if (e.category === "wallpaper") return `wall-${ref}`;
  if (e.category === "flooring") return `floor-${ref}`;
  if (e.category === "outfit" || e.category === "accessory") return ref || RETIRED_PART[e.slug] || e.slug;
  return ref || e.slug;
}
/** The icon (sprite_url) for a shop row. */
export const shopIcon = (e: IconRow) => iconUrl(iconKey(e));

