import { describe, expect, it } from "vitest";
import { STARTER_WEAPONS } from "@/lib/combat/weapons";
import { EMPTY_HANDS, WHEEL_SLOTS, clickAction, equip, flick, heldItem, pinItem, quickSwap, reconcile, slotAt, slotPosition, toolNeeded, wheelContents, wheelWeapons, type WheelContext } from "./toolWheel";
import { TOOLS, bestTool } from "./tools";

const base: WheelContext = { site: "village", owned: [], weapons: STARTER_WEAPONS, armed: false, pins: [], stock: {} };
const ids = (ctx: Partial<WheelContext>) => wheelContents({ ...base, ...ctx }).map(i => i.id);
const NOTHING = { water: false, bug: null, dig: null };

describe("the tool wheel's contents (specs/game-ui.md §1)", () => {
  it("holds everyone's tier-1 rod, net and shovel, and the best owned once you have more", () => {
    expect(ids({})).toEqual(["rod:rod_flimsy", "net:net-basic", "shovel:shovel-basic"]);
    expect(ids({ owned: ["rod_glass", "rod_cedar", "net-mid", "shovel-gold"] })).toEqual(["rod:rod_glass", "net:net-mid", "shovel:shovel-gold"]);
    expect(TOOLS.filter(t => t.tier === 1).every(t => t.source === "starter")).toBe(true);
    expect(bestTool("shovel", ["shovel-gold", "shovel-mid"]).tier).toBe(5);
  });

  it("keeps the tier you set while you own it", () => {
    expect(ids({ owned: ["rod_glass", "rod_tidewarden"], chosen: { rod: "rod_glass" } })[0]).toBe("rod:rod_glass");
    expect(ids({ owned: ["rod_cedar"], chosen: { rod: "rod_tidewarden" } })[0]).toBe("rod:rod_cedar");
  });

  it("adds the leaf glider when owned, and weapons only once the ruins gate is open", () => {
    expect(ids({ owned: ["glider_leaf"] })).toContain("glider:glider_leaf");
    expect(ids({}).some(id => id.startsWith("weapon:"))).toBe(false);
    const armed = ids({ armed: true, defaultWeapon: "bow-willow" });
    expect(armed.filter(id => id.startsWith("weapon:"))[0]).toBe("weapon:bow-willow");
    expect(armed.length).toBeLessThanOrEqual(WHEEL_SLOTS);
  });

  it("puts the best of each weapon type on the village wheel, the default first", () => {
    expect(wheelWeapons([...STARTER_WEAPONS, "sword-iron", "sword-guardian"], null, false)).toEqual(["sword-guardian", "bow-willow", "staff-oak", "tome-spirits", "wraps-cloth"]);
    expect(wheelWeapons([...STARTER_WEAPONS, "sword-iron"], "sword-driftwood", false)).toEqual(["sword-driftwood", "bow-willow", "staff-oak", "tome-spirits", "wraps-cloth"]);
    expect(wheelWeapons(["made-up", "bow-willow"], "made-up", false)).toEqual(["bow-willow"]);
  });

  it("fits two pins you still have some of, and never more than eight slots", () => {
    const pinned = ids({ pins: ["apple", "fruit_pear", "peach"], stock: { apple: 2, fruit_pear: 0, peach: 1 } });
    expect(pinned.filter(id => id.startsWith("pin:"))).toEqual(["pin:apple", "pin:peach"]);
    const full = ids({ owned: ["glider_leaf"], armed: true, weapons: [...STARTER_WEAPONS, "revolver-brass"], pins: ["apple", "peach"], stock: { apple: 1, peach: 1 } });
    expect(full).toHaveLength(WHEEL_SLOTS);
    expect(full.slice(-2)).toEqual(["pin:apple", "pin:peach"]);
    expect(pinItem("apple")).toMatchObject({ name: "Apple", icon: "/assets/icons/apple.png" });
  });

  it("is weapons only in the ruins: the default, the best of each type, then the rest you own", () => {
    const ruins = wheelContents({ ...base, site: "ruins", armed: true, weapons: [...STARTER_WEAPONS, "sword-iron", "staff-rune"], defaultWeapon: "staff-oak", pins: ["apple"], stock: { apple: 3 } });
    expect(ruins.every(i => i.kind === "weapon")).toBe(true);
    expect(ruins.map(i => i.key)).toEqual(["staff-oak", "sword-iron", "bow-willow", "tome-spirits", "wraps-cloth", "sword-driftwood", "staff-rune"]);
  });
});

describe("what you hold", () => {
  const items = wheelContents({ ...base, armed: true });
  it("equips from the wheel and remembers what you had; the centre is empty hands", () => {
    let s = equip(EMPTY_HANDS, "rod:rod_flimsy");
    expect(s).toEqual({ held: "rod:rod_flimsy", last: null });
    s = equip(s, "net:net-basic");
    expect(s).toEqual({ held: "net:net-basic", last: "rod:rod_flimsy" });
    s = equip(s, null);
    expect(s).toEqual({ held: null, last: "net:net-basic" });
    expect(heldItem(s, items)).toBeNull();
    expect(equip(s, null)).toBe(s);
  });

  it("swaps back to the last item on a quick tap, and back again", () => {
    const s = { held: "net:net-basic", last: "rod:rod_flimsy" };
    expect(quickSwap(s, items)).toEqual({ held: "rod:rod_flimsy", last: "net:net-basic" });
    expect(quickSwap(quickSwap(s, items), items)).toEqual(s);
    // Nothing to go back to: a tap puts away what you hold, and does nothing with empty hands.
    expect(quickSwap({ held: "net:net-basic", last: null }, items)).toEqual({ held: null, last: "net:net-basic" });
    expect(quickSwap(EMPTY_HANDS, items)).toBe(EMPTY_HANDS);
    // The last item left the wheel (a pin eaten up): put away instead.
    expect(quickSwap({ held: "rod:rod_flimsy", last: "pin:apple" }, items)).toEqual({ held: null, last: "rod:rod_flimsy" });
  });

  it("lets go of what left the wheel, or takes the fallback (the ruins' default weapon)", () => {
    expect(reconcile({ held: "pin:apple", last: null }, items)).toEqual({ held: null, last: null });
    const ruins = wheelContents({ ...base, site: "ruins", armed: true, defaultWeapon: "bow-willow" });
    expect(reconcile({ held: "rod:rod_flimsy", last: null }, ruins, "weapon:bow-willow").held).toBe("weapon:bow-willow");
    const same = { held: "weapon:bow-willow", last: null };
    expect(reconcile(same, ruins, "weapon:sword-driftwood")).toBe(same);
  });
});

describe("choosing with a flick", () => {
  it("points slot 0 up and the rest clockwise; the centre is empty hands", () => {
    expect(slotAt(0, -100, 8, 30)).toBe(0);
    expect(slotAt(100, 0, 8, 30)).toBe(2);
    expect(slotAt(0, 100, 8, 30)).toBe(4);
    expect(slotAt(-100, 0, 8, 30)).toBe(6);
    expect(slotAt(70, -72, 8, 30)).toBe(1);
    expect(slotAt(-60, -80, 8, 30)).toBe(7);
    expect(slotAt(10, -12, 8, 30)).toBeNull();
    expect(slotAt(0, -100, 0, 30)).toBeNull();
    for (let i = 0; i < 5; i++) expect(slotAt(...slotPosition(i, 5, 120), 5, 30)).toBe(i);
  });

  it("adds up the mouse under pointer lock, held to the wheel's rim", () => {
    let v: [number, number] = [0, 0];
    v = flick(v, 30, -40, 120);
    expect(v).toEqual([30, -40]);
    v = flick(v, 300, 0, 120);
    expect(Math.hypot(...v)).toBeCloseTo(120);
    expect(slotAt(...v, 8, 30)).toBe(2);
  });
});

describe("left click uses what you hold (specs/game-ui.md §2)", () => {
  const item = (id: string) => wheelContents({ ...base, armed: true, pins: ["apple", "flower_rose"], stock: { apple: 1, flower_rose: 1 } }).find(i => i.id === id)!;
  it("casts the rod at water, swings the net, digs with the shovel, attacks with a weapon, eats food", () => {
    expect(clickAction(item("rod:rod_flimsy"), { ...NOTHING, water: true }, "village")).toMatchObject({ verb: "cast", label: "Cast" });
    expect(clickAction(item("rod:rod_flimsy"), NOTHING, "village")).toBeNull();
    expect(clickAction(item("net:net-basic"), { ...NOTHING, bug: "Ladybug" }, "village")).toMatchObject({ verb: "swing", target: true, label: "Swing the net (Ladybug)" });
    expect(clickAction(item("net:net-basic"), NOTHING, "village")).toMatchObject({ verb: "swing", target: false });
    expect(clickAction(item("shovel:shovel-basic"), { ...NOTHING, dig: "Strike the rock" }, "village")).toMatchObject({ verb: "dig", target: true, label: "Strike the rock" });
    expect(clickAction(item("weapon:sword-driftwood"), NOTHING, "village")).toMatchObject({ verb: "attack", label: "Practice swing", target: false });
    expect(clickAction(item("weapon:sword-driftwood"), NOTHING, "ruins")).toMatchObject({ verb: "attack", target: true });
    expect(clickAction(item("pin:apple"), NOTHING, "village")).toMatchObject({ verb: "eat", label: "Eat the apple" });
    expect(clickAction(item("pin:flower_rose"), NOTHING, "village")).toBeNull();
    expect(clickAction(null, { water: true, bug: "Ladybug", dig: "Dig it up" }, "village")).toBeNull();
  });

  it("names the tool something in reach needs when you hold another", () => {
    expect(toolNeeded(null, { ...NOTHING, bug: "Ladybug" })).toBe("net");
    expect(toolNeeded(item("rod:rod_flimsy"), { ...NOTHING, dig: "Dig it up" })).toBe("shovel");
    expect(toolNeeded(item("net:net-basic"), { ...NOTHING, water: true })).toBe("rod");
    expect(toolNeeded(item("net:net-basic"), { ...NOTHING, bug: "Ladybug" })).toBeNull();
    expect(toolNeeded(item("net:net-basic"), NOTHING)).toBeNull();
  });
});
