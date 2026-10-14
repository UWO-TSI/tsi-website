import { describe, expect, it } from "vitest";
import { WARMUP_FRAMES, escapeAction, warmedUp, warmupFrame } from "./sceneGate";

describe("doors wait for the room (interiors deliverable 5)", () => {
  it("lifts the fade only after the room has loaded and rendered a few frames", () => {
    let frames = 0;
    for (let i = 0; i < 40; i++) frames = warmupFrame(frames, false, false);   // still loading: the fade holds
    expect(warmedUp(frames)).toBe(false);
    for (let i = 0; i < WARMUP_FRAMES - 1; i++) frames = warmupFrame(frames, true, false);
    expect(warmedUp(frames)).toBe(false);
    frames = warmupFrame(frames, true, false);
    expect(warmedUp(frames)).toBe(true);
  });

  it("starts the count again when a late model starts loading, and never traps you past the time-out", () => {
    let frames = 0;
    for (let i = 0; i < WARMUP_FRAMES - 2; i++) frames = warmupFrame(frames, true, false);
    frames = warmupFrame(frames, false, false);
    expect(frames).toBe(0);
    for (let i = 0; i < WARMUP_FRAMES; i++) frames = warmupFrame(frames, false, true);
    expect(warmedUp(frames)).toBe(true);
  });
});

describe("Escape steps to the next Esc layer once nothing else is open (playtest round 1, decision 3)", () => {
  const base = { captureEnded: false, locked: false, fading: false, open: false };
  it("closes what's open first, then steps on, indoors and out (a room is left by its door)", () => {
    expect(escapeAction({ ...base, open: true })).toBe("close");
    expect(escapeAction(base)).toBe("layer");
  });
  it("does nothing mid-fade, or when the browser's Escape just ended mouse-look (that opened the UI view already)", () => {
    expect(escapeAction({ ...base, fading: true })).toBe("none");
    expect(escapeAction({ ...base, captureEnded: true })).toBe("none");
    expect(escapeAction({ ...base, captureEnded: true, open: true })).toBe("none");
  });
  it("steps on when an Escape reaches the page with the mouse still held (fullscreen with the keyboard locked)", () => {
    expect(escapeAction({ ...base, captureEnded: true, locked: true })).toBe("layer");
    expect(escapeAction({ ...base, locked: true, fading: true })).toBe("none");
  });
});
