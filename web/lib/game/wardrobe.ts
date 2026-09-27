/**
 * Wardrobe stubs (decision 210; creator slots per 110): outfit, hair and
 * accessory choices from an inventory stub until the Blender character set
 * lands. The choice persists locally and is what the character card shows.
 */
export type WardrobeSlot = "hair" | "top" | "bottom" | "accessory";
export interface WardrobeItem { id: string; slot: WardrobeSlot; name: string; color: string }

export const WARDROBE_STUB: readonly WardrobeItem[] = [
  { id: "hair-bun", slot: "hair", name: "Top bun", color: "#2b2622" },
  { id: "hair-bowl", slot: "hair", name: "Bowl cut", color: "#2b2622" },
  { id: "hair-sweep", slot: "hair", name: "Side sweep", color: "#3b2a20" },
  { id: "hair-bob", slot: "hair", name: "Bob with bangs", color: "#2b2622" },
  { id: "hair-waves", slot: "hair", name: "Soft waves", color: "#5a3a26" },
  { id: "hair-part", slot: "hair", name: "Parted", color: "#1f1c1a" },
  { id: "hair-spiky", slot: "hair", name: "Tousled", color: "#1f1c1a" },
  { id: "top-hoodie", slot: "top", name: "TSI hoodie", color: "#3f6b58" },
  { id: "top-tee", slot: "top", name: "Striped tee", color: "#e7c35a" },
  { id: "top-knit", slot: "top", name: "Cable knit", color: "#c96f55" },
  { id: "top-shirt", slot: "top", name: "Collared shirt", color: "#dfe7ef" },
  { id: "bottom-jeans", slot: "bottom", name: "Jeans", color: "#48607e" },
  { id: "bottom-shorts", slot: "bottom", name: "Cargo shorts", color: "#9b8a62" },
  { id: "bottom-skirt", slot: "bottom", name: "Pleated skirt", color: "#6f5a8a" },
  { id: "acc-none", slot: "accessory", name: "None", color: "#ffffff" },
  { id: "acc-glasses", slot: "accessory", name: "Round glasses", color: "#3a3a3a" },
  { id: "acc-cap", slot: "accessory", name: "TSI cap", color: "#3f6b58" },
  { id: "acc-tote", slot: "accessory", name: "Tote bag", color: "#e9dcc0" },
];
export type Outfit = Record<WardrobeSlot, string>;
export const DEFAULT_OUTFIT: Outfit = { hair: "hair-part", top: "top-hoodie", bottom: "bottom-jeans", accessory: "acc-none" };
const KEY = "tsi.wardrobe.v1";

export function parseOutfit(raw: unknown): Outfit {
  const out = { ...DEFAULT_OUTFIT };
  if (raw && typeof raw === "object") for (const slot of Object.keys(out) as WardrobeSlot[]) {
    const id = (raw as Record<string, unknown>)[slot];
    if (typeof id === "string" && WARDROBE_STUB.some(i => i.id === id && i.slot === slot)) out[slot] = id;
  }
  return out;
}
export function loadOutfit(): Outfit {
  try { return parseOutfit(JSON.parse(localStorage.getItem(KEY) ?? "null")); } catch { return { ...DEFAULT_OUTFIT }; }
}
export function saveOutfit(outfit: Outfit): void {
  try { localStorage.setItem(KEY, JSON.stringify(outfit)); } catch { /* session only */ }
}
