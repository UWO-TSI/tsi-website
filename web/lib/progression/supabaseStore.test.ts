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
    expect(await facts([{ subclass: null }])).toMatchObject({ oracleDone: true, trialDone: false });
    expect(await facts([{ subclass: "druid" }])).toMatchObject({ oracleDone: true, trialDone: true });
  });
});
