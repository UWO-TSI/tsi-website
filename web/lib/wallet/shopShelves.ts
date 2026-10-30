/**
 * The shop overlay's sidebar (David, 2026-10-18; specs/interiors/shop.md "The shop overlay"): the shelves you pick
 * with an icon, and each item's short line. In-game items sit on tools, clothes, furniture, specials (and sell, at the
 * counter); club merch on all, then whichever of apparel, accessories, stickers and home have something.
 */
import type { ShopEntry, ShopView } from "./service";
import { merchFilters, merchKind, type MerchKind } from "./merchShelf";

export type ItemShelf = "tools" | "outfits" | "furniture" | "specials";
export type ShopShelf = ItemShelf | "merch" | `merch:${MerchKind}` | "sell";
/** The shopkeeper's answer (the game's things or the club merch), or the tackle shop's rod shop (its tools shelf). */
export type ShopSection = "items" | "merch" | "rods";

export const SHELF_LABEL: Record<string, string> = {
  tools: "Tools", outfits: "Clothes", furniture: "Home", specials: "Today's specials", sell: "Sell",
  merch: "All merch", "merch:apparel": "Apparel", "merch:accessories": "Accessories", "merch:stickers": "Stickers", "merch:home": "Home",
};

/** The sidebar, top to bottom. `section` narrows it to one answer of the shopkeeper's; `sell` adds the counter's Sell. */
export function shopShelves(view: Pick<ShopView, "tabs">, section?: ShopSection, sell = false): ShopShelf[] {
  if (section === "rods") return ["tools"];
  // A shelf with nothing on it (home things before homes open, no specials in the pool) isn't shown; tools always is.
  const items = (["tools", "outfits", "furniture", "specials"] as ShopShelf[]).filter(s => s === "tools" || view.tabs[s as ItemShelf].length > 0);
  const merch: ShopShelf[] = merchFilters(view.tabs.merch).map(f => (f === "all" ? "merch" : `merch:${f}` as ShopShelf));
  const shelves = section === "merch" ? merch : section === "items" ? items : [...items, "merch" as ShopShelf];
  return sell && section !== "merch" ? [...shelves, "sell"] : shelves;
}

/** What's on a shelf. */
export function shelfItems(view: Pick<ShopView, "tabs">, shelf: ShopShelf): ShopEntry[] {
  if (shelf === "sell") return [];
  if (shelf === "merch") return view.tabs.merch;
  if (shelf.startsWith("merch:")) return view.tabs.merch.filter(e => merchKind(e) === shelf.slice(6));
  return view.tabs[shelf as ItemShelf];
}

const LINE: Record<string, string> = {
  tool: "A tool for the island.",
  outfit: "Something new to wear.",
  accessory: "A finishing touch for any outfit.",
  hair: "A new colour for your hair.",
  furniture: "For your home on the island.",
  wallpaper: "Wallpaper for your home's walls.",
  flooring: "Flooring for your home.",
  merch: "Real Tethos club merch.",
};
/** An item's short line: its own description where it has one, else one for its kind. */
export function itemLine(e: Pick<ShopEntry, "description" | "category" | "tier">): string {
  if (e.description.trim()) return e.description.trim();
  if (e.category === "tool" && e.tier) return `A ${e.tier} tool for the island.`;
  return LINE[e.category] ?? "From the Tethos shop.";
}
