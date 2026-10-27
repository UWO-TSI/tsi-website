import { describe, expect, it } from "vitest";
import { loadTotal } from "./loadProgress";

describe("the loading screen's progress", () => {
  it("weighs the four parts to 1 when all are done, and clamps each part", () => {
    expect(loadTotal({ code: 0, world: 0, files: 0, warm: 0 })).toBe(0);
    expect(loadTotal({ code: 1, world: 1, files: 1, warm: 1 })).toBeCloseTo(1);
    expect(loadTotal({ code: 2, world: -1, files: 0, warm: 0 })).toBeCloseTo(loadTotal({ code: 1, world: 0, files: 0, warm: 0 }));
  });
});
