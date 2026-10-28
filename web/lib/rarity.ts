/**
 * The one rarity ladder for every item and fish (David, 2026-10-27, v1-gameplay f-rods): common, uncommon, rare,
 * epic, legendary, Divine, Contraband. Colours are the GUI kit's --gui-rarity-* tokens (styles/game-tokens.css);
 * Divine is holographic (it took over the old Sea King crown), Contraband is dark.
 *
 * Contraband is staff tools (David, 2026-10-27: "like mod tools normal ppl cant get it"): for mods and T0/T1 only. No
 * shop, drop, catch, quest, recipe, roulette, mystery box or reward ever grants one; the only way in is an admin grant
 * to a staff account (rarity.test.ts holds every obtainable source to OBTAINABLE). Showing the tier stays shut behind
 * NEXT_PUBLIC_CONTRABAND=1, and `mayHoldContraband` says who may hold one.
 */
export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "divine", "contraband"] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_RANK = Object.fromEntries(RARITIES.map((r, i) => [r, i])) as Record<Rarity, number>;
export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary", divine: "Divine", contraband: "Contraband",
};

/** Every tier a normal player can get from any source: all but Contraband. */
export const OBTAINABLE: readonly Rarity[] = RARITIES.filter(r => r !== "contraband");

export const isRarity = (v: unknown): v is Rarity => (RARITIES as readonly unknown[]).includes(v);

/** The Contraband gate: the flag is on and the member is a mod or tier 0 or 1. */
export const CONTRABAND_OPEN = process.env.NEXT_PUBLIC_CONTRABAND === "1";
export function mayHoldContraband(who: { tier: number | null; mod?: boolean }, open = CONTRABAND_OPEN): boolean {
  return open && (who.mod === true || (who.tier !== null && who.tier <= 1));
}
