import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_WRITE, announceWrite } from "@/lib/apiClient";

type Sent = { session: string; events: { kind: string; step?: string; screen?: string; ago: number }[] };
let posts: Sent[];
let beacons: Sent[];
let status: number;
let track: typeof import("./track");

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  posts = []; beacons = []; status = 200;
  const win = new EventTarget(), doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  vi.stubGlobal("navigator", { sendBeacon: (_: string, b: Blob) => { void b.text().then((t) => beacons.push(JSON.parse(t))); return true; } });
  vi.stubGlobal("fetch", vi.fn(async (_: string, init: RequestInit) => { posts.push(JSON.parse(String(init.body))); return { status }; }));
  track = await import("./track");
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("the event log's tab side", () => {
  it("sends nothing until the member island starts a session (the applicant island never does)", async () => {
    track.trackStep("creator");
    track.trackFeature("fishing");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(posts).toEqual([]);
  });

  it("batches: steps queue and go out together after the flush delay, not one request each", async () => {
    track.startSession();
    track.trackStep("arrival_aboard");
    track.trackStep("creator");
    track.trackStep("creator"); // once a session
    track.trackStep("not_a_step"); // not on the list: dropped
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(posts).toHaveLength(1);
    expect(posts[0].events.map((e) => e.step ?? e.kind)).toEqual(["session_start", "arrival_aboard", "creator"]);
    expect(posts[0].session).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("an event's age rides along, so the server dates it when it happened", async () => {
    track.startSession();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(posts[0].events[0].ago).toBe(15_000);
  });

  it("a heartbeat every few minutes while the tab shows, none while hidden", async () => {
    track.startSession();
    await vi.advanceTimersByTimeAsync(track.HEARTBEAT_MS);
    const beats = () => posts.flatMap((p) => p.events).filter((e) => e.kind === "heartbeat").length;
    expect(beats()).toBe(1);
    (document as unknown as { visibilityState: string }).visibilityState = "hidden";
    await vi.advanceTimersByTimeAsync(track.HEARTBEAT_MS * 3);
    expect(beats()).toBe(1);
  });

  it("the end goes in a beacon on pagehide, with the screen the player was on", async () => {
    track.startSession();
    track.setScreen("museum");
    window.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(0);
    const end = beacons.flatMap((b) => b.events).find((e) => e.kind === "session_end");
    expect(end?.screen).toBe("museum");
  });

  it("a feature's first use comes from the writes the routes already announce", async () => {
    track.startSession();
    announceWrite("/api/economy/sell", {});
    announceWrite("/api/economy/sell", {});
    announceWrite("/api/identity/name", {}); // not a feature
    window.dispatchEvent(new CustomEvent(API_WRITE, { detail: {} }));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(posts[0].events.filter((e) => e.kind === "feature").map((e) => e.step)).toEqual(["selling"]);
  });

  it("stops for good once the route says no (signed out, or no table yet)", async () => {
    status = 401;
    track.startSession();
    await vi.advanceTimersByTimeAsync(15_000);
    track.trackStep("creator");
    await vi.advanceTimersByTimeAsync(track.HEARTBEAT_MS * 2);
    expect(posts).toHaveLength(1);
  });
});
