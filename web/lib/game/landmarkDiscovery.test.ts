import { describe, expect, it, vi } from "vitest";
import { createLandmarkDiscovery, DISCOVERY_KEY, LANDMARKS } from "./landmarkDiscovery";

describe("existing landmark discoveries", () => {
  const oracle = LANDMARKS.find((zone) => zone.key === "oracle")!;

  it("reads once and only announces each visited landmark once", () => {
    const storage = { getItem: vi.fn(() => "[]"), setItem: vi.fn() };
    const discover = createLandmarkDiscovery(storage, new Set());
    expect(discover(0, 0)).toBeUndefined();
    expect(discover(oracle.x, oracle.z)).toEqual(oracle);
    for (let i = 0; i < 20; i++) expect(discover(oracle.x, oracle.z)).toBeUndefined();
    expect(storage.getItem).toHaveBeenCalledOnce();
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(DISCOVERY_KEY, '["oracle"]');
  });

  it("honors saved discoveries and filters unknown or malformed keys", () => {
    const storage = { getItem: () => '["oracle", "oracle", "unknown", 5, null]', setItem: vi.fn() };
    const discover = createLandmarkDiscovery(storage, new Set());
    expect(discover(oracle.x, oracle.z)).toBeUndefined();
    discover(LANDMARKS[0].x, LANDMARKS[0].z);
    expect(storage.setItem).toHaveBeenCalledWith(DISCOVERY_KEY, '["oracle","cove"]');
  });

  it.each(['"oracle"', '{}', '{broken', 'null'])("recovers from invalid saved shape %s", (saved) => {
    const discover = createLandmarkDiscovery({ getItem: () => saved, setItem: vi.fn() }, new Set());
    expect(discover(oracle.x, oracle.z)).toEqual(oracle);
  });

  it("retains discoveries across map remounts when reads and writes throw", () => {
    const storage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    const session = new Set<string>();
    expect(createLandmarkDiscovery(storage, session)(oracle.x, oracle.z)).toEqual(oracle);
    expect(createLandmarkDiscovery(storage, session)(oracle.x, oracle.z)).toBeUndefined();
  });

  it("supports a visit with no storage and excludes the original radius boundary", () => {
    const discover = createLandmarkDiscovery(undefined, new Set());
    expect(discover(oracle.x + oracle.r, oracle.z)).toBeUndefined();
    expect(discover(oracle.x + oracle.r - 0.01, oracle.z)).toEqual(oracle);
  });

  it("ignores invalid coordinates without consuming a discovery", () => {
    const discover = createLandmarkDiscovery(undefined, new Set());
    expect(discover(NaN, oracle.z)).toBeUndefined();
    expect(discover(oracle.x, Infinity)).toBeUndefined();
    expect(discover(oracle.x, oracle.z)).toEqual(oracle);
  });
});
