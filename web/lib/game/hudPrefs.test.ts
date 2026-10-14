import { describe, expect, it } from "vitest";
import { compactTouchHud, fullHud } from "./hudPrefs";

describe("the minimal HUD (row 283, playtest round 1)", () => {
  const playing = { always: false, keyHeld: false, uiView: false };
  it("is minimal while you play, whatever holds the mouse", () => {
    expect(fullHud(playing)).toBe(false);
  });
  it("is full in the UI view (Esc 1), while its key is held, or always by the setting", () => {
    expect(fullHud({ ...playing, uiView: true })).toBe(true);
    expect(fullHud({ ...playing, keyHeld: true })).toBe(true);
    expect(fullHud({ ...playing, always: true })).toBe(true);
  });
  it("stands back in a cinematic moment (talking, the greeting, the boat trip), whatever else holds it open", () => {
    expect(fullHud({ ...playing, uiView: true, cinematic: true })).toBe(false);
    expect(fullHud({ always: true, keyHeld: true, uiView: true, cinematic: true })).toBe(false);
    expect(fullHud({ ...playing, uiView: true, cinematic: false })).toBe(true);
  });
});

describe("the phone HUD (world audit item 11)", () => {
  it("folds on a touch screen unless the setting asks for the full HUD", () => {
    expect(compactTouchHud({ touch: true, always: false })).toBe(true);
    expect(compactTouchHud({ touch: true, always: true })).toBe(false);
    expect(compactTouchHud({ touch: false, always: false })).toBe(false);
  });
});
