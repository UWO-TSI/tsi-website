import { describe, expect, it } from "vitest";
import { markWelcomed, readWelcomed, welcomeStep } from "./welcome";

const base = { lookLoaded: true, lookSaved: true, signedIn: true, progressionLoaded: true, chapterFresh: true, welcomed: false };

describe("first-login sequence", () => {
  it("dresses a new member first, then arrives and greets them", () => {
    expect(welcomeStep({ ...base, lookLoaded: false })).toBe("wait");
    expect(welcomeStep({ ...base, lookSaved: false })).toBe("creator");
    expect(welcomeStep(base)).toBe("welcome");
  });
  it("greets a carried-over look too, but only before chapter 1 starts and once per device", () => {
    expect(welcomeStep({ ...base, progressionLoaded: false })).toBe("wait");
    expect(welcomeStep({ ...base, chapterFresh: false })).toBe("none");
    expect(welcomeStep({ ...base, welcomed: true })).toBe("none");
  });
  it("skips signed-out benches", () => {
    expect(welcomeStep({ ...base, signedIn: false })).toBe("none");
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
