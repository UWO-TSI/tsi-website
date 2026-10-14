import { describe, expect, it } from "vitest";
import { CATEGORIES, choose, colourTarget, isOn } from "./creatorCategories";
import { DEFAULT_LOOK, FACE, PARTS, wear } from "./look";

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
  it("choose and show what's worn: a hairstyle, a toggled extra, shoes off, an accessory's second tap", () => {
    const hair = cat("hair");
    let l = choose(DEFAULT_LOOK, hair.sections[0], "hair_bowl_cut");
    expect([l.back, isOn(l, hair.sections[0], "hair_bowl_cut")]).toEqual(["hair_bowl_cut", true]);
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
    const two = wear(wear(DEFAULT_LOOK, "accessory", "acc_scarf"), "accessory", "acc_cap");
    expect(colourTarget(cat("accessories"), two, "acc_scarf")).toBe("acc_scarf");
    expect(colourTarget(cat("eyes"), two, null)).toBeNull();
  });
  it("offer David's 21 whole hairstyles as Hair's only row, recolourable (head-roblox)", () => {
    const hair = cat("hair");
    expect(hair.sections.map(s => s.id)).toEqual(["hairstyles"]);
    expect(hair.sections[0].options).toEqual(PARTS.filter(p => p.full).map(p => p.id));
    expect(hair.sections[0].options).toHaveLength(21);
    expect(hair.swatch).toBe("hair");
    const full = hair.sections[0];
    const l = choose(DEFAULT_LOOK, full, full.options[0]);
    expect([l.back, isOn(l, full, full.options[0])]).toEqual([full.options[0], true]);
  });
});
