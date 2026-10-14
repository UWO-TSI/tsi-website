import { describe, expect, it } from "vitest";
import { gateWheel } from "./tools";
import { wheelContents } from "@/lib/game/toolWheel";

const wheel = (owned: string[] = []) => wheelContents({ site: "village", owned, weapons: [], armed: false, pins: ["apple"], stock: { apple: 3 } });

describe("the tool bag on a first arrival", () => {
  it("starts empty: nothing on the wheel until Bram hands over his rod", () => {
    expect(wheel().map(i => i.kind)).toEqual(["rod", "net", "shovel", "pin"]);
    expect(gateWheel(wheel(), { rod: false })).toEqual([]);
  });
  it("holds the rod alone once he has given it", () => {
    expect(gateWheel(wheel(), { rod: true }).map(i => i.kind)).toEqual(["rod"]);
  });
  it("never touches anyone not arriving: no arrival, the usual wheel", () => {
    const items = wheel(["net-mid", "glider_leaf"]);
    expect(gateWheel(items, null)).toEqual(items);
  });
});
