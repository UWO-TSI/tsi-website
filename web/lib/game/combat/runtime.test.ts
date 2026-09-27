import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ABILITY_KEYS, readAbilityKeys, remapAbility } from "./runtime";

const saved = new Map<string, string>();
beforeEach(() => { saved.clear(); vi.stubGlobal("localStorage", { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => { saved.set(k, v); } }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("ability keys", () => {
  it("default to 1–4 for the slots and Q for the swap, remap with swaps, refuse movement/dodge/menu keys, and persist", () => {
    expect(readAbilityKeys()).toEqual(DEFAULT_ABILITY_KEYS);
    expect(DEFAULT_ABILITY_KEYS).toEqual({ slot1: "1", slot2: "2", slot3: "3", slot4: "4", swap: "q" });
    const swapped = remapAbility(DEFAULT_ABILITY_KEYS, "slot1", "2");
    expect(swapped).toMatchObject({ ok: true, keys: { slot1: "2", slot2: "1" } });
    expect(readAbilityKeys()).toMatchObject({ slot1: "2", slot2: "1" });
    expect(remapAbility(DEFAULT_ABILITY_KEYS, "slot1", " ")).toMatchObject({ ok: false });
    expect(remapAbility(DEFAULT_ABILITY_KEYS, "slot1", "w")).toMatchObject({ ok: false });
    expect(remapAbility(DEFAULT_ABILITY_KEYS, "slot1", "b")).toMatchObject({ ok: false });
    expect(remapAbility(DEFAULT_ABILITY_KEYS, "slot4", "r")).toMatchObject({ ok: true, keys: { slot4: "r" } });
  });
});
