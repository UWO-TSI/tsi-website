import { describe, expect, it } from "vitest";
import { medianFrameMs, tierForFrameMs } from "./qualityTier";

describe("quality tier probe", () => {
  it("uses the median so a shader-compile hitch does not demote a fast device", () => {
    expect(medianFrameMs([16, 17, 16, 400, 16])).toBe(16);
    expect(medianFrameMs([10, 20])).toBe(15);
    expect(medianFrameMs([])).toBe(0);
  });
  it("picks Light below ~40 FPS and High otherwise", () => {
    expect(tierForFrameMs(16.7)).toBe("high");
    expect(tierForFrameMs(25)).toBe("high");
    expect(tierForFrameMs(33)).toBe("light");
  });
});
