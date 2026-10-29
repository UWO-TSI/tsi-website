import { describe, expect, it } from "vitest";
import { CATEGORIES, choose, colourTarget, isOn, shownOptions } from "./creatorCategories";
import { BATCH2_PRICES, DEFAULT_LOOK, FACE, PART_BY_ID, PARTS, offered, priceOf, STARTER_PARTS, faceRef, openEventParts, partRef, setEventsOpen, unlockRef, wear } from "./look";

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
  it("frame the face for face parts and the body for clothes; the wardrobe gets hair, the face parts and clothes", () => {
    expect(CATEGORIES.filter(c => c.framing === "face").map(c => c.id)).toEqual(["head", "eyes", "mouth", "extras"]);
    expect(cat("shoes").framing).toBe("body");
    // wardrobe batch 2: a whole face is sold in the shop, so the closet wears the face parts too; head and skin stay the creator's
    expect(CATEGORIES.filter(c => c.wardrobe).map(c => c.id)).toEqual(["hair", "eyes", "mouth", "extras", "accessories", "tops", "bottoms", "shoes"]);
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
    const two = wear(wear(DEFAULT_LOOK, "accessory", "acc_shoulder_bag"), "accessory", "acc_cap");
    expect(colourTarget(cat("accessories"), two, "acc_shoulder_bag")).toBe("acc_shoulder_bag");
    expect(colourTarget(cat("eyes"), two, null)).toBeNull();
  });
  it("offer David's 32 whole hairstyles (wardrobe batch 2 added five; #22 is its hat alone; #14, #8, #9 and #24 removed; batch 3 added 15, less #29, #31, #33, #36 and #38) as Hair's only row, recolourable (head-roblox)", () => {
    const hair = cat("hair");
    expect(hair.sections.map(s => s.id)).toEqual(["hairstyles"]);
    expect(hair.sections[0].options).toEqual(PARTS.filter(p => p.full).map(p => p.id));
    expect(hair.sections[0].options).toHaveLength(32);
    expect(hair.swatch).toBe("hair");
    const full = hair.sections[0];
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

describe("wardrobe batch 2 in the creator and the closet (David's prices, specs/wardrobe/batch2-pricing.json)", () => {
  const shownIn = (mode: "create" | "wardrobe", owned: ReadonlySet<string>) => new Set(CATEGORIES.flatMap(c => c.sections.flatMap(s =>
    shownOptions(s, mode, id => { const ref = id && unlockRef(id); return !ref || owned.has(ref); }))));
  const b2 = PARTS.filter(p => p.key && priceOf(p.key));          // batch 3's unpriced items are not offered at all (below)
  const free = (key: string) => BATCH2_PRICES[key]?.mode === "free";
  const faceParts = (key: string) => { const f = FACE.faces[key]; return [f.eyes, f.mouth, ...f.extras].filter((x): x is string => !!x); };

  it("gives the accessories their Roblox slots: Glasses, Hats, Neck and the new Front, beside the earlier ones", () => {
    const acc = cat("accessories").sections;
    expect(acc.map(s => s.label)).toEqual(["Glasses", "Hats", "Neck", "Front", "Bags"]);
    const of = (label: string) => acc.find(s => s.label === label)!.options;
    for (const p of b2.filter(q => q.slot === "accessory")) expect(of({ face: "Glasses", head: "Hats", neck: "Neck", front: "Front" }[p.group as string]!), p.id).toContain(p.id);
    expect(of("Front")).toEqual(["acc_paper_tie"]);
    expect(of("Glasses")).toContain("acc_half_rim_glasses");          // #07: a hat in Roblox, a pair of glasses here
  });
  it("offers the free items in the starting creator, and a priced one only once it is owned", () => {
    const start = shownIn("create", new Set(STARTER_PARTS));
    for (const p of b2) expect(start.has(p.id), p.id).toBe(free(p.key!));
    for (const key of Object.keys(FACE.faces).filter(k => priceOf(k))) for (const id of faceParts(key)) expect(start.has(id), id).toBe(free(key));
    const bought = shownIn("create", new Set([...STARTER_PARTS, "hair_curly_pigtails", "acc_cowboy_hat", faceRef("vampire")]));
    for (const id of ["hair_curly_pigtails", "acc_cowboy_hat", ...faceParts("face-25")]) expect(bought.has(id), id).toBe(true);
    expect(bought.has("cat_wide")).toBe(false);
  });
  it("shows everything in the closet, the priced ones locked behind their shop row", () => {
    const closet = shownIn("wardrobe", new Set(STARTER_PARTS));
    for (const p of b2) expect(closet.has(p.id), p.id).toBe(true);
    for (const key of Object.keys(FACE.faces).filter(k => priceOf(k))) for (const id of faceParts(key)) expect(closet.has(id), id).toBe(true);
    for (const p of b2) expect(unlockRef(p.id), p.id).toBe(free(p.key!) ? null : partRef(p.id));
  });
  it("chooses a whole face's parts like any other: eyes, a mouth and a toggled accent", () => {
    const f = FACE.faces["face-25"];
    let l = choose(DEFAULT_LOOK, cat("eyes").sections[0], f.eyes);
    l = choose(l, cat("mouth").sections[0], f.mouth!);
    l = choose(l, cat("extras").sections[0], f.extras[0]);
    expect([l.eyes, l.mouth, l.extras]).toEqual([f.eyes, f.mouth, f.extras]);
  });
});

describe("a part David hasn't priced is not offered (coordinator, 2026-10-27; look.ts offered)", () => {
  const every = (mode: "create" | "wardrobe") => new Set(CATEGORIES.flatMap(c => c.sections.flatMap(s => shownOptions(s, mode, () => true))));
  /** Runs `fn` with these pricing keys unlisted (every batch 3 item is priced now), then restores them. */
  const without = (keys: string[], fn: () => void) => {
    const saved = keys.map(k => [k, BATCH2_PRICES[k]] as const);
    try { for (const k of keys) delete BATCH2_PRICES[k]; fn(); } finally { for (const [k, v] of saved) BATCH2_PRICES[k] = v; }
  };

  it("holds back a keyed hair, a keyed accessory and a whole face's parts until they are priced, owned or not", () => {
    const hair = PARTS.find(p => p.key === "hair-34")!, glasses = PARTS.find(p => p.key === "acc-25")!, f = FACE.faces["face-26"];
    const faceIds = [f.eyes, f.mouth, ...f.extras].filter((x): x is string => !!x);
    for (const mode of ["create", "wardrobe"] as const) for (const id of [hair.id, glasses.id, ...faceIds]) expect(every(mode).has(id), `${mode} ${id} priced`).toBe(true);
    without(["hair-34", "acc-25", "face-26"], () => {
      for (const mode of ["create", "wardrobe"] as const) for (const id of [hair.id, glasses.id, ...faceIds]) expect(every(mode).has(id), `${mode} ${id}`).toBe(false);
      expect(PART_BY_ID.has(hair.id) && PART_BY_ID.has(glasses.id)).toBe(true);        // the catalogue (Face Fit, /lab) still lists them
      expect([offered(hair.id), offered(f.eyes), offered("top_tee")]).toEqual([false, false, true]);
    });
    expect(offered(hair.id)).toBe(true);
  });
  it("offers every keyed item once it is priced, free or sold", () => {
    const shown = every("wardrobe");
    for (const p of PARTS.filter(q => q.key && !q.event)) expect([p.id, priceOf(p.key) !== null, shown.has(p.id)]).toEqual([p.id, true, true]);
  });
});
