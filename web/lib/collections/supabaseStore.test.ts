import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseCollectionsStore } from "./supabaseStore";

/** A client whose every query fails the way a busy database does. */
const failing = { from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } }) }) }) } as unknown as SupabaseClient;

describe("supabase collections store", () => {
  it("fails a gear read on a database error instead of rolling with the starter rod", async () => {
    await expect(supabaseCollectionsStore(failing).ownedGear("00000000-0000-4000-8000-0000000000aa")).rejects.toThrow();
  });
});
