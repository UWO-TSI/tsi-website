import { describe, expect, it } from "vitest";
import { CAFE_DOOR, CAFE_EXIT_RANGE, CAFE_SPAWN } from "./cafe";
import { studySolid } from "@/lib/study/seats";

describe("café prompts (cafe-polish §2)", () => {
  it("arrives a step inside, clear of furniture and outside the exit prompt", () => {
    expect(Math.hypot(CAFE_SPAWN[0] - CAFE_DOOR[0], CAFE_SPAWN[1] - CAFE_DOOR[1])).toBeGreaterThan(CAFE_EXIT_RANGE);
    expect(studySolid("cafe", ...CAFE_SPAWN, 0.4)).toBe(false);
  });
});
