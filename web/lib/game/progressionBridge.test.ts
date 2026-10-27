import { describe, expect, it } from "vitest";
import { ceremonyDue, chapterOneActions, markCeremonySeen, readSeenCeremonies, resolveAnchor } from "./progressionBridge";

// The monument's build stage is the server's (goals.monumentStage, tested in lib/progression/goals.test.ts).
describe("progression world bridge", () => {
  it("resolves every objective anchor to village ground", () => {
    for (const anchor of ["hq", "monument", "fishing_spot", "museum", "oracle", "ruins_gate", "wharf", "beach", "plaza", "bugs", "rocks", "dig_spots"] as const) {
      const xz = resolveAnchor(anchor);
      expect(xz, anchor).not.toBeNull();
      expect(Math.hypot(xz![0] / 24, xz![1] / 20), anchor).toBeLessThan(1.05);
    }
  });
  it("offers claiming the plot at HQ only while the drop has it; a new member is fresh", () => {
    const chapter = (status: string, keys: string[], done: string[]) => [{ slug: "settle-in", status, steps: keys.map(key => ({ key, done: done.includes(key) })) }];
    const all = ["claim_plot", "first_catch", "donate_catch"];
    expect(chapterOneActions(chapter("active", all, []))).toEqual({ claim: true, fresh: true });
    expect(chapterOneActions(chapter("active", all, ["claim_plot"]))).toEqual({ claim: false, fresh: false });
    expect(chapterOneActions(chapter("active", all.slice(1), ["first_catch"]))).toEqual({ claim: false, fresh: true });
    expect(chapterOneActions([])).toEqual({ claim: false, fresh: false });
  });
  it("plays each goal's ceremony once unless forced", () => {
    const saved = new Map<string, string>();
    const storage = { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => { saved.set(k, v); } };
    const done = { id: "cafe" as const, label: "", progress: 1, completed: true };
    expect(ceremonyDue(done, readSeenCeremonies(storage))).toBe(true);
    markCeremonySeen("cafe", storage);
    expect(ceremonyDue(done, readSeenCeremonies(storage))).toBe(false);
    expect(ceremonyDue(done, readSeenCeremonies(storage), true)).toBe(true);
    expect(ceremonyDue({ ...done, id: "museum" }, readSeenCeremonies(storage))).toBe(true);
    expect(ceremonyDue({ ...done, completed: false }, [])).toBe(false);
    expect(readSeenCeremonies({ getItem: () => "{bad json" })).toEqual([]);
  });
});
