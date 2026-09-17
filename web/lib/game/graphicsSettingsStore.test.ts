import { describe, expect, it, vi } from "vitest";
import { automaticGraphics, createGraphicsSettingsStore, GRAPHICS_KEYS } from "./graphicsSettingsStore";

function fixture(memory = 8) {
  const saved = new Map<string, string>();
  const events = new EventTarget();
  const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); }, removeItem: (key: string) => { saved.delete(key); } };
  const store = createGraphicsSettingsStore({ storage: () => storage, memory: () => memory, events: () => events });
  const external = (key: string | null) => events.dispatchEvent(Object.assign(new Event("storage"), { key }));
  return { saved, events, storage, store, external };
}

describe("shared graphics settings", () => {
  it("notifies every consumer immediately and keeps unchanged snapshots stable", () => {
    const { store, saved } = fixture(); const world = vi.fn(); const panel = vi.fn();
    const stopWorld = store.subscribe(world); const stopPanel = store.subscribe(panel);
    const initial = store.getSnapshot();
    expect(store.getSnapshot()).toBe(initial);
    store.set("pixelated", false);
    expect(store.getSnapshot().pixelated).toBe(false);
    expect(saved.get(GRAPHICS_KEYS.pixelated)).toBe("false");
    expect(world).toHaveBeenCalledTimes(1); expect(panel).toHaveBeenCalledTimes(1);
    store.set("pixelated", false);
    expect(world).toHaveBeenCalledTimes(1);
    stopWorld(); store.set("liteMode", true);
    expect(world).toHaveBeenCalledTimes(1); expect(panel).toHaveBeenCalledTimes(2);
    stopPanel();
  });
  it("reads existing keys without overwriting them and ignores malformed boolean values", () => {
    const { store, saved } = fixture(4);
    saved.set(GRAPHICS_KEYS.liteMode, "false"); saved.set(GRAPHICS_KEYS.bloom, "true"); saved.set(GRAPHICS_KEYS.pixelated, "garbage");
    expect(store.getSnapshot()).toEqual({ liteMode: false, bloom: true, shadows: false, ghostsEnabled: true, pixelated: true });
    expect(saved.size).toBe(3);
  });
  it("handles updates and clear events from another tab, ignoring unrelated keys", () => {
    const { store, saved, external } = fixture(); const changed = vi.fn(); const stop = store.subscribe(changed);
    saved.set(GRAPHICS_KEYS.ghostsEnabled, "false"); external("other");
    expect(changed).not.toHaveBeenCalled();
    external(GRAPHICS_KEYS.ghostsEnabled); expect(store.getSnapshot().ghostsEnabled).toBe(false);
    saved.clear(); external(null); expect(store.getSnapshot().ghostsEnabled).toBe(true);
    expect(changed).toHaveBeenCalledTimes(2); stop();
  });
  it("refreshes on remount after changes while there were no subscribers", () => {
    const { store, saved } = fixture(); const stop = store.subscribe(() => {}); stop();
    saved.set(GRAPHICS_KEYS.pixelated, "false");
    const nextStop = store.subscribe(() => {}); expect(store.getSnapshot().pixelated).toBe(false); nextStop();
  });
  it("preserves current-session changes when writes are blocked", () => {
    const { store, storage, external } = fixture();
    storage.setItem = () => { throw new Error("quota"); };
    const stop = store.subscribe(() => {});
    store.set("pixelated", false); external(null);
    expect(store.getSnapshot().pixelated).toBe(false);
    stop(); const stopAgain = store.subscribe(() => {}); expect(store.getSnapshot().pixelated).toBe(false); stopAgain();
  });
  it("uses defaults when storage access fails, while reset still updates all consumers", () => {
    const events = new EventTarget();
    const store = createGraphicsSettingsStore({ storage: () => { throw new Error("blocked"); }, memory: () => 4, events: () => events });
    const changed = vi.fn(); const stop = store.subscribe(changed);
    store.set("liteMode", false); store.set("bloom", true); store.reset();
    expect(store.getSnapshot()).toEqual(automaticGraphics(4)); expect(changed).toHaveBeenCalledTimes(3); stop();
  });
  it("reset removes only graphics keys and restores device defaults", () => {
    const { store, saved } = fixture(4);
    saved.set("authored-map", "keep"); store.set("bloom", true); store.set("pixelated", false); store.reset();
    expect(store.getSnapshot()).toEqual(automaticGraphics(4)); expect([...saved.entries()]).toEqual([["authored-map", "keep"]]);
  });
  it("has a stable server snapshot independent of local settings", () => {
    const { store } = fixture(4); const server = store.getServerSnapshot();
    store.set("pixelated", false);
    expect(store.getServerSnapshot()).toBe(server); expect(server).toEqual(automaticGraphics(8));
  });
  it("attaches one storage listener and removes it after the last consumer", () => {
    const { store, events } = fixture(); const add = vi.spyOn(events, "addEventListener"); const remove = vi.spyOn(events, "removeEventListener");
    const one = store.subscribe(() => {}); const two = store.subscribe(() => {});
    expect(add).toHaveBeenCalledTimes(1); one(); expect(remove).not.toHaveBeenCalled(); two(); expect(remove).toHaveBeenCalledTimes(1);
  });
  it("only selects automatic lite mode for valid low-memory values", () => {
    for (const value of [undefined, NaN, Infinity, -1, 0, 8]) expect(automaticGraphics(value).liteMode).toBe(false);
    for (const value of [0.5, 2, 4]) expect(automaticGraphics(value).liteMode).toBe(true);
  });
});
