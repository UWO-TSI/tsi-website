import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiClient";
import { collect, localCollections } from "@/lib/game/collections";
import { localSell, localSellable, offline, resetLocalEconomy } from "./localEconomy";

describe("the sale with no server (a dev server with Supabase blanked)", () => {
  beforeEach(() => {
    const kept = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => kept.set(k, v), removeItem: (k: string) => kept.delete(k) });
    vi.stubGlobal("window", new EventTarget());
    resetLocalEconomy(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("NODE_ENV", "development");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("lists and sells what this browser caught, at the species price, and takes it out of the record", async () => {
    collect("fish_carp"); collect("fish_carp"); collect("wood_branch");
    const rows = await localSellable();
    const carp = rows.find(r => r.item_key === "fish_carp")!;
    expect(carp.count).toBe(2);
    expect(carp.price_each).toBeGreaterThan(0);
    const heard = vi.fn();
    window.addEventListener("tsi:api-write", heard);
    const sale = await localSell("fish_carp", 1, "sale-key-0001");
    expect(sale).toMatchObject({ paid: carp.price_each, remaining: 1, replayed: false });
    expect(localCollections().fish_carp).toBe(1);
    expect(heard).toHaveBeenCalledTimes(1);
    // The same key again is the same sale, not a second one.
    expect((await localSell("fish_carp", 1, "sale-key-0001")).replayed).toBe(true);
    expect(localCollections().fish_carp).toBe(1);
  });
  it("is only for a dev build with no Supabase, and only when the route turned it away", () => {
    const away = new ApiError("Not available yet.", 503, "unavailable");
    expect(offline(away)).toBe(true);
    expect(offline(new ApiError("You don't have that many.", 409, "insufficient_items"))).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    expect(offline(away)).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(offline(away)).toBe(false);
  });
});
