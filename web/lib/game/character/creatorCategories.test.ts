import { describe, expect, it } from "vitest";
import { CATEGORIES, choose, colourTarget, isOn, shownOptions } from "./creatorCategories";
import { DEFAULT_LOOK, FACE, PARTS, STARTER_PARTS, openEventParts, partRef, setEventsOpen, wear } from "./look";

const cat = (id: string) => CATEGORIES.find(c => c.id === id)!;

describe("creator categories (read from the catalogue)", () => {
  it("are David's nine, in the rail's order (eyebrows removed, playtest round 1)", () => {
    expect(CATEGORIES.slice(0, 9).map(c => c.id)).toEqual(["head", "hair", "eyes", "mouth", "extras", "accessories", "tops", "bottoms", "shoes"]);
  });
  it("offer no eyebrows anywhere: no category, no face section", () => {
    expect(CATEGORIES.some(c => c.id === "brows" || (c.icon as string) === "brows" || (c.place as string) === "brows")).toBe(false);
    expect(CATEGORIES.flatMap(c => c.sections).some(s => "face" in s.source && (s.source.face as string) === "brows")).toBe(false);
  });
  it("offer every catalogue part and every face cell, so new hair and clothes show without an edit", () => {
    const offered = new Set(CATEGORIES.flatMap(c => c.sections.flatMap(s => ("slot" in s.source ? s.options : []))));
    for (const p of PARTS) expect(offered.has(p.id), p.id).toBe(true);
    for (const layer of ["eyes", "mouth", "extras"] as const) expect(cat(layer === "extras" ? "extras" : layer).sections[0].options).toEqual(Object.keys(FACE.layers[layer].items));
  });
  it("show a swatch where the part takes a colour: skin, hair, clothes; the sliders on eyes and mouth", () => {
    expect(CATEGORIES.slice(0, 9).map(c => [c.id, c.swatch, c.place ?? null])).toEqual([
      ["head", "skin", null], ["hair", "hair", null], ["eyes", null, "eyes"], ["mouth", null, "mouth"], ["extras", null, null],
      ["accessories", "outfit", null], ["tops", "outfit", null], ["bottoms", "outfit", null], ["shoes", "outfit", null],
    ]);
  });
  it("frame the face for face parts and the body for clothes; the wardrobe gets hair and clothes", () => {
    expect(CATEGORIES.filter(c => c.framing === "face").map(c => c.id)).toEqual(["head", "eyes", "mouth", "extras"]);
    expect(cat("shoes").framing).toBe("body");
    expect(CATEGORIES.filter(c => c.wardrobe).map(c => c.id)).toEqual(["hair", "accessories", "tops", "bottoms", "shoes"]);
  });
  it("choose and show what's worn: a fringe, a toggled extra, shoes off, an accessory's second tap", () => {
    const hair = cat("hair");
    let l = choose(DEFAULT_LOOK, hair.sections[0], "bangs_bowl");
    expect([l.bangs, isOn(l, hair.sections[0], "bangs_bowl")]).toEqual(["bangs_bowl", true]);
    l = choose(l, cat("extras").sections[0], "blush");
    expect(l.extras).toEqual(["blush"]);
    expect(choose(l, cat("extras").sections[0], "blush").extras).toEqual([]);
    const shoes = cat("shoes").sections[0];
    expect(isOn(choose(l, shoes, null), shoes, null)).toBe(true);
    const glasses = cat("accessories").sections.find(s => s.id === "acc-face")!;
    const on = choose(l, glasses, "acc_glasses_round");
    expect(isOn(on, glasses, "acc_glasses_round")).toBe(true);
    expect(isOn(choose(on, glasses, "acc_glasses_round"), glasses, "acc_glasses_round")).toBe(false);
  });
  it("colour the worn part of the category (the accessory chosen last)", () => {
    expect(colourTarget(cat("tops"), DEFAULT_LOOK, null)).toBe(DEFAULT_LOOK.top);
    const two = wear(wear(DEFAULT_LOOK, "accessory", "acc_shoulder_bag"), "accessory", "acc_cap");
    expect(colourTarget(cat("accessories"), two, "acc_shoulder_bag")).toBe("acc_shoulder_bag");
    expect(colourTarget(cat("eyes"), two, null)).toBeNull();
  });
  it("give the whole hairstyles their own row in Hair, apart from the backs (head fit)", () => {
    const hair = cat("hair");
    const full = hair.sections.find(s => s.id === "hairstyles")!;
    expect(full.options.length).toBe(PARTS.filter(p => p.full).length);
    expect(hair.sections.find(s => s.id === "back")!.options.some(id => id && PARTS.find(p => p.id === id)?.full)).toBe(false);
    const l = choose(DEFAULT_LOOK, full, full.options[0]);
    expect([l.back, isOn(l, full, full.options[0])]).toEqual([full.options[0], true]);
  });
});

describe("the starting creator after the wardrobe cut (playtest round 1)", () => {
  const CRAFT_ONLY = ["acc_flower_crown", "acc_shell_necklace", "outfit_koi_kimono", "outfit_monarch_cape", "outfit_silk_sweater"];
  const shown = (mode: "create" | "wardrobe", owned: ReadonlySet<string>) => new Set(CATEGORIES.flatMap(c => c.sections.flatMap(s =>
    shownOptions(s, mode, id => { const ref = id && partRef(id); return !ref || owned.has(ref); }))));

  it("offers the starters and never a crafted part, even one already owned", () => {
    const starters = shown("create", new Set(STARTER_PARTS));
    for (const id of STARTER_PARTS) expect(starters.has(id), id).toBe(true);
    const crafted = shown("create", new Set([...STARTER_PARTS, ...CRAFT_ONLY]));
    for (const id of CRAFT_ONLY) expect(crafted.has(id), id).toBe(false);
  });
  it("leaves them in the closet: locked until crafted, then worn", () => {
    const closet = shown("wardrobe", new Set(STARTER_PARTS));
    for (const id of CRAFT_ONLY) expect(closet.has(id), id).toBe(true);
    const tops = cat("tops").sections[0];
    const l = choose(DEFAULT_LOOK, tops, "outfit_silk_sweater");
    expect(isOn(l, tops, "outfit_silk_sweater")).toBe(true);
  });
  it("keeps the Halloween closet to the witch hat and cat ears, shown only while it runs", () => {
    try {
      setEventsOpen(new Set(["halloween"]));
      expect(openEventParts().sort()).toEqual(["acc_cat_ears", "acc_witch_hat"]);
      const during = shown("wardrobe", new Set(openEventParts()));
      expect(["acc_witch_hat", "acc_cat_ears"].every(id => during.has(id))).toBe(true);
      setEventsOpen(new Set());
      expect(shown("wardrobe", new Set()).has("acc_witch_hat")).toBe(false);
    } finally {
      setEventsOpen(new Set());
    }
  });
});
