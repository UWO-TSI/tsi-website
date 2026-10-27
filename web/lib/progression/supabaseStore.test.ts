import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseProgressionStore } from "./supabaseStore";

type Row = Record<string, unknown>;
const A = "00000000-0000-4000-8000-0000000000aa";
/** Reads only: every query answers its table's first row (or all rows when not single). */
const db = (tables: Record<string, Row[]>) => ({
  from: (table: string) => {
    const rows = tables[table] ?? [];
    const q: Record<string, unknown> = { then: (ok: (v: unknown) => void) => ok({ data: rows, error: null }), maybeSingle: async () => ({ data: rows[0] ?? null, error: null }) };
    for (const k of ["select", "eq", "like", "limit"]) q[k] = () => q;
    return q;
  },
}) as unknown as SupabaseClient;

describe("chapter facts from the database", () => {
  it("chapter 4's level-10 step is the subclass choice (row 207), as the ruins gate reads it", async () => {
    const facts = (progression: Row[]) => supabaseProgressionStore(db({ profiles: [{ tier: 4, class: "Warden" }], member_progression: progression })).memberFacts(A);
    expect((await facts([{ subclass: null }])).counts).toMatchObject({ oracle: 1, trial: 0 });
    expect((await facts([{ subclass: "druid" }])).counts).toMatchObject({ oracle: 1, trial: 1 });
  });
  it("tallies the main quest from the member's collection, gear and the museum's donations", async () => {
    const f = await supabaseProgressionStore(db({
      profiles: [{ tier: 4 }],
      member_collections: [
        { item_key: "fish_dace", count: 0, total_collected: 2, updated_at: "2026-10-27T10:00:00Z" },
        { item_key: "fish_carp", count: 1, total_collected: 1, updated_at: "2026-10-27T11:00:00Z" },
        { item_key: "bug_common_butterfly", count: 0, total_collected: 3, updated_at: null },
        { item_key: "shell_asari", count: 1, total_collected: 2, updated_at: null },
        { item_key: "rock_stone", count: 4, total_collected: 6, updated_at: null },
      ],
      member_inventory: [{ shop_items: { slug: "net-basic", catalogue_ref: null } }],
      museum_donations: [{ species_key: "fish_dace", donor_id: A }, { species_key: "bug_common_butterfly", donor_id: "someone" }, { species_key: "shell_asari", donor_id: A }],
    })).memberFacts(A);
    expect(f).toMatchObject({ firstCatchKey: "fish_dace", lastFishAt: "2026-10-27T11:00:00Z", museum: { fish: 1, bugs: 1, finds: 1 } });
    // Not taught (no ledger row): the starter net and shovel are everyone's; the pickaxe only from Eliza.
    expect(f.counts).toMatchObject({ fish: 3, fish_kinds: 2, bugs: 3, digs: 2, stone: 6, iron: 0, donations: 2, net: 1, shovel: 1, pickaxe: 0 });
  });
});
