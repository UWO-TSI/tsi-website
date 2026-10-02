import { describe, expect, it } from "vitest";
import { chargeLevel, chargePotency, createInputState, press, release, tick, type InputKit } from "./input";

/** The Elementalist's grid (keys 1–4 elements, pairs combine) plus a hold, a charge, a toggle and a drawn key. */
const kit: InputKit = {
  inputs: [{ kind: "tap" }, { kind: "tap" }, { kind: "tap" }, { kind: "tap" }, null],
  combos: [[0, 1], [0, 2], [1, 3], [3, 3]],
};
const mixed: InputKit = {
  inputs: [{ kind: "tap" }, { kind: "hold", max_s: 2 }, { kind: "charge", min_s: 0.25, max_s: 1.25 }, { kind: "toggle" }, { kind: "drawn", shape: "circle" }],
  combos: [],
};

describe("the input layer (taps, combos within 0.4 s, holds, charges, toggles, drawn shapes)", () => {
  it("a key outside every combo fires at once", () => {
    expect(press(createInputState(), { ...kit, combos: [] }, 2, 0)).toEqual([{ kind: "tap", slot: 2 }]);
  });
  it("a combo key waits for its partner: two keys within 0.4 s in either order are the combo", () => {
    const s = createInputState();
    expect(press(s, kit, 1, 10)).toEqual([]);
    expect(press(s, kit, 0, 10.3)).toEqual([{ kind: "combo", combo: 0 }]);
    expect(tick(s, kit, 11)).toEqual([]);
    expect(press(s, kit, 0, 20)).toEqual([]);
    expect(press(s, kit, 2, 20.39)).toEqual([{ kind: "combo", combo: 1 }]);
  });
  it("past the window the first key fires alone (on the tick, or before the next key)", () => {
    const s = createInputState();
    press(s, kit, 0, 0);
    expect(tick(s, kit, 0.39)).toEqual([]);
    expect(tick(s, kit, 0.41)).toEqual([{ kind: "tap", slot: 0 }]);
    press(s, kit, 0, 5);
    expect(press(s, kit, 1, 5.5)).toEqual([{ kind: "tap", slot: 0 }]); // too late: 1 waits for a partner of its own now
    expect(tick(s, kit, 6)).toEqual([{ kind: "tap", slot: 1 }]);
  });
  it("a key that isn't the pending key's partner releases it first", () => {
    const s = createInputState();
    press(s, kit, 2, 0);
    expect(press(s, kit, 3, 0.1)).toEqual([{ kind: "tap", slot: 2 }]);
  });
  it("a double tap of the same key is its own combo", () => {
    const s = createInputState();
    press(s, kit, 3, 0);
    expect(press(s, kit, 3, 0.2)).toEqual([{ kind: "combo", combo: 3 }]);
  });
  it("a locked key does nothing", () => {
    expect(press(createInputState(), kit, 4, 0)).toEqual([]);
  });
  it("a hold starts on the press and ends on the release or at max_s; key repeats are ignored", () => {
    const s = createInputState();
    expect(press(s, mixed, 1, 0)).toEqual([{ kind: "holdStart", slot: 1 }]);
    expect(press(s, mixed, 1, 0.5)).toEqual([]);
    expect(release(s, mixed, 1, 0.8)).toEqual([{ kind: "holdEnd", slot: 1, held: 0.8 }]);
    press(s, mixed, 1, 10);
    expect(tick(s, mixed, 12)).toEqual([{ kind: "holdEnd", slot: 1, held: 2 }]);
    expect(release(s, mixed, 1, 12.5)).toEqual([]);
  });
  it("a charge fires on the release with how far it got", () => {
    const s = createInputState();
    expect(press(s, mixed, 2, 0)).toEqual([{ kind: "chargeStart", slot: 2 }]);
    expect(release(s, mixed, 2, 0.75)).toEqual([{ kind: "charge", slot: 2, level: 0.5 }]);
    press(s, mixed, 2, 5);
    expect(release(s, mixed, 2, 9)).toEqual([{ kind: "charge", slot: 2, level: 1 }]);
    expect([chargeLevel(0.1, 0.25, 1.25), chargePotency(0), chargePotency(1)]).toEqual([0, 0.5, 1.5]);
  });
  it("toggles and drawn shapes fire on the press", () => {
    const s = createInputState();
    expect(press(s, mixed, 3, 0)).toEqual([{ kind: "toggle", slot: 3 }]);
    expect(press(s, mixed, 4, 0)).toEqual([{ kind: "draw", slot: 4 }]);
  });
});
