import { describe, expect, it } from "vitest";
import { isSeatedPose, seatPrompt } from "./seatPrompt";

describe("the seat prompt (world audit item 17)", () => {
  it("offers the seat while you stand, and standing up once you sit", () => {
    expect(seatPrompt("Sit on the bench", false)).toBe("Sit on the bench");
    expect(seatPrompt("Sit on the bench", true)).toBe("Stand up");
    expect(seatPrompt("Sleep in your bed", true)).toBe("Stand up");
  });
  it("reads sitting from the held seat clips only", () => {
    for (const pose of ["Sit", "Study", "Stretch", "Sleep"] as const) expect(isSeatedPose(pose)).toBe(true);
    expect(isSeatedPose(null)).toBe(false);
    expect(isSeatedPose(undefined)).toBe(false);
    expect(isSeatedPose("Wave")).toBe(false);
  });
});
