import { act, createElement } from "react";
import { reconciler } from "@react-three/fiber";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AREAS, type Area, type RosterEntry } from "./protocol";
import type { NetSource, NetStatus } from "./types";
import { LEAVE_DELAY_MS, botsFromSearch, loopbackStore, netMode, refCounted, resetNetStore, useNetSource, useNetStatus, useRoster } from "./netStore";
import { createLoopback } from "./loopback";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Render on R3F's reconciler (no DOM), as lib/game/ruinsHand.test.tsx does. */
function mount(el: ReturnType<typeof createElement>) {
  const errors: unknown[] = [], err = (e: unknown) => { errors.push(e); };
  const create = reconciler.createContainer as (...a: unknown[]) => ReturnType<typeof reconciler.createContainer>;
  const root = create({}, 1, null, false, null, "", err, err, err, null);
  return {
    errors,
    render: (next: ReturnType<typeof createElement>) => act(async () => { reconciler.updateContainer(next, root, null, null); }),
    first: () => act(async () => { reconciler.updateContainer(el, root, null, null); }),
    unmount: () => act(async () => { reconciler.updateContainer(null, root, null, null); }),
  };
}
const withSearch = (search: string) => { (globalThis as { window?: unknown }).window = { location: { search } }; };

afterEach(() => {
  resetNetStore();
  delete (globalThis as { window?: unknown }).window;
  vi.useRealTimers();
});

describe("which source a page gets", () => {
  it("?bots=N in development gives the loopback; production and plain pages get nothing", () => {
    expect(netMode("?bots=12", true)).toEqual({ kind: "bots", bots: 12, seed: 1 });
    expect(netMode("?bots=12&seed=4", true)).toEqual({ kind: "bots", bots: 12, seed: 4 });
    expect(netMode("?bots=12", false)).toBeNull();
    expect(netMode("", true)).toBeNull();
    expect(botsFromSearch("?bots=65")).toBeNull();
  });
});

describe("acquire and release", () => {
  it("starts once, survives Strict Mode's remount and a scene swap, stops LEAVE_DELAY_MS after the last release", () => {
    vi.useFakeTimers();
    const log: string[] = [];
    const life = refCounted(() => log.push("start"), () => log.push("stop"));
    life.acquire(); life.release(); life.acquire(); // Strict Mode: mount, unmount, mount
    expect(log).toEqual(["start"]);
    life.acquire(); // a second user
    life.release();
    vi.advanceTimersByTime(LEAVE_DELAY_MS * 2);
    expect(log).toEqual(["start"]);
    life.release(); // the last
    vi.advanceTimersByTime(LEAVE_DELAY_MS - 1);
    expect(log).toEqual(["start"]);
    life.acquire(); // back inside the delay (a door's scene swap)
    vi.advanceTimersByTime(LEAVE_DELAY_MS * 2);
    expect(log).toEqual(["start"]);
    life.release();
    vi.advanceTimersByTime(LEAVE_DELAY_MS);
    expect(log).toEqual(["start", "stop"]);
    life.release(); // an extra release changes nothing
    expect(life.refs).toBe(0);
    life.acquire();
    expect(log).toEqual(["start", "stop", "start"]);
  });
  it("the loopback store joins with the latest area and follows it", () => {
    vi.useFakeTimers();
    const lb = createLoopback({ bots: 3, timer: false, clock: () => 0 }), store = loopbackStore(lb);
    store.setArea("cafe");
    store.acquire();
    const me = () => lb.roster().find(e => e.uid === "local");
    expect(me()?.area).toBe(AREAS.indexOf("cafe"));
    store.setArea("hq");
    expect(me()?.area).toBe(AREAS.indexOf("hq"));
    store.release();
    vi.advanceTimersByTime(LEAVE_DELAY_MS);
    expect(lb.status()).toEqual({ kind: "off" });
    expect(me()).toBeUndefined();
  });
});

describe("useNetSource, useNetStatus, useRoster", () => {
  let seen: { source: NetSource | null; status: NetStatus; roster: readonly RosterEntry[] }[] = [];
  function World({ ready, area = "village" }: { ready: boolean; area?: Area }) {
    const source = useNetSource({ area, ready }), status = useNetStatus(), roster = useRoster();
    seen.push({ source, status, roster });
    return null;
  }
  const last = () => seen[seen.length - 1];

  it("is null and creates nothing without ?bots (or a server)", async () => {
    withSearch("");
    seen = [];
    const m = mount(createElement(World, { ready: true }));
    await m.first();
    expect(last().source).toBeNull();
    expect(last().status).toEqual({ kind: "off" });
    expect(last().roster).toEqual([]);
    await m.unmount();
    expect(m.errors).toEqual([]);
  });

  it("with ?bots=N: the loopback once its code loads, joined while ready, following the area, off after the delay", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    withSearch("?bots=5");
    seen = [];
    const m = mount(createElement(World, { ready: false }));
    await m.first();
    await act(async () => { await vi.dynamicImportSettled(); });
    const source = last().source!;
    expect(source).not.toBeNull();
    expect(last().status).toEqual({ kind: "off" }); // not acquired until ready
    await m.render(createElement(World, { ready: true }));
    expect(last().status).toEqual({ kind: "joined", shard: 1 });
    expect(last().roster.find(e => e.uid === "local")?.area).toBe(AREAS.indexOf("village"));
    await m.render(createElement(World, { ready: true, area: "museum" }));
    expect(last().roster.find(e => e.uid === "local")?.area).toBe(AREAS.indexOf("museum"));
    // Nothing re-renders while bots move: the status and roster snapshots stay the same objects.
    const renders = seen.length;
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(seen.length).toBe(renders);
    await m.unmount();
    expect(source.status()).toEqual({ kind: "joined", shard: 1 });
    await act(async () => { vi.advanceTimersByTime(LEAVE_DELAY_MS); });
    expect(source.status()).toEqual({ kind: "off" });
    expect(m.errors).toEqual([]);
  });

  it("a second mount on the same page gets the same source", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    withSearch("?bots=2");
    seen = [];
    const a = mount(createElement(World, { ready: true }));
    await a.first();
    await act(async () => { await vi.dynamicImportSettled(); });
    const one = last().source;
    const b = mount(createElement(World, { ready: true }));
    await b.first();
    expect(last().source).toBe(one); // already loaded: no null first render
    await a.unmount();
    await b.unmount();
  });
});
