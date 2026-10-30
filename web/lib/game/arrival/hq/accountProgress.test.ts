import { describe, expect, it } from "vitest";
import { mergeProgress, readProgress, writeProgress } from "./accountProgress";

describe("the HQ visit's progress on the account (t-hq)", () => {
  it("reads nothing from preferences that hold none, or hold junk", () => {
    expect(readProgress({})).toEqual({ hq: null, tools: {} });
    expect(readProgress(null)).toEqual({ hq: null, tools: {} });
    expect(readProgress({ onboarding: { hq: { beat: 999 }, tools: { axe: "done", net: "maybe" } } })).toEqual({ hq: null, tools: {} });
  });

  it("writes beside the other preferences and keeps only the further along", () => {
    const prefs = { theme: "dusk" };
    const one = writeProgress(prefs, { hq: { beat: 3, done: false }, tools: { net: "given" } })!;
    expect(one).toEqual({ theme: "dusk", onboarding: { hq: { beat: 3, done: false }, tools: { net: "given" } } });
    // An older device writing an earlier beat, or a quest back to given, moves nothing back.
    const two = writeProgress(one, { hq: { beat: 1, done: false }, tools: { net: "given", shovel: "given" } })!;
    expect(readProgress(two)).toEqual({ hq: { beat: 3, done: false }, tools: { net: "given", shovel: "given" } });
    expect(readProgress(writeProgress(two, { hq: { beat: 0, done: true } }))).toMatchObject({ hq: { done: true } });
  });

  it("refuses what isn't progress", () => {
    expect(writeProgress({}, {})).toBeNull();
    expect(writeProgress({}, "x")).toBeNull();
    expect(writeProgress({}, { hq: { beat: -1, done: false } })).toBeNull();
    expect(writeProgress({}, { hq: { beat: 1.5, done: false } })).toBeNull();
  });

  it("merges two devices: the visit further along, each quest at its furthest", () => {
    expect(mergeProgress({ hq: { beat: 2, done: false }, tools: { net: "done" } }, { hq: { beat: 4, done: false }, tools: { net: "given", shovel: "given" } }))
      .toEqual({ hq: { beat: 4, done: false }, tools: { net: "done", shovel: "given" } });
    expect(mergeProgress({ hq: { beat: 7, done: true }, tools: {} }, { hq: null, tools: {} }).hq).toEqual({ beat: 7, done: true });
  });
});
