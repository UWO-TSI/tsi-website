/**
 * The main quest's tallies from what the server reads (lib/progression/chapters.ts FactCount): the member's
 * collection rows, their gear, and the museum's donations. Pure, so both stores and the tests share it.
 */
import { ROSTER, type Species } from "@/lib/collections/roster";
import { bestTool, type ToolKind } from "@/lib/game/tools";
import type { FactCount } from "./chapters";

/** A buried find (dug up with the shovel), as the world and the museum's "finds" count it. */
export const isBuried = (sp: Pick<Species, "tool" | "category">) => sp.tool === "shovel" && sp.category !== "mineral";

const BY_KEY = new Map(ROSTER.map((s) => [s.key, s]));
/** A museum kind for the club's tally (m5): the aquarium's fish, the insect hall's bugs, and buried finds. */
export function museumKind(key: string): "fish" | "bugs" | "finds" | null {
  const sp = BY_KEY.get(key);
  if (!sp) return null;
  if (isBuried(sp)) return "finds";
  return sp.wing === "aquarium" ? "fish" : sp.wing === "insect_hall" ? "bugs" : null;
}

export interface CollectionRow { item_key: string; total: number; updated_at: string | null }
export type MuseumTally = Record<"fish" | "bugs" | "finds", number>;

export interface QuestFacts {
  firstCatchKey: string | null;
  lastFishAt: string | null;
  counts: Partial<Record<FactCount, number>>;
  museum: MuseumTally;
}

/**
 * `rows`: the member's member_collections rows (total ever collected); `owned`/`taught`: their gear as checkHeld
 * reads it (lib/game/tools.ts); `donations`: every museum donation (one per species, club-wide).
 */
export function questFacts(memberId: string, rows: readonly CollectionRow[], owned: readonly string[], taught: boolean, donations: readonly { species_key: string; donor_id: string | null }[]): QuestFacts {
  const fish = rows.filter((r) => r.item_key.startsWith("fish_") && r.total > 0);
  const sum = (pick: (key: string) => boolean) => rows.reduce((n, r) => n + (pick(r.item_key) ? r.total : 0), 0);
  const has = (kind: ToolKind) => (bestTool(kind, owned, taught) ? 1 : 0);
  const museum: MuseumTally = { fish: 0, bugs: 0, finds: 0 };
  for (const d of donations) {
    const k = museumKind(d.species_key);
    if (k) museum[k]++;
  }
  return {
    firstCatchKey: fish[0]?.item_key ?? null,
    lastFishAt: fish.reduce<string | null>((t, r) => (r.updated_at && (!t || r.updated_at > t) ? r.updated_at : t), null),
    counts: {
      fish: sum((k) => k.startsWith("fish_")),
      fish_kinds: fish.length,
      bugs: sum((k) => k.startsWith("bug_")),
      digs: sum((k) => { const sp = BY_KEY.get(k); return !!sp && isBuried(sp); }),
      stone: sum((k) => k === "rock_stone"),
      iron: sum((k) => k === "rock_iron_nugget"),
      donations: donations.filter((d) => d.donor_id === memberId).length,
      net: has("net"),
      shovel: has("shovel"),
      pickaxe: has("pickaxe"),
    },
    museum,
  };
}
