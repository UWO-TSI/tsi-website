import { describe, expect, it } from "vitest";
import { DONATE_FADE_MS, donatedAt, fadeInto, markDonated } from "./museumMoment";

describe("a donation settling into its case", () => {
  it("fades the specimen in from nothing, growing into place with a little settle, never popping", () => {
    expect(fadeInto(0)).toMatchObject({ opacity: 0 });
    let prev = 0;
    for (let t = 0; t <= DONATE_FADE_MS; t += 25) { const f = fadeInto(t); expect(f.opacity).toBeGreaterThanOrEqual(prev - 1e-9); prev = f.opacity; }
    expect(fadeInto(DONATE_FADE_MS)).toEqual({ opacity: 1, scale: 1, rise: 0 });
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => fadeInto(i * 30).scale))).toBeGreaterThan(1);
  });

  it("is finished, solid and still, for a specimen that was always there", () => {
    expect(fadeInto(Infinity)).toEqual({ opacity: 1, scale: 1, rise: 0 });
  });

  it("remembers what was just donated, by species, for its case to find", () => {
    expect(donatedAt("fish_dace")).toBeNull();
    markDonated("fish_dace", 1234);
    expect(donatedAt("fish_dace")).toBe(1234);
  });
});
