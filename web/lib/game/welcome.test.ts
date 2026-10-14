import { describe, expect, it } from "vitest";
import { markWelcomed, readWelcomed, welcomeStep } from "./welcome";

const base = { lookLoaded: true, lookSaved: false, signedIn: true, progressionLoaded: true, chapterFresh: true, arrived: false as boolean | null };

describe("first-login sequence", () => {
  it("plays the arrival for a new member: the reflection in the water is where they make their look", () => {
    expect(welcomeStep({ ...base, lookLoaded: false })).toBe("wait");
    expect(welcomeStep(base)).toBe("arrival");
    // A hired applicant's look carried over: they still arrive (and see it in the water).
    expect(welcomeStep({ ...base, lookSaved: true })).toBe("arrival");
  });
  it("plays once per account, and only before chapter 1 starts", () => {
    expect(welcomeStep({ ...base, progressionLoaded: false })).toBe("wait");
    expect(welcomeStep({ ...base, arrived: null })).toBe("wait");
    expect(welcomeStep({ ...base, arrived: true, lookSaved: true })).toBe("none");
    expect(welcomeStep({ ...base, chapterFresh: false, lookSaved: true })).toBe("none");
    // Arrived on another device without a look saved here (or a reset): the plain creator.
    expect(welcomeStep({ ...base, arrived: true })).toBe("creator");
  });
  it("skips signed-out benches (the plain creator if they have no look), unless the dev replays it", () => {
    expect(welcomeStep({ ...base, signedIn: false, arrived: null })).toBe("creator");
    expect(welcomeStep({ ...base, signedIn: false, arrived: null, lookSaved: true })).toBe("none");
    expect(welcomeStep({ ...base, signedIn: false, arrived: null, lookSaved: true, replay: true })).toBe("arrival");
    expect(welcomeStep({ ...base, arrived: true, lookSaved: true, replay: true })).toBe("arrival");
    expect(welcomeStep({ ...base, lookLoaded: false, replay: true })).toBe("wait");
  });
  it("remembers the greeting on this device", () => {
    const map = new Map<string, string>();
    const store = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    expect(readWelcomed(store)).toBe(false);
    markWelcomed(store);
    expect(readWelcomed(store)).toBe(true);
    expect(readWelcomed(null)).toBe(false);
  });
});
