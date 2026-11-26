import { describe, expect, it } from "vitest";
import { heldCatchLength } from "./fishing";

describe("heldCatchLength", () => {
  it("keeps commons as they were (0.5 to 1.1 m on the 1.36 m body)", () => {
    expect(heldCatchLength(12, "common")).toBeCloseTo(0.45 + 0.05 * Math.sqrt(12));
    expect(heldCatchLength(1, "common")).toBe(0.5);
    expect(heldCatchLength(400, "uncommon")).toBe(1.1);
  });
  it("holds an epic up as a trophy: a 160 cm Muskellunge is well over twice a Common Shiner", () => {
    expect(heldCatchLength(160, "epic")).toBeGreaterThan(2.4 * heldCatchLength(12, "common"));
    expect(heldCatchLength(400, "epic")).toBe(1.9);
  });
  it("scales with the body (the 2 m body holds it 2/1.36 as long)", () => {
    expect(heldCatchLength(160, "epic", 2)).toBeCloseTo(heldCatchLength(160, "epic") * 2 / 1.36);
  });
});
