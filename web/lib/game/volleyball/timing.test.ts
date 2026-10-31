import { describe, expect, it } from "vitest";
import { grade, judgeServe, meterPower, serveError, touchQuality } from "./timing";

describe("the power bar", () => {
  it("rises, peaks and falls like the fishing cast meter, quicker each pass", () => {
    expect(meterPower(0)).toBe(0);
    expect(meterPower(0.7)).toBeCloseTo(1, 5);
    expect(meterPower(1.4)).toBeCloseTo(0, 5);
    // the second pass is 15% quicker: its peak comes at 1.4 + 0.7 / 1.15
    expect(meterPower(1.4 + 0.7 / 1.15)).toBeCloseTo(1, 5);
  });
});

describe("the serve's timing circle", () => {
  it("judges early, on time, perfect and late", () => {
    expect(judgeServe(-0.2)).toBe("early");
    expect(judgeServe(-0.06)).toBe("good");
    expect(judgeServe(0.01)).toBe("perfect");
    expect(judgeServe(0.15)).toBe("late");
  });
  it("measures the click against the ball falling through the hand", () => {
    expect(serveError(3, 0, 2, 13)).toBeCloseTo(-Math.sqrt(2 / 13), 5); // a second fall to come: early
    expect(serveError(1.9, -4, 2, 13)).toBeCloseTo(0.025, 5); // just past: a touch late
  });
});

describe("touch quality", () => {
  it("is best dead on and falls off with timing and distance", () => {
    expect(grade(touchQuality(0, 0, 1))).toBe("perfect");
    expect(grade(touchQuality(0.08, 0.4, 1))).toBe("good");
    expect(grade(touchQuality(0.2, 0.9, 1))).toBe("poor");
  });
});
