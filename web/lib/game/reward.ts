/**
 * The shared reward card (specs/polish/forage-craft-museum.md deliverable 1): what a catch, a find, a craft or a
 * bottle's recipe shows, read from the events the world already sends. Pure: components/game/RewardCard draws it.
 *   tsi:peaceful-got   { key, name, rarity, one_liner, size, isNew, kind | bug }  a bug, a forage find, a dig, a tree's drop
 *   tsi:crafted        { id, name, kind }                                          a workbench craft (Workshop)
 *   tsi:recipe-learned { id, name }                                                a message bottle's recipe (BeachBottle)
 *   tsi:gift           { key, name, title, note }                                  a resident's gift (Bram's old rod, the arrival)
 * The pickup's fly-in into the Bag (BagButton) is the bag's; the card sits beside it and says what it was.
 */
import type { SFXName } from "./audio";
import { ROSTER } from "@/lib/collections/roster";
import { RARITY_RANK as RANK, isRarity, type Rarity } from "@/lib/rarity";
import { CRAFTED_ITEMS, MATERIALS, RECIPES } from "@/lib/crafting/recipes";
import { TREATS } from "@/lib/collections/treats";
import { CATALOGUE } from "@/lib/wallet/catalogue";
import { WEAPONS } from "@/lib/combat/weapons";
import { iconUrl, shopIcon } from "@/lib/icons/keys";

export const REWARD_EVENTS = ["tsi:peaceful-got", "tsi:crafted", "tsi:recipe-learned", "tsi:gift", "tsi:dig-purse"] as const;
/** `purse`: a dig that turned up coins or a gem (lib/collections/digLoot.ts), paid into the wallet. */
export type RewardKind = "bug" | "forage" | "dig" | "purse" | "craft" | "bottle";
export interface RewardIngredient { key: string; name: string; icon: string; count: number }
export interface Reward {
  kind: RewardKind;
  key: string;
  name: string;
  /** The item's art: its icon, rendered from its model (lib/icons). */
  icon: string;
  rarity: Rarity | null;
  /** Centimetres, for what has a size. */
  size: number | null;
  isNew: boolean;
  /** Over the name: "New!", "Caught", "Dug up", "Crafted", "A recipe". */
  title: string;
  /** Under it: the species' one-liner, or where a made thing went. */
  note: string;
  /** A bottle's recipe: what it takes. */
  ingredients?: RewardIngredient[];
}

const SPECIES = new Map([...ROSTER, ...MATERIALS, ...TREATS].map(s => [s.key, s]));
const ICON = new Map<string, string>([...CATALOGUE, ...CRAFTED_ITEMS].map(c => [c.slug, c.sprite_url ?? shopIcon(c)]));
for (const w of WEAPONS) ICON.set(w.key, iconUrl(w.key));
/** A made thing's art: its shop row's icon (furniture, tools, clothes) or the weapon's. */
export const madeIcon = (key: string) => ICON.get(key) ?? iconUrl(key);

const str = (v: unknown, max = 120) => (typeof v === "string" && v.trim() && v.length <= max ? v : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function made(id: string, kind: unknown): string {
  if (kind === "weapon") return "It's in your gear for the ruins.";
  if (id.startsWith("bag-")) return "Your backpack has more room now.";
  if (id === "glider-leaf") return "Run off an edge, press jump again while you fall and hold it. Try it from the ledge marked outside.";
  return "It takes no room in your pockets: find it in your Bag, under tools, clothes and furniture.";
}

/** The card a world event shows, or null when it isn't one (or is malformed). */
export function rewardOf(type: string, detail: unknown): Reward | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as Record<string, unknown>;
  if (type === "tsi:peaceful-got") {
    const key = str(d.key, 64), name = str(d.name);
    if (!key || !name) return null;
    const kind: RewardKind = d.bug === true || d.kind === "bug" ? "bug" : d.kind === "dig" ? "dig" : "forage";
    const rarity = isRarity(d.rarity) ? d.rarity : SPECIES.get(key)?.rarity ?? null;
    const isNew = d.isNew === true;
    return { kind, key, name, icon: iconUrl(key), rarity, size: num(d.size), isNew,
      title: isNew ? "New!" : kind === "bug" ? "Caught" : kind === "dig" ? "Dug up" : "Found",
      note: str(d.one_liner, 200) ?? SPECIES.get(key)?.oneLiner ?? "" };
  }
  if (type === "tsi:dig-purse") {
    const gem = d.currency === "gems", amount = num(d.amount);
    if (!amount || amount < 1 || (!gem && d.currency !== "coins")) return null;
    // A gem is the premium currency: very rare from a dig, so it pops as the rarest thing it is.
    return { kind: "purse", key: gem ? "gem" : "coin", name: gem ? (amount === 1 ? "A gem" : `${amount} gems`) : `${amount} coins`, icon: iconUrl(gem ? "gem" : "coin"),
      rarity: gem ? "legendary" : null, size: null, isNew: false, title: "Dug up", note: gem ? "Buried treasure, the real kind." : "Someone's old purse. Finders keepers." };
  }
  if (type === "tsi:crafted") {
    const id = str(d.id, 64), name = str(d.name);
    if (!id || !name) return null;
    // The leaf glider is the first movement unlock (specs/glider.md): its card says what's new, the guided first glide follows.
    const unlock = id === "glider-leaf";
    return { kind: "craft", key: id, name, icon: madeIcon(id), rarity: null, size: null, isNew: unlock, title: unlock ? "New: you can glide" : "Crafted", note: made(id, d.kind) };
  }
  if (type === "tsi:gift") {
    const key = str(d.key, 64), name = str(d.name);
    if (!key || !name) return null;
    return { kind: "craft", key, name, icon: madeIcon(key), rarity: null, size: null, isNew: true, title: str(d.title, 60) ?? "A gift", note: str(d.note, 200) ?? "" };
  }
  if (type === "tsi:recipe-learned") {
    const id = str(d.id, 64), name = str(d.name);
    if (!id || !name) return null;
    const recipe = RECIPES.find(r => r.id === id);
    const ingredients = recipe ? Object.entries(recipe.ingredients).map(([key, count]) => ({ key, name: SPECIES.get(key)?.name ?? key, icon: iconUrl(key), count })) : [];
    return { kind: "bottle", key: id, name, icon: madeIcon(recipe?.output.key ?? id), rarity: null, size: null, isNew: true, title: "A recipe", ingredients,
      note: "The tide brought it in. Craft it at the workbench in HQ." };
  }
  return null;
}

/** The card's chime: the success sound, a little lower and fuller the rarer the find (never a dialogue blip or a door). */
export function rewardSound(r: Reward): { name: SFXName; rate: number; gain: number } {
  const k = r.rarity ? RANK[r.rarity] : r.kind === "craft" || r.kind === "bottle" ? 1 : 0;
  return { name: "confirm", rate: 1.06 - k * 0.07, gain: Math.min(0.9, 0.42 + k * 0.1 + (r.isNew ? 0.08 : 0)) };
}

/** How long the card stays up (ms): longer for something new or rare, longest for a recipe to read. */
export function rewardHold(r: Reward): number {
  if (r.kind === "bottle") return 6500;
  const k = r.rarity ? RANK[r.rarity] : 1;
  return 3200 + (r.isNew ? 900 : 0) + k * 350 + (r.kind === "craft" ? 600 : 0);
}
