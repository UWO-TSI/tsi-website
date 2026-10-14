import { describe, expect, it } from "vitest";
import { LOCKED_MOVES, moveUnlocked, readUnlocks, unlockMove } from "./moveUnlocks";

function memory() {
  const map = new Map<string, string>();
  return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
}

describe("moves a Keeper teaches", () => {
  it("are the dash and the glider", () => {
    expect([...LOCKED_MOVES].sort()).toEqual(["dash", "glider"]);
  });
  it("stay locked in the shipped game until taught", () => {
    const store = memory();
    expect(moveUnlocked("dash", { dev: false, unlocked: readUnlocks(store) })).toBe(false);
    expect(moveUnlocked("glider", { dev: false, unlocked: readUnlocks(store) })).toBe(false);
    unlockMove("dash", store);
    expect(moveUnlocked("dash", { dev: false, unlocked: readUnlocks(store) })).toBe(true);
    expect(moveUnlocked("glider", { dev: false, unlocked: readUnlocks(store) })).toBe(false);
  });
  it("are all unlocked in development, unless the dev asks to see them locked", () => {
    const none = readUnlocks(memory());
    expect(moveUnlocked("dash", { dev: true, unlocked: none })).toBe(true);
    expect(moveUnlocked("glider", { dev: true, unlocked: none })).toBe(true);
    expect(moveUnlocked("glider", { dev: true, unlocked: none, devLocked: true })).toBe(false);
  });
  it("read nothing odd from storage", () => {
    const store = memory();
    store.setItem("tsi.moves.v1", "{nope");
    expect(readUnlocks(store).size).toBe(0);
    store.setItem("tsi.moves.v1", JSON.stringify(["dash", "teleport", 3]));
    expect([...readUnlocks(store)]).toEqual(["dash"]);
    expect(readUnlocks(null).size).toBe(0);
    unlockMove("dash", store);
    expect(JSON.parse(store.map.get("tsi.moves.v1")!)).toEqual(["dash"]);
  });
});
