import { describe, expect, it } from "vitest";
import { steadyStance } from "./VolleyHud";

describe("the action bar's row (no flicker on a jump)", () => {
  it("swaps to the air row only after a moment aloft, and back only after a moment on the sand", () => {
    expect(steadyStance("ground", "air", 0.01)).toBe("ground");
    expect(steadyStance("ground", "air", 0.05)).toBe("air");
    expect(steadyStance("air", "ground", 0.05)).toBe("air");
    expect(steadyStance("air", "ground", 0.1)).toBe("ground");
  });
  it("keeps the last row up between points, and follows the serve at once", () => {
    expect(steadyStance("ground", "idle", 0)).toBe("ground");
    expect(steadyStance("ground", "serve", 0)).toBe("serve");
  });
});
