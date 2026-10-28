import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { OBTAINABLE, RARITIES, RARITY_RANK, mayHoldContraband } from "./rarity";
import { sellPrice } from "./wallet/rules";
import { ROSTER } from "./collections/roster";
import { TREATS } from "./collections/treats";
import { FISH, RARITY_META } from "./game/fishing";
import { CRAFTED_ITEMS, DROP_RARITIES, MATERIALS, RECIPES, RECIPE_DROPS } from "./crafting/recipes";
import { BOSS_DROPS, MINIBOSS_DROPS } from "./combat/content";
import { CATALOGUE, EVENT_ITEMS, OWNERSHIP_ITEMS } from "./wallet/catalogue";
import { DEFAULT_GOALS } from "./progression/defaults";

describe("the rarity ladder", () => {
  it("runs common to Contraband, in David's order", () => {
    expect(RARITIES).toEqual(["common", "uncommon", "rare", "epic", "legendary", "divine", "contraband"]);
    expect(RARITY_RANK.divine).toBeGreaterThan(RARITY_RANK.legendary);
  });
  it("keeps Contraband shut until the flag opens it, then only for mods and T0/T1", () => {
    expect(mayHoldContraband({ tier: 1, mod: true }, false)).toBe(false);
    expect(mayHoldContraband({ tier: 0 }, true)).toBe(true);
    expect(mayHoldContraband({ tier: 1 }, true)).toBe(true);
    expect(mayHoldContraband({ tier: 2 }, true)).toBe(false);
    expect(mayHoldContraband({ tier: null, mod: true }, true)).toBe(true);
    expect(mayHoldContraband({ tier: null }, true)).toBe(false);
  });
  it("sells Divine above legendary and never buys Contraband", () => {
    expect(sellPrice("fish", "divine")!).toBeGreaterThan(sellPrice("fish", "legendary")!);
    expect(sellPrice("fish", "contraband")).toBeNull();
  });
});

describe("Contraband is staff tools: no obtainable source has one (David, 2026-10-27)", () => {
  const obtainable = (r: unknown, where: string) => expect(OBTAINABLE as readonly unknown[], where).toContain(r);
  it("never in a catch, a forage find, a material or a treat", () => {
    for (const s of [...ROSTER, ...MATERIALS, ...TREATS]) obtainable(s.rarity, s.key);
    for (const f of FISH) obtainable(f.rarity, f.key);
    expect(RARITY_META.contraband.weight).toBe(0);
  });
  it("never a recipe drop or a boss's loot", () => {
    for (const r of DROP_RARITIES) obtainable(r, `drop ${r}`);
    for (const [id, r] of Object.entries(RECIPE_DROPS)) obtainable(r, `recipe ${id}`);
    for (const t of [BOSS_DROPS, ...Object.values(MINIBOSS_DROPS)]) for (const g of t.gear) obtainable(g.rarity, `${t.enemy} gear`);
  });
  it("never a shop row, a quest's reward or a recipe's output (none is a Contraband species)", () => {
    const species = new Map([...ROSTER, ...MATERIALS, ...TREATS].map((s) => [s.key, s.rarity]));
    const granted = [
      ...[...CATALOGUE, ...OWNERSHIP_ITEMS, ...EVENT_ITEMS, ...CRAFTED_ITEMS].flatMap((c) => [c.slug, c.catalogue_ref]),
      ...RECIPES.map((r) => r.output.key),
      ...DEFAULT_GOALS.flatMap((g) => g.event?.rewards ?? []),
    ];
    for (const k of granted) if (k && species.has(k)) obtainable(species.get(k), k);
  });
  it("can't be put on a shop row, in the admin editor or the database", () => {
    expect(OBTAINABLE).not.toContain("contraband");
    const sql = readFileSync(new URL("../supabase/migrations/20261027140000_rarity_ladder.sql", import.meta.url), "utf8");
    expect(sql.match(/shop_items_rarity_check\s+CHECK \(([^)]*)\)/)?.[1]).not.toMatch(/contraband/);
  });
});
