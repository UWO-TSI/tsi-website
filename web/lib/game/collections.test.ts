import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { castLine, collect, collectionCounts, harvestNode, localCollections, mergeWithLocal, spendCollected } from "./collections";

const KEY = "tsi.collections.local.v1";
let saved: Map<string, string>;

beforeEach(() => {
  saved = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});
afterEach(() => vi.unstubAllGlobals());

describe("collection discovery and stock", () => {
  it("keeps discovery after the last item is sold and collected again", () => {
    collect("fish_dace");
    expect(spendCollected("fish_dace", 1)).toBe(0);
    expect(localCollections()).toEqual({ fish_dace: 0 });
    collect("fish_dace");
    expect(localCollections()).toEqual({ fish_dace: 1 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([null, [], "fish", 12, true])("rejects non-record data: %s", (value) => {
    expect(collectionCounts(value)).toEqual({});
  });

  it("retains valid unknown kinds and zero stock, discarding invalid counts and keys", () => {
    const value = JSON.parse('{"apple":0,"future_kind":3,"negative":-1,"fraction":1.2,"string":"4","unsafe":9007199254740992,"bad-key":1,"__proto__":2,"constructor":3,"prototype":4}');
    expect(collectionCounts(value)).toEqual({ apple: 0, future_kind: 3 });
    expect(collectionCounts({ infinite: Infinity, nan: NaN })).toEqual({});
  });

  it("recovers from malformed storage", () => {
    saved.set(KEY, "{broken");
    expect(localCollections()).toEqual({});
    collect("apple");
    expect(localCollections()).toEqual({ apple: 1 });
  });

  it.each([-1, 0, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])("invalid spending cannot change stock: %s", (amount) => {
    saved.set(KEY, '{"apple":3}');
    expect(spendCollected("apple", amount)).toBe(3);
    expect(localCollections()).toEqual({ apple: 3 });
  });

  it("does not create discoveries from missing or invalid keys", () => {
    expect(spendCollected("apple", 1)).toBe(0);
    expect(spendCollected("constructor", 1)).toBe(0);
    collect("__proto__");
    collect("bad-key");
    expect(localCollections()).toEqual({});
    expect(fetch).not.toHaveBeenCalled();
  });

  it("caps depletion at zero and retains discovery", () => {
    saved.set(KEY, '{"apple":2}');
    expect(spendCollected("apple", 10)).toBe(0);
    expect(localCollections()).toEqual({ apple: 0 });
  });

  it("merges discovery from either source under the existing max-count contract", () => {
    saved.set(KEY, '{"apple":0,"peach":4,"acorn":1}');
    expect(mergeWithLocal({ peach: 2, acorn: 3, petal: 0, invalid: -1 })).toEqual({
      apple: 0, peach: 4, acorn: 3, petal: 0,
    });
  });

  it("asks the server for a roll by place, never with a species", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, catch: { item_key: "apple", size_cm: null } }) }));
    expect(await harvestNode("fruit-1", [1, 2])).toEqual({ ok: true, catch: { item_key: "apple", size_cm: null } });
    expect(fetch).toHaveBeenCalledWith("/api/collections", expect.objectContaining({ method: "POST", body: '{"action":"harvest","node":"fruit-1","at":[1,2]}' }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ ok: false, error: "Too quick.", code: "too_fast" }) }));
    expect(await castLine("village", [0, 0], 1)).toEqual({ ok: false, error: "Too quick.", code: "too_fast" });
    // Signed out: no server record, the world keeps it local.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    expect(await castLine("village", [0, 0], 1)).toBeNull();
  });
});
