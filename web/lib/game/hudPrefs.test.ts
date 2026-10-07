import { describe, expect, it } from "vitest";
import { fullHud } from "./hudPrefs";

describe("the clean HUD (row 283)", () => {
  const exploring = { always: false, keyHeld: false, touch: false, capture: "captured" as const };
  it("is clean while exploring with mouse-look", () => {
    expect(fullHud(exploring)).toBe(false);
  });
  it("shows in full while its key is held, in the pause view, on touch, or always by the setting", () => {
    expect(fullHud({ ...exploring, keyHeld: true })).toBe(true);
    for (const capture of ["free", "menu", "cursor", "off"] as const) expect(fullHud({ ...exploring, capture })).toBe(true);
    expect(fullHud({ ...exploring, touch: true })).toBe(true);
    expect(fullHud({ ...exploring, always: true })).toBe(true);
  });
  it("stands back in a cinematic moment (talking, the greeting, the boat trip), whatever else holds it open", () => {
    expect(fullHud({ ...exploring, capture: "free", cinematic: true })).toBe(false);
    expect(fullHud({ ...exploring, always: true, keyHeld: true, touch: true, capture: "off", cinematic: true })).toBe(false);
    expect(fullHud({ ...exploring, capture: "free", cinematic: false })).toBe(true);
  });
});
