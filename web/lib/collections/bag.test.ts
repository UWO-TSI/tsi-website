import { describe, expect, it } from "vitest";
import { BAG_START, arrange, bagCapacity, fits, slotCounts, slotsUsed, sortSlots, stackSize } from "./bag";
import { ROSTER } from "./roster";

/** Nineteen fish (a slot each) and 29 branches (one slot): a bag of exactly 20. */
const FISH19 = ROSTER.filter(s => s.category === "fish").slice(0, 19).map(s => s.key);
const full = (): Record<string, number> => ({ wood_branch: 29, ...Object.fromEntries(FISH19.map(k => [k, 1])) });

describe("the backpack's stacks (proposal 24)", () => {
  it("stacks materials and fruit to 30, flowers, shells and mushrooms to 10, and gives each fish, sea creature and bug its own slot", () => {
    expect(["wood_branch", "rock_stone", "rock_gold_nugget", "apple", "fruit_coconut"].map(stackSize)).toEqual([30, 30, 30, 30, 30]);
    expect(["flower_rose", "shell_whelk", "mushroom_flat"].map(stackSize)).toEqual([10, 10, 10]);
    expect(["fish_dace", "sea_sea_star", "shore_hermit_crab", "bug_mantis", "something_new"].map(stackSize)).toEqual([1, 1, 1, 1, 1]);
  });

  it("counts the slots a stock fills, partial stacks and all", () => {
    const stock = { wood_branch: 45, apple: 3, flower_rose: 11, fish_dace: 2, rock_stone: 0 };
    expect(slotsUsed(stock)).toBe(2 + 1 + 2 + 2);
    expect(slotsUsed(stock, "wood_branch", 15)).toBe(7);  // 60 branches: still two stacks
    expect(slotsUsed(stock, "wood_branch", 16)).toBe(8);  // 61: a third
    expect(slotsUsed(stock, "bug_mantis", 1)).toBe(8);
    expect(slotsUsed(stock, "fish_dace", -2)).toBe(5);
    expect(slotsUsed({})).toBe(0);
  });
});

describe("a full backpack (row 280: when it's full you can't pick up)", () => {
  it("still takes one more of a partial stack, but nothing that needs a new slot", () => {
    expect(slotsUsed(full())).toBe(BAG_START);
    expect(fits(full(), BAG_START, "wood_branch")).toBe(true);     // the 30th branch tops its stack up
    expect(fits(full(), BAG_START, "wood_branch", 2)).toBe(false); // the 31st needs a slot
    expect(fits(full(), BAG_START, "apple")).toBe(false);
    expect(fits(full(), BAG_START, FISH19[0])).toBe(false);         // even a second of a fish you have
    expect(fits(full(), 30, "apple")).toBe(true);
  });

  it("keeps a member over capacity whole, and lets them pick nothing up until they're back under", () => {
    const over = { ...full(), bug_mantis: 1, bug_firefly: 1, apple: 4 }; // 23 slots in a 20-slot bag
    expect(slotsUsed(over)).toBe(23);
    expect(fits(over, BAG_START, "apple")).toBe(false);       // not even into the apples' partial stack
    expect(fits(over, BAG_START, "wood_branch")).toBe(false);
    expect(fits(over, 30, "apple")).toBe(true);               // a bigger bag takes it again
  });

  it("grows with the pocket upgrades: 20, then 30 (Roomier pocket), then 40 (Roomiest pocket)", () => {
    expect(bagCapacity([])).toBe(20);
    expect(bagCapacity(["rod_cedar", "net-mid"])).toBe(20);
    expect(bagCapacity(["bag:30"])).toBe(30);
    expect(bagCapacity(["bag:40"])).toBe(40);
    expect(bagCapacity(["bag:30", "bag:40", "bag:x", "bag:"])).toBe(40);
  });
});

describe("the grid (drag, sort)", () => {
  it("keeps where you put things, drops stacks that are gone and puts new ones in the first hole", () => {
    const stock = { wood_branch: 45, apple: 3, fish_dace: 1 };
    const saved = ["apple", null, "wood_branch", "fish_dace", "rock_stone", "wood_branch", "wood_branch"];
    expect(arrange(stock, saved, 8)).toEqual(["apple", null, "wood_branch", "fish_dace", null, "wood_branch", null, null]);
    // A third stack of branches keeps the third saved place; a new item takes the first hole.
    expect(arrange({ ...stock, wood_branch: 61, bug_mantis: 1 }, saved, 8)).toEqual(["apple", "bug_mantis", "wood_branch", "fish_dace", null, "wood_branch", "wood_branch", null]);
    expect(arrange({ ...stock, bug_mantis: 1, flower_rose: 1 }, saved, 8)).toEqual(["apple", "bug_mantis", "wood_branch", "fish_dace", "flower_rose", "wood_branch", null, null]);
    // Nothing saved yet: the stock in order, then empty slots up to the bag's size.
    expect(arrange({ apple: 1 }, [], 3)).toEqual(["apple", null, null]);
    // Over capacity: every stack still shows.
    expect(arrange({ apple: 1, fish_dace: 1, bug_mantis: 1 }, [], 2)).toEqual(["apple", "fish_dace", "bug_mantis"]);
  });

  it("shows each stack's own count, the full stacks before the partial one", () => {
    const slots = arrange({ wood_branch: 45, apple: 3 }, ["wood_branch", "apple", "wood_branch"], 4);
    expect(slotCounts(slots, { wood_branch: 45, apple: 3 })).toEqual([30, 3, 15, null]);
  });

  it("sorts by type, then rarity (rarest first), each item's stacks together with no holes", () => {
    const stock = { rock_stone: 3, apple: 31, fish_dace: 1, fish_golden_koi: 1, bug_mantis: 1, flower_rose: 2, sea_sea_star: 1 };
    expect(sortSlots(stock)).toEqual(["fish_golden_koi", "fish_dace", "sea_sea_star", "bug_mantis", "apple", "apple", "flower_rose", "rock_stone"]);
  });
});
