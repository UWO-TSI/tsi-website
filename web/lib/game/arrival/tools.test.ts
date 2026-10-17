import { describe, expect, it } from "vitest";
import { gateWheel } from "./tools";
import { wheelContents } from "@/lib/game/toolWheel";
import { checkHeld } from "@/lib/game/tools";

const wheel = (owned: string[] = [], taught = false) => wheelContents({ site: "village", owned, weapons: [], armed: false, pins: ["apple"], stock: { apple: 3 }, taught });

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

describe("after the tour (row 312): tools come from people", () => {
  it("leaves a new arrival with Bram's rod only: the starter net and shovel don't come back", () => {
    expect(gateWheel(wheel([], true), null).map(i => i.kind)).toEqual(["rod", "pin"]);
  });
  it("puts a tool on the wheel once its resident has handed it over", () => {
    expect(wheel(["net-basic"], true).map(i => i.kind)).toEqual(["rod", "net", "pin"]);
    expect(wheel(["net-basic", "shovel-basic"], true).map(i => i.kind)).toEqual(["rod", "net", "shovel", "pin"]);
  });
  it("lets existing players keep the tools they had: the starters, and anything better they own", () => {
    expect(wheel().map(i => i.id)).toEqual(["rod:rod_flimsy", "net:net-basic", "shovel:shovel-basic", "pin:apple"]);
    expect(wheel(["net-silk", "shovel-mid"]).map(i => i.id)).toEqual(["rod:rod_flimsy", "net:net-silk", "shovel:shovel-mid", "pin:apple"]);
    // Owned outright is owned whatever the rule: a new arrival who bought the iron shovel has it.
    expect(wheel(["shovel-mid"], true).map(i => i.id)).toEqual(["rod:rod_flimsy", "shovel:shovel-mid", "pin:apple"]);
  });
  it("is the server's rule too: a taught member's starter net counts only once it's in the inventory", () => {
    expect(checkHeld("net-basic", "net", [], true)).toMatchObject({ ok: false, status: 403, code: "tool_not_owned" });
    expect(checkHeld("net-basic", "net", ["net-basic"], true)).toMatchObject({ ok: true });
    expect(checkHeld("shovel-basic", "shovel", [], false)).toMatchObject({ ok: true });
    expect(checkHeld("rod_flimsy", "rod", [], true)).toMatchObject({ ok: true });
  });
});
