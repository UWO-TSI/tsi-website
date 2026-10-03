/**
 * Fewer villagers as more players come (specs/multiplayer.md §5.8, design principle 2: the world never feels empty,
 * and NPCs scale inversely with the players): the flavour villagers walk home through their routine's door as the
 * village fills, and come back out as it empties. Service residents (a post other than "villager") always stay. The
 * headcount is room state and the order is fixed, so every client in a shard sends the same villagers home.
 *
 * The plan's cast is 12 with 7 service posts: 12 shown up to 5 others, 10 at 6 or more, 8 at 10 or more, and only the
 * service residents (7) at 15 or more. As counts of flavour villagers sent home: 2, 4, all.
 */
import { hashSeed } from "@/lib/game/character/look";

export const THINNING: readonly { readonly others: number; readonly home: number }[] = [
  { others: 15, home: Infinity }, { others: 10, home: 4 }, { others: 6, home: 2 },
];
const NONE: ReadonlySet<string> = new Set();

/** A flavour villager: no post, or "villager". */
export const isFlavour = (r: { post?: string | null }) => !r.post || r.post === "villager";

/** The slugs of the villagers who are home for this many other players in the village. */
export function residentsHome(residents: readonly { slug: string; post?: string | null }[], others: number): ReadonlySet<string> {
  const home = THINNING.find(t => others >= t.others)?.home ?? 0;
  if (home <= 0) return NONE;
  // Always the same ones first (a hash of the slug: not the alphabet, not who was added last).
  const flavour = residents.filter(isFlavour).map(r => r.slug).sort((a, b) => hashSeed(a) - hashSeed(b) || a.localeCompare(b));
  return new Set(flavour.slice(0, Math.min(home, flavour.length)));
}
