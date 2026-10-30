import { readFileSync } from "node:fs";
import { act, createElement, useEffect } from "react";
import { reconciler } from "@react-three/fiber";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The fishing events the tutorial's first-catch chip listens for (game/tutorial-v2 arrival/FirstCatchTeach.tsx):
 * tsi:fish-hooked as the reel starts, then tsi:fish-caught or tsi:fish-escaped, and tsi:fish-end. MemberFishing's
 * rules are lib/game/useFishingSession (it adds only the look), so the session is driven here on a renderer with no
 * DOM (R3F's reconciler, nothing drawn) and a bare window: a cast, the bite, the hook, the reel's end.
 */
const win = Object.assign(new EventTarget(), {
  setTimeout: (f: () => void, ms?: number) => setTimeout(f, ms),
  clearTimeout: (t: number) => clearTimeout(t),
  matchMedia: () => ({ matches: true }),
  innerWidth: 1280, innerHeight: 800, location: { search: "", pathname: "/" },
});
const doc = Object.assign(new EventTarget(), { activeElement: null, hidden: false, querySelector: () => null });
const heard: string[] = [];
const EVENTS = ["tsi:fish-hooked", "tsi:fish-caught", "tsi:fish-escaped", "tsi:fish-end"];

type Session = ReturnType<typeof import("@/lib/game/useFishingSession").useFishingSession>;
const live = {} as { s: Session };

beforeAll(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  vi.stubGlobal("fetch", () => Promise.resolve({ ok: false, json: () => Promise.resolve(null) }));
  EVENTS.forEach(n => win.addEventListener(n, () => heard.push(n)));
});
afterAll(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

async function mount() {
  const { useFishingSession } = await import("@/lib/game/useFishingSession");
  function Probe() { const s = useFishingSession({ collectionScope: "test" }); useEffect(() => { live.s = s; }); return null; }
  const create = reconciler.createContainer as (...a: unknown[]) => ReturnType<typeof reconciler.createContainer>;
  const err = () => {};
  const root = create({}, 1, null, false, null, "", err, err, err, null);
  await act(async () => { reconciler.updateContainer(createElement(Probe), root, null, null); });
}
const step = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
/** A cast to the bite and the hook (E): the reel is up. */
async function hookOne() {
  await act(async () => { win.dispatchEvent(new CustomEvent("tsi:fish-start", { detail: { x: 0, z: 0 } })); });
  expect(live.s.phase).toBe("charging");
  await act(async () => { live.s.castNow(0.5); });
  for (let t = 0; t < 20000 && live.s.phase !== "bite"; t += 100) await step(100);
  expect(live.s.phase).toBe("bite");
  await act(async () => { win.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "e" })); });
  expect(live.s.phase).toBe("reeling");
}

describe("MemberFishing's fishing events (the tutorial's first-catch chip)", () => {
  it("says hooked as the reel starts, caught when it's landed, and end when the card closes", async () => {
    await mount();
    await hookOne();
    expect(heard).toEqual(["tsi:fish-hooked"]);
    await act(async () => { live.s.onReelDone(true); });
    expect(heard.at(-1)).toBe("tsi:fish-caught");
    await act(async () => { live.s.cancel(); });
    expect(heard.at(-1)).toBe("tsi:fish-end");
  });
  it("says escaped when the fish gets away, then end", async () => {
    heard.length = 0;
    await hookOne();
    await act(async () => { live.s.onReelDone(false); });
    expect(heard).toEqual(["tsi:fish-hooked", "tsi:fish-escaped"]);
    await step(2000);
    expect(heard.at(-1)).toBe("tsi:fish-end");
  });
  it("draws the reel as the panel the chip sits over, from the shared reel (createFishingReel: the reel assist's floor)", () => {
    const src = readFileSync(new URL("./MemberFishing.tsx", import.meta.url), "utf8");
    expect(src).toContain("useFishingSession(");
    expect(src).toContain('aria-label="Fishing reel"');
    expect(readFileSync(new URL("../../../lib/game/useReelLoop.ts", import.meta.url), "utf8")).toMatch(/createFishingReel\(fish, boss, undefined, rig\?\.barMul\)/);
  });
});
