import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ABILITY_KEYS, readAbilityKeys, remapAbility } from "./runtime";

const saved = new Map<string, string>();
beforeEach(() => { saved.clear(); vi.stubGlobal("localStorage", { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => { saved.set(k, v); } }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("ability keys", () => {
  it("default to 1–4, remap with swaps, refuse movement/dodge/menu keys, and persist", () => {
    expect(readAbilityKeys()).toEqual(DEFAULT_ABILITY_KEYS);
    const swapped = remapAbility(DEFAULT_ABILITY_KEYS, "spark", "2");
    expect(swapped).toMatchObject({ ok: true, keys: { spark: "2", binding: "1" } });
    expect(readAbilityKeys()).toMatchObject({ spark: "2", binding: "1" });
    expect(remapAbility(DEFAULT_ABILITY_KEYS, "spark", " ")).toMatchObject({ ok: false });
    expect(remapAbility(DEFAULT_ABILITY_KEYS, "spark", "w")).toMatchObject({ ok: false });
    expect(remapAbility(DEFAULT_ABILITY_KEYS, "spark", "b")).toMatchObject({ ok: false });
    expect(remapAbility(DEFAULT_ABILITY_KEYS, "signature", "q")).toMatchObject({ ok: true, keys: { signature: "q" } });
  });
});
