import { describe, expect, it } from "vitest";
import { REWARD_EVENTS, rewardHold, rewardOf, rewardSound } from "./reward";

describe("the shared reward card's event", () => {
  it("listens to the world's own events: a find, a craft and a bottle's recipe", () => {
    expect(REWARD_EVENTS).toEqual(["tsi:peaceful-got", "tsi:crafted", "tsi:recipe-learned"]);
  });

  it("shows a forage find with its art, name, rarity and size", () => {
    const r = rewardOf("tsi:peaceful-got", { key: "shell_scallop", name: "Scallop Shell", rarity: "common", one_liner: "", size: 9.4, isNew: true, kind: "forage" });
    expect(r).toMatchObject({ kind: "forage", key: "shell_scallop", name: "Scallop Shell", icon: "/assets/icons/shell_scallop.webp", rarity: "common", size: 9.4, isNew: true });
    expect(r!.title).toBe("New!");
  });

  it("says a bug was caught, and a dig was dug up", () => {
    expect(rewardOf("tsi:peaceful-got", { key: "bug_ladybug", name: "Ladybug", rarity: "common", size: null, isNew: false, bug: true })).toMatchObject({ kind: "bug", title: "Caught", size: null });
    expect(rewardOf("tsi:peaceful-got", { key: "shell_asari", name: "Asari Clam", rarity: "common", size: 4.2, isNew: false, kind: "dig" })).toMatchObject({ kind: "dig", title: "Dug up" });
  });

  it("takes the species' one-liner from the roster when the event has none", () => {
    expect(rewardOf("tsi:peaceful-got", { key: "wood_branch", name: "Tree branch", rarity: "common", size: null, isNew: false, kind: "forage" })!.note).toMatch(/Shake a tree/);
  });

  it("shows a craft with the made thing's art (its shop row's icon) and where it went", () => {
    const r = rewardOf("tsi:crafted", { id: "furn-floor-lamp", name: "Floor lamp", kind: "item" });
    expect(r).toMatchObject({ kind: "craft", key: "furn-floor-lamp", name: "Floor lamp", icon: "/assets/icons/floor-lamp.webp", title: "Crafted" });
    expect(r!.note).toMatch(/Bag/);
    expect(rewardOf("tsi:crafted", { id: "sword-iron", name: "Iron sword", kind: "weapon" })).toMatchObject({ icon: "/assets/icons/sword-iron.webp", note: expect.stringMatching(/gear/) });
  });

  it("unrolls a bottle's recipe: the thing it makes and what it takes", () => {
    const r = rewardOf("tsi:recipe-learned", { id: "rod-glass", name: "Glass rod" });
    expect(r).toMatchObject({ kind: "bottle", key: "rod-glass", name: "Glass rod", icon: "/assets/icons/rod_glass.webp" });
    expect(r!.ingredients).toEqual([
      { key: "wood_branch", name: "Tree branch", icon: "/assets/icons/wood_branch.webp", count: 4 },
      { key: "rock_crystal", name: "Crystal", icon: "/assets/icons/rock_crystal.webp", count: 1 },
      { key: "rock_clay", name: "Clay", icon: "/assets/icons/rock_clay.webp", count: 2 },
    ]);
  });

  it("ignores anything malformed", () => {
    expect(rewardOf("tsi:peaceful-got", null)).toBeNull();
    expect(rewardOf("tsi:peaceful-got", { name: "No key" })).toBeNull();
    expect(rewardOf("tsi:crafted", { id: 3 })).toBeNull();
    expect(rewardOf("tsi:toast", { key: "apple", name: "Apple" })).toBeNull();
  });

  it("sounds rarer finds lower and fuller, never with a dialogue blip or a door", () => {
    const common = rewardSound(rewardOf("tsi:peaceful-got", { key: "apple", name: "Apple", rarity: "common", size: null, isNew: false, kind: "forage" })!);
    const rare = rewardSound(rewardOf("tsi:peaceful-got", { key: "rock_crystal", name: "Crystal", rarity: "rare", size: null, isNew: false, kind: "dig" })!);
    expect(common.name).toBe("confirm");
    expect(rare.rate).toBeLessThan(common.rate);
    expect(rare.gain).toBeGreaterThan(common.gain);
    for (const s of [common, rare]) expect(s.name).not.toMatch(/^blip|^enter$|^exit$/);
  });

  it("stays up longer for something new or rare, and longest for a recipe to read", () => {
    const plain = rewardOf("tsi:peaceful-got", { key: "apple", name: "Apple", rarity: "common", size: null, isNew: false, kind: "forage" })!;
    const fresh = { ...plain, isNew: true };
    const bottle = rewardOf("tsi:recipe-learned", { id: "rod-glass", name: "Glass rod" })!;
    expect(rewardHold(fresh)).toBeGreaterThan(rewardHold(plain));
    expect(rewardHold(bottle)).toBeGreaterThan(rewardHold(fresh));
  });
});
