/**
 * The backpack (rows 279–283, specs/game-ui.md milestone 2): what shares a slot, how many slots a stock fills, how
 * big the bag is, and the grid's arrangement. The server holds the stock and refuses a pickup that doesn't fit; the
 * migration 20261003054110_backpack.sql mirrors stackSize, slotsUsed and bagCapacity (bag_stack, bag_slots,
 * bag_capacity). Only member_collections stock takes a slot (catches, materials, fruit, shells): gear, wearables and
 * furniture take none (row 280). The arrangement of the grid is this device's.
 */
import { MATERIALS } from "@/lib/crafting/recipes";
import { RARITY_RANK, ROSTER, type Category, type Species } from "./roster";

/** A new member's bag. Pocket upgrades are shop rows whose catalogue_ref is `bag:<slots>` (proposal 23: 30, then 40). */
export const BAG_START = 20;
/** The home storage chest: the same stacks, many more slots. */
export const CHEST_SLOTS = 200;

const SPECIES = new Map<string, Species>([...ROSTER, ...MATERIALS].map(s => [s.key, s]));
const TYPE_ORDER: readonly Category[] = ["fish", "sea", "bug", "fruit", "nature", "mineral"];
/** An item's roster entry (name, category, rarity), or null for a key the roster doesn't know. */
export const itemInfo = (key: string): Species | null => SPECIES.get(key) ?? null;

/** How many share one slot (proposal 24): materials and fruit 30; flowers, shells and mushrooms 10; each fish, sea creature and bug its own. */
export function stackSize(key: string): number {
  const c = SPECIES.get(key)?.category;
  return c === "mineral" || c === "fruit" ? 30 : c === "nature" ? 10 : 1;
}
/** Crafting materials (branch, stone, clay, ore, crystal): what "Store all materials" moves. */
export const isMaterial = (key: string) => SPECIES.get(key)?.category === "mineral";

export type Stock = Readonly<Record<string, number>>;
/** The slots a stock fills; with `key`, as if it had `delta` more (or fewer) of that one item. */
export function slotsUsed(stock: Stock, key?: string, delta = 0): number {
  const all = key === undefined ? stock : { ...stock, [key]: (stock[key] ?? 0) + delta };
  let n = 0;
  for (const [k, c] of Object.entries(all)) if (c > 0) n += Math.ceil(c / stackSize(k));
  return n;
}
/** Can `n` more of `key` go in? Not when it would leave the bag over its size, so a bag already over takes nothing. */
export const fits = (stock: Stock, capacity: number, key: string, n = 1) => slotsUsed(stock, key, n) <= capacity;

/** The bag's size from the member's owned catalogue refs: the biggest pocket upgrade, else BAG_START. */
export function bagCapacity(owned: readonly string[]): number {
  let size = BAG_START;
  for (const ref of owned) {
    const m = /^bag:(\d+)$/.exec(ref);
    if (m) size = Math.max(size, Number(m[1]));
  }
  return size;
}

// ── The grid ─────────────────────────────────────────────────────────
/** A slot holds one stack of an item (its key), or nothing. */
export type Slot = string | null;

/** An item's stacks in slot order: 45 branches are 30 and 15. */
export function stacks(key: string, count: number): number[] {
  const size = stackSize(key), out: number[] = [];
  for (let left = count; left > 0; left -= size) out.push(Math.min(size, left));
  return out;
}

/**
 * The grid as this device left it (`saved`), brought up to the stock: a stack keeps its place while it lasts, one
 * that's gone leaves a hole, and new ones fill the first holes (a pickup lands in the first free slot). At least
 * `size` slots; a bag over its size still shows every stack.
 */
export function arrange(stock: Stock, saved: readonly Slot[], size: number): Slot[] {
  const need = new Map(Object.entries(stock).filter(([, n]) => n > 0).map(([k, n]) => [k, Math.ceil(n / stackSize(k))]));
  const out = saved.map(k => {
    const left = k ? need.get(k) ?? 0 : 0;
    if (!left) return null;
    need.set(k!, left - 1);
    return k;
  });
  while (out.length < size) out.push(null);
  for (const [k, n] of need) {
    for (let i = 0; i < n; i++) {
      const hole = out.indexOf(null);
      if (hole < 0) out.push(k);
      else out[hole] = k;
    }
  }
  while (out.length > size && out[out.length - 1] === null) out.pop();
  return out;
}

/** Each slot's count: an item's full stacks in its first slots, the partial one in its last. */
export function slotCounts(slots: readonly Slot[], stock: Stock): (number | null)[] {
  const seen = new Map<string, number>();
  return slots.map(k => {
    if (!k) return null;
    const i = seen.get(k) ?? 0;
    seen.set(k, i + 1);
    return stacks(k, stock[k] ?? 0)[i] ?? null;
  });
}

/** Auto-sort: by type (fish, sea creatures, bugs, fruit, nature, materials), then rarity (rarest first), then name; no holes. */
export function sortSlots(stock: Stock): Slot[] {
  const type = (k: string) => {
    const i = TYPE_ORDER.indexOf(SPECIES.get(k)?.category as Category);
    return i < 0 ? TYPE_ORDER.length : i;
  };
  const rank = (k: string) => RARITY_RANK[SPECIES.get(k)?.rarity ?? "common"];
  const name = (k: string) => SPECIES.get(k)?.name ?? k;
  return Object.keys(stock).filter(k => stock[k] > 0)
    .sort((a, b) => type(a) - type(b) || rank(b) - rank(a) || name(a).localeCompare(name(b)))
    .flatMap(k => Array<string>(Math.ceil(stock[k] / stackSize(k))).fill(k));
}
