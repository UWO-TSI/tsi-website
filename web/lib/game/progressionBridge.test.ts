import { describe, expect, it } from "vitest";
import { ceremonyDue, chapterOneActions, markCeremonySeen, readSeenCeremonies, resolveAnchor } from "./progressionBridge";
import { village } from "./villageMap";

// The monument's build stage is the server's (goals.monumentStage, tested in lib/progression/goals.test.ts).
describe("progression world bridge", () => {
  it("resolves every objective anchor to the member island's land (the new world has no ruins gate yet)", () => {
    const { bounds: b } = village();
    for (const anchor of ["hq", "monument", "fishing_spot", "museum", "oracle", "wharf", "beach", "plaza", "bugs", "rocks", "dig_spots"] as const) {
      const xz = resolveAnchor(anchor);
      expect(xz, anchor).not.toBeNull();
      expect(xz![0] >= b.minX && xz![0] <= b.maxX && xz![1] >= b.minZ && xz![1] <= b.maxZ, anchor).toBe(true);
    }
    expect(resolveAnchor("ruins_gate")).toBeNull();
  });
  it("chapter 1 (first-find) offers the plot claim, then nothing: Juno's talk ends it", () => {
    const chapter = (status: string, done: string[], keys = ["claim_plot", "first_catch", "donate_catch"]) => [{ slug: "first-find", status, steps: keys.map(key => ({ key, done: done.includes(key) })) }];
    expect(chapterOneActions(chapter("active", []))).toEqual({ claim: true, fresh: true });
    expect(chapterOneActions(chapter("active", ["claim_plot"]))).toEqual({ claim: false, fresh: false });
    expect(chapterOneActions(chapter("active", [], ["first_catch", "donate_catch"]))).toEqual({ claim: false, fresh: true }); // v1 hides the plot
    expect(chapterOneActions(chapter("ready", ["first_catch"], ["first_catch", "donate_catch"]))).toEqual({ claim: false, fresh: false });
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
