import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MOVE_KEYS, readMoveKeys, remapMove } from "./keys";

const saved = new Map<string, string>();
beforeEach(() => { saved.clear(); vi.stubGlobal("localStorage", { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => { saved.set(k, v); } }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("movement keys", () => {
  it("default to WASD, Space jump, Q dash, Shift sprint, C sneak; remap with swaps, refuse menu and ability keys, and persist", () => {
    expect(readMoveKeys()).toEqual({ forward: "w", left: "a", back: "s", right: "d", jump: " ", dash: "q", sprint: "shift", sneak: "c" });
    expect(remapMove(DEFAULT_MOVE_KEYS, "forward", "ArrowUp")).toMatchObject({ ok: true, keys: { forward: "arrowup" } });
    expect(remapMove(DEFAULT_MOVE_KEYS, "dash", " ")).toMatchObject({ ok: true, keys: { dash: " ", jump: "q" } });
    expect(readMoveKeys()).toMatchObject({ dash: " ", jump: "q" });
    expect(remapMove(DEFAULT_MOVE_KEYS, "dash", "e")).toMatchObject({ ok: false });
    expect(remapMove(DEFAULT_MOVE_KEYS, "dash", "1", ["1", "2", "3", "4", "r"])).toMatchObject({ ok: false });
    // Emotes (G) and put away (X) are fixed keys; the menu keys (account settings) are taken.
    for (const key of ["g", "x", "b", "l"]) expect(remapMove(DEFAULT_MOVE_KEYS, "sprint", key)).toMatchObject({ ok: false });
    saved.set("tsi.moveKeys.v1", JSON.stringify({ ...DEFAULT_MOVE_KEYS, sprint: "g" })); // saved before G was fixed
    expect(readMoveKeys().sprint).toBe("shift");
    saved.set("tsi.moveKeys.v1", JSON.stringify({ ...DEFAULT_MOVE_KEYS, jump: "w" })); // a clash: back to the defaults
    expect(readMoveKeys()).toEqual(DEFAULT_MOVE_KEYS);
  });
});
