import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ABILITY_KEYS, readAbilityKeys, remapAbility } from "../movement/keys";

const saved = new Map<string, string>();
beforeEach(() => { saved.clear(); vi.stubGlobal("localStorage", { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => { saved.set(k, v); } }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("ability keys", () => {
  it("default to 1–4 for the slots and R for the swap, remap with swaps, refuse movement/dodge/menu keys, and persist", () => {
    expect(readAbilityKeys()).toEqual(DEFAULT_ABILITY_KEYS);
    expect(DEFAULT_ABILITY_KEYS).toEqual({ slot1: "1", slot2: "2", slot3: "3", slot4: "4", slot5: "5", ult: "f", swap: "r" }); // classes v2: key 5 and the ult on F
    expect(remapAbility(DEFAULT_ABILITY_KEYS, "swap", "q")).toMatchObject({ ok: false }); // Q is the dash
    saved.set("tsi.combatKeys.v2", JSON.stringify({ ...DEFAULT_ABILITY_KEYS, swap: "q" })); // saved before the move
    expect(readAbilityKeys().swap).toBe("r");
    saved.clear();
    const swapped = remapAbility(DEFAULT_ABILITY_KEYS, "slot1", "2");
    expect(swapped).toMatchObject({ ok: true, keys: { slot1: "2", slot2: "1" } });
    expect(readAbilityKeys()).toMatchObject({ slot1: "2", slot2: "1" });
    expect(remapAbility(DEFAULT_ABILITY_KEYS, "slot1", " ")).toMatchObject({ ok: false });
    expect(remapAbility(DEFAULT_ABILITY_KEYS, "slot1", "w")).toMatchObject({ ok: false });
    expect(remapAbility(DEFAULT_ABILITY_KEYS, "slot1", "b")).toMatchObject({ ok: false });
    // The mailbox (L) and wallet (K) menu keys, and the fixed decorate and emote keys.
    for (const key of ["l", "k", "f", "g"]) expect(remapAbility(DEFAULT_ABILITY_KEYS, "slot1", key)).toMatchObject({ ok: false });
    // Z, X and V are fixed elsewhere, but the slots may take them (the Z X C V preset, row 279): in the ruins they win.
    for (const key of ["z", "x", "v"]) expect(remapAbility(DEFAULT_ABILITY_KEYS, "slot1", key)).toMatchObject({ ok: true });
    expect(remapAbility(DEFAULT_ABILITY_KEYS, "slot4", "r")).toMatchObject({ ok: true, keys: { slot4: "r", swap: "4" } });
  });
});
