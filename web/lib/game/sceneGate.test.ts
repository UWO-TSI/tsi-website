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

describe("Escape leaves a room only when nothing is open (interiors deliverable 5)", () => {
  const base = { captureEnded: false, fading: false, open: false, inside: true };
  it("closes what's open first, then leaves by the door", () => {
    expect(escapeAction({ ...base, open: true })).toBe("close");
    expect(escapeAction(base)).toBe("exit");
  });
  it("does nothing mid-fade or when the browser's Escape just ended mouse-look", () => {
    expect(escapeAction({ ...base, fading: true })).toBe("none");
    expect(escapeAction({ ...base, captureEnded: true })).toBe("none");
  });
  it("outdoors it only ever closes", () => {
    expect(escapeAction({ ...base, inside: false })).toBe("close");
    expect(escapeAction({ ...base, inside: false, open: true })).toBe("close");
  });
});
