import { describe, expect, it } from "vitest";
import { LOCKED_MOVES, moveUnlocked, readUnlocks, unlockMove } from "./moveUnlocks";

function memory() {
  const map = new Map<string, string>();
  return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
}

describe("moves that come later", () => {
  it("are only the glider: the dash is everyone's from the start", () => {
    expect([...LOCKED_MOVES]).toEqual(["glider"]);
  });
  it("stay locked in the shipped game until unlocked", () => {
    const store = memory();
    expect(moveUnlocked("glider", { dev: false, unlocked: readUnlocks(store) })).toBe(false);
    unlockMove("glider", store);
    expect(moveUnlocked("glider", { dev: false, unlocked: readUnlocks(store) })).toBe(true);
  });
  it("are all unlocked in development, unless the dev asks to see them locked", () => {
    const none = readUnlocks(memory());
    expect(moveUnlocked("glider", { dev: true, unlocked: none })).toBe(true);
    expect(moveUnlocked("glider", { dev: true, unlocked: none, devLocked: true })).toBe(false);
  });
  it("read nothing odd from storage (an old saved dash is ignored)", () => {
    const store = memory();
    store.setItem("tsi.moves.v1", "{nope");
    expect(readUnlocks(store).size).toBe(0);
    store.setItem("tsi.moves.v1", JSON.stringify(["dash", "glider", "teleport", 3]));
    expect([...readUnlocks(store)]).toEqual(["glider"]);
    expect(readUnlocks(null).size).toBe(0);
  });
});
