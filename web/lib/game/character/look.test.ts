import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { glbStats, readGlb } from "@/lib/game/perf/glbStats";
import { CHARACTER_BUDGET } from "@/lib/game/perf/budget";
import { BASE_URL, BATCH2_PRICES, COLOUR_ATLAS_URL, CUSTOM_HAIR_REF, HAIR_MAPS_URLS, HAIR_THUMB_URL, NATURAL_HAIR, naturalHex, OLD_HAIR, LOD_SKIN_URL, CLIPS, DEFAULT_LOOK, FACE, FACE_ATLAS2_URLS, FACE_ATLAS_URLS, PALETTE, PARTS, PART_BY_ID, bodyKey, faceRef, facePartRef, hairHex, lookBytes, lookRefs, parseLook, partRef, priceOf, randomLook, resolveParts, seeded, STARTER_PARTS, unlockRef, wear, wornParts } from "./look";
import { LOOK_MAX_BYTES } from "@/lib/net/protocol";
import { hairShift, NO_SHIFT, shiftedMedian } from "./hairColour";

const web = join(__dirname, "../../..");
const art = join(web, "../art/characters");
/** A web copy that sync-character-assets.mjs meshopt-compressed: the same triangles and primitives as its art source. */
function shipsCompressed(shipped: Buffer, source: Buffer, name: string) {
  expect((readGlb(shipped).json as { extensionsRequired?: string[] }).extensionsRequired, name).toContain("EXT_meshopt_compression");
  const [a, b] = [glbStats(shipped), glbStats(source)];
  expect([a.triangles, a.primitives, a.materials, a.bones], name).toEqual([b.triangles, b.primitives, b.materials, b.bones]);
}

describe("character catalogue", () => {
  it("matches art/characters (re-run scripts/sync-character-assets.mjs after a character build)", () => {
    for (const [copy, source] of [["character_catalog.json", "character_catalog.json"], ["palette.json", "palette.json"], ["face_v7.json", "v7/face/face_v7.json"]]) {
      expect(readFileSync(join(web, "data/characters", copy), "utf8"), copy).toBe(readFileSync(join(art, source), "utf8"));
    }
  });
  it("ships every part GLB, the clip base and the face atlases", () => {
    for (const p of PARTS) expect(existsSync(join(web, "public/assets/characters/v6", p.glb)), p.glb).toBe(true);
    for (const f of [BASE_URL, FACE_ATLAS_URLS.creator, FACE_ATLAS_URLS.world, FACE_ATLAS2_URLS.creator, FACE_ATLAS2_URLS.world]) expect(existsSync(join(web, "public", f)), f).toBe(true);
    expect(existsSync(join(web, "public/assets/characters/v6/decal_tsi_mark.png"))).toBe(true);
    expect(BASE_URL).toMatch(/v8_clips\.glb$/); // the v8 head on the shared skull (head fit, row 304)
  });
  it("ships a LOD 1 for every part and the base skin, lighter than the full (art/characters/build_lod.py)", () => {
    const lod = JSON.parse(readFileSync(join(art, "lod1/lod.json"), "utf8")) as Record<string, { tris: number; lod1: number }>;
    for (const p of PARTS) {
      expect(lod[p.glb], p.glb).toBeDefined();
      const shipped = readFileSync(join(web, "public/assets/characters/v6/lod1", p.glb)), source = readFileSync(join(art, "lod1", p.glb));
      // the whole hairstyles and David's Roblox accessories (wardrobe batch 2) ship meshopt-compressed
      if (p.full || p.roblox?.attachment) shipsCompressed(shipped, source, `lod1/${p.glb}`);
      else expect(shipped.equals(source), p.glb).toBe(true);
      expect(lod[p.glb].lod1, p.glb).toBeLessThanOrEqual(lod[p.glb].tris);
    }
    expect(existsSync(join(web, "public", LOD_SKIN_URL))).toBe(true);
    const all = Object.values(lod).reduce((s, v) => [s[0] + v.tris, s[1] + v.lod1], [0, 0]);
    expect(all[1] / all[0]).toBeLessThan(0.9); // shape-checked: hair and outfits lighten, glasses, prints and layered tops stay whole
  });
  it("ships the whole hairstyles meshopt-compressed in every tier, with a far LOD 2 within 1,200 (head-roblox)", () => {
    const lod2 = JSON.parse(readFileSync(join(art, "lod2/lod.json"), "utf8")) as Record<string, { tris: number; lod2: number }>;
    const hair = PARTS.filter(p => p.full);
    expect(Object.keys(lod2).sort()).toEqual(hair.map(p => p.glb).sort());
    for (const p of hair) {
      shipsCompressed(readFileSync(join(web, "public/assets/characters/v6", p.glb)), readFileSync(join(art, p.glb)), p.glb);
      const shipped = readFileSync(join(web, "public/assets/characters/v6/lod2", p.glb));
      shipsCompressed(shipped, readFileSync(join(art, "lod2", p.glb)), `lod2/${p.glb}`);
      expect(glbStats(shipped).triangles, `lod2/${p.glb}`).toBeLessThanOrEqual(1200);
      expect(glbStats(shipped).triangles, `lod2/${p.glb}`).toBeLessThanOrEqual(glbStats(readFileSync(join(web, "public/assets/characters/v6/lod1", p.glb))).triangles);
    }
    const parts = resolveParts(DEFAULT_LOOK);
    expect(parts.find(p => p.id === DEFAULT_LOOK.back)!.lod2).toMatch(/\/lod2\/hair\/full\//);
    for (const p of parts.filter(q => q.id !== DEFAULT_LOOK.back)) expect(p.lod2, p.id).toBe(p.lod);   // the rest: their LOD 1
  });
  it("has unique ids, known slots, budgets, and the palette sizes of row 143", () => {
    expect(new Set(PARTS.map(p => p.id)).size).toBe(PARTS.length);
    for (const p of PARTS) {
      expect(["bangs", "back", "top", "bottom", "onepiece", "shoes", "accessory"]).toContain(p.slot);
      // Hair and headwear are closed solids (avatar-fit); a hat carries its own hair tuck and replaces the back hair.
      // Sculpted-lock hair (avatar v7) spends more per piece; the full look stays under ~4000 (next test).
      const lockHair = (p as { v7?: boolean }).v7;
      // a whole hairstyle (head-roblox) is David's original Roblox mesh (Roblox's 4,000 cap) plus its under-cap
      // wardrobe batch 2: David's Roblox accessories hold the accessory budget (budget.ts, 1,200), whatever their slot
      expect(p.tris, p.id).toBeLessThanOrEqual(p.full ? 4400 : lockHair || p.roblox?.attachment ? 1200 : p.slot === "bangs" || p.slot === "back" ? 700 : p.group === "head" ? 1150 : 300);
      if (p.slot === "accessory") expect(["face", "head", "bag", "neck", "front"]).toContain(p.group);
      if (p.variantOf) expect(PART_BY_ID.has(p.variantOf)).toBe(true);
      for (const m of p.materials) if (m.tint === "outfit") expect(m.default as number).toBeLessThan(PALETTE.outfit.length);
    }
    expect([PALETTE.skin.length, PALETTE.hair.length, PALETTE.outfit.length]).toEqual([12, 12, 16]);
    expect(CLIPS.map(c => c.name)).toEqual(expect.arrayContaining(["Idle", "Walk", "Run", "Sit", "Study", "Sleep", "Fish", "FishHold", "Forage", "Dig", "Net", "Wave", "Cheer", "Laugh", "Sad", "Dance", "AttackMelee", "AttackBow", "AttackCast", "DodgeRoll", "Hit", "Defeat", "Trace", "Stretch"]));
    const A = FACE.anchors;
    const cells: [string, number[], [number, number]][] = [
      ...Object.entries(FACE.layers.eyes.items).flatMap(([id, frames]) => Object.entries(frames).filter(([, c]) => c).map(([f, c]) =>
        [`${id}/${f}`, c, f === "left" ? A.eye_left : frames.left === null ? A.eye_pair : A.eye] as [string, number[], [number, number]])),
      ...[...Object.entries(FACE.layers.mouth.items), ...Object.entries(FACE.layers.talk.items)].map(([id, c]) => [id, c, A.mouth] as [string, number[], [number, number]]),
      ...Object.entries(FACE.layers.extras.items).map(([id, it]) => [id, it.cell, A[it.anchor]] as [string, number[], [number, number]]),
    ];
    for (const [id, [x, y, w, h, ax, ay, page], [au, aw]] of cells) {
      const [W, H] = page ? FACE.atlas2_size : FACE.atlas_size;   // a 7th value 1: the second page
      expect(x + w <= W && y + h <= H, id).toBe(true);
      if (!w) continue;   // an empty cell
      if (page) {
        // David's faces sit where they sat on their own heads: placed at the anchor, the cell lies on the face canvas
        const u0 = au - ax / FACE.density, w0 = aw - ay / FACE.density;
        expect(u0 >= -1e-3 && w0 >= -1e-3 && u0 + w / FACE.density <= 1.001 && w0 + h / FACE.density <= 1.001, id).toBe(true);
      } else {
        // drawn round its anchor, a cell lands on the face canvas (the shut eye frames sit a little under the eye centre)
        expect(Math.abs(ax - w / 2) < w && Math.abs(ay - h / 2) < h, id).toBe(true);
      }
    }
  });
  it("keeps a full look within the character budget: a hat look under ~4000 triangles, a whole hairstyle's within CHARACTER_BUDGET.full", () => {
    // the base GLB's JSON chunk (its embedded face image does not decode under Node): what the engine keeps of the
    // base is the skin and the face
    const buf = readFileSync(join(web, "public", BASE_URL));
    const gltf = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8")) as {
      meshes: { primitives: { indices: number; material: number }[] }[]; materials: { name: string }[]; accessors: { count: number }[];
    };
    let base = 0;
    for (const m of gltf.meshes) for (const p of m.primitives) if (["M_Skin", "M_Face"].includes(gltf.materials[p.material].name)) base += gltf.accessors[p.indices].count / 3;
    expect(base).toBeGreaterThan(1000);
    const heaviest = (slot: string) => Math.max(...PARTS.filter(p => p.slot === slot).map(p => p.tris));
    const outfit = heaviest("top") + heaviest("bottom") + heaviest("shoes");
    // the ~4000 envelope holds the earlier parts; wardrobe batch 2's (p.key) count toward CHARACTER_BUDGET.full below
    const glasses = Math.max(...PARTS.filter(p => p.group === "face" && !p.key).map(p => p.tris));
    // head-roblox: the hair is one whole hairstyle, or a hat (which replaces it and carries its own tuck)
    const bangs = Math.max(0, ...PARTS.filter(p => p.slot === "bangs").map(p => p.tris));
    const back = Math.max(...PARTS.filter(p => p.slot === "back" && !p.full).map(p => p.tris));
    const full = Math.max(...PARTS.filter(p => p.full).map(p => p.tris));   // a whole hairstyle replaces bangs and back
    // head-roblox: David's hairstyles are their original Roblox meshes (up to 4,315 triangles): budget.ts prices them
    expect(base + full + outfit + glasses, "heaviest full hairstyle").toBeLessThanOrEqual(CHARACTER_BUDGET.full.triangles);
    const hat = Math.max(...PARTS.filter(p => p.group === "head" && p.hidesBackHair && !p.key).map(p => p.tris));
    expect(base + bangs + back + outfit + glasses, "heaviest bangs + back").toBeLessThanOrEqual(4000);
    expect(base + bangs + hat + outfit + glasses, "heaviest bangs + hat").toBeLessThanOrEqual(4000);
    // wardrobe batch 2: a head item over a whole hairstyle (David: hats over hair), with a glasses, neck and front item; a
    // covering hat draws less of the hair under it (budget.test.ts counts that cut)
    const b2 = (f: (p: (typeof PARTS)[number]) => boolean) => Math.max(0, ...PARTS.filter(f).map(p => p.tris));
    const head = b2(p => p.group === "head" && !p.hidesBackHair && !p.coversHair);
    expect(base + full + head + b2(p => p.group === "face") + b2(p => p.group === "neck") + b2(p => p.group === "front") + outfit, "heaviest batch-2 look")
      .toBeLessThanOrEqual(CHARACTER_BUDGET.full.triangles);
  });
});

describe("looks", () => {
  it("parses garbage to the default and keeps valid fields", () => {
    expect(parseLook(null)).toEqual(DEFAULT_LOOK);
    const look = parseLook({ skin: 5, hair: 99, eyes: "F1.2", mouth: "nope", bangs: "back_bob", top: "top_hoodie", acc: { head: "acc_cap", face: "acc_cap" }, colors: { top_hoodie: 3, bogus: 1 } });
    expect(look).toMatchObject({ skin: 5, hair: DEFAULT_LOOK.hair, eyes: "F1.2", mouth: "M1.1", bangs: DEFAULT_LOOK.bangs, top: "top_hoodie", acc: { head: "acc_cap" }, colors: { top_hoodie: 3 } });
  });
  it("a one-piece replaces top and bottom, and a top brings the pair back", () => {
    const dress = wear(DEFAULT_LOOK, "onepiece", "onepiece_sundress");
    expect([dress.top, dress.bottom, dress.onepiece]).toEqual([null, null, "onepiece_sundress"]);
    const back = wear(dress, "top", "top_cardigan");
    expect([back.top, back.bottom, back.onepiece]).toEqual(["top_cardigan", DEFAULT_LOOK.bottom, null]);
  });
  it("hats and hoods hide the back hair and replace each other (ruling 21)", () => {
    const hat = wear(DEFAULT_LOOK, "accessory", "acc_sunhat");
    expect(wornParts(hat).some(p => p.slot === "back")).toBe(false);
    expect(wornParts(DEFAULT_LOOK).some(p => p.slot === "back")).toBe(true);
    // The wardrobe cut took the only hood (the rain-cape's): a stand-in pair keeps the rule covered for the next one.
    const dress = { ...PART_BY_ID.get("onepiece_sundress")! }, up = { ...dress, id: "test_hood_up", hidesBackHair: true, variantOf: "test_hood" };
    PART_BY_ID.set("test_hood", { ...dress, id: "test_hood" }).set(up.id, up);
    try {
      const hood = wear(hat, "onepiece", up.id);
      expect(hood.acc.head).toBeUndefined();
      expect(wornParts(hood).some(p => p.slot === "back")).toBe(false);
      const hatAgain = wear(hood, "accessory", "acc_cap");
      expect([hatAgain.onepiece, hatAgain.acc.head]).toEqual(["test_hood", "acc_cap"]);
      expect(wear(hatAgain, "accessory", "acc_cap").acc.head).toBeUndefined(); // second tap takes it off
    } finally {
      PART_BY_ID.delete("test_hood");
      PART_BY_ID.delete(up.id);
    }
  });
  it("tints each material from the palette: hair colour, chosen outfit colour, catalogue defaults", () => {
    const look = { ...wear(DEFAULT_LOOK, "accessory", "acc_cap"), hair: 4, colors: { acc_cap: 12 } };
    const cap = resolveParts(look).find(p => p.id === "acc_cap")!;
    expect(cap.tints).toEqual({ M_Main: PALETTE.outfit[12], M_Accent: PALETTE.outfit[1], M_Hair: PALETTE.hair[4] });
    const unhatted = { ...DEFAULT_LOOK, hair: 4 };
    const bob = PART_BY_ID.get(DEFAULT_LOOK.back)!.map!.natural.a!;      // round 2: the under-cap takes the texture's median, shifted
    expect(resolveParts(unhatted).find(p => p.id === DEFAULT_LOOK.back)!.tints).toEqual({ M_Hair: shiftedMedian(bob, hairShift(bob, PALETTE.hair[4])) });
    const crew = resolveParts(wear(DEFAULT_LOOK, "top", "top_tsi_crew")).find(p => p.id === "top_tsi_crew")!;
    expect(crew.decal).toMatch(/decal_tsi_mark\.png$/);
    expect(resolveParts(DEFAULT_LOOK).find(p => p.id === "top_tee")!.decal).toBeNull();
    expect(resolveParts(DEFAULT_LOOK).find(p => p.id === "shoes_slipon")!.tints.M_Sole).toBe("#C9A63A");
  });
  it("wears the hair as one of David's 37 whole hairstyles (21 less #14, wardrobe batch 2's five, less #24 and the hair shelf's three: #8 and #9 removed, #22 is its hat alone; batch 3's 15), hidden under a hat or hood (head-roblox)", () => {
    const hair = PARTS.filter(p => p.slot === "bangs" || p.slot === "back");
    expect(hair).toHaveLength(37);
    expect(hair.every(p => p.slot === "back" && p.full && p.roblox)).toBe(true);
    expect(DEFAULT_LOOK.bangs).toBe("");
    expect(PART_BY_ID.get(DEFAULT_LOOK.back)?.full).toBe(true);
    const look = wear(DEFAULT_LOOK, "back", hair[3].id);
    expect(wornParts(look).filter(p => p.slot === "bangs" || p.slot === "back").map(p => p.id)).toEqual([hair[3].id]);
    // a hat hides the hairstyle and carries its own tuck (a hood does too: the stand-in pair above)
    expect(wornParts(wear(look, "accessory", "acc_cap")).some(p => p.slot === "back")).toBe(false);
    // a band does not
    expect(wornParts(wear(look, "accessory", "acc_flower_crown")).some(p => p.id === hair[3].id)).toBe(true);
  });
  it("loads a saved look's old fringe and back as the nearest of the 21 (head-roblox)", () => {
    const old = ["bangs_straight", "bangs_straight_long", "bangs_bowl", "bangs_wispy", "bangs_swept_l", "bangs_swept_r", "bangs_curtain",
      "bangs_curtain_long", "bangs_centre_split", "bangs_spiky", "bangs_hime", "bangs_choppy", "bangs_swept_back", "bangs_single_strand",
      "bangs_wavy", "bangs_asym_block", "back_bob", "back_wolf", "back_long", "back_wavy_long", "back_high_pony", "back_pigtails",
      "back_twin_buns", "back_bun", "back_braid_crown", "back_short_spiky", "back_undercut", "back_bowl"];
    for (const id of old) {
      expect(PART_BY_ID.has(id), id).toBe(false);
      expect(PART_BY_ID.get(OLD_HAIR[id])?.full, id).toBe(true);
    }
    // the back decides; a lone old fringe next; the bangs field is always empty now
    expect(parseLook({ bangs: "bangs_curtain", back: "back_high_pony" })).toMatchObject({ bangs: "", back: "hair_wispy_ponytail" });
    expect(parseLook({ bangs: "bangs_bowl" })).toMatchObject({ bangs: "", back: "hair_bowl_cut" });
    expect(parseLook({ back: "back_pigtails", hair: 6 })).toMatchObject({ back: "hair_long_pigtails", hair: 6 });
    // unknown hair falls back to the default; a current hairstyle stays
    expect(parseLook({ back: "back_mohawk" }).back).toBe(DEFAULT_LOOK.back);
    expect(parseLook({ back: "hair_waves", bangs: "bangs_bowl" }).back).toBe("hair_waves");
  });
  it("draws a mapped hairstyle's own texture by default, and a picked colour or second colour as a shift of it (round 2)", () => {
    const two = PARTS.find(p => p.full && p.map?.natural.a && p.map.natural.b)!;
    const own = resolveParts(wear(DEFAULT_LOOK, "back", two.id)).find(p => p.id === two.id)!;
    expect(DEFAULT_LOOK.hair).toBe(NATURAL_HAIR);
    expect(own.map).toEqual({ a: NO_SHIFT, b: NO_SHIFT });                          // as Roblox draws it
    expect(own.tints.M_Hair).toBe(naturalHex(two));                                  // the under-cap: the texture's median
    const look = { ...wear(DEFAULT_LOOK, "back", two.id), hair: 5 };
    const r = resolveParts(look).find(p => p.id === two.id)!;
    expect(r.map).toEqual({ a: hairShift(two.map!.natural.a!, PALETTE.hair[5]), b: NO_SHIFT });
    expect(resolveParts({ ...look, hairAccent: 2 }).find(p => p.id === two.id)!.map!.b).toEqual(hairShift(two.map!.natural.b!, PALETTE.hair[2]));
    expect(parseLook({ hairAccent: 3 }).hairAccent).toBe(3);
    expect(parseLook({ hairAccent: 99 }).hairAccent).toBeUndefined();
    expect(parseLook({ hair: NATURAL_HAIR }).hair).toBe(NATURAL_HAIR);
    expect(parseLook({ hair: -2 }).hair).toBe(NATURAL_HAIR);                         // anything else: the default
    // every style draws its own texture (#09 and #15 one flat texel of it) and has a median to shift
    for (const p of PARTS.filter(q => q.full)) expect(p.map?.natural.a, p.id).toBeDefined();
    // #23's ribbons, #25's curls and #14's streaks are second colours of their own (David)
    for (const id of ["hair_ribbon_bob", "hair_curly_pigtails"]) expect(PART_BY_ID.get(id)!.map!.natural.b, id).toBeDefined();
    expect(PART_BY_ID.has("hair_messy_low_pony")).toBe(false);                       // round 3: #14 removed
    expect(parseLook({ back: "hair_messy_low_pony" }).back).toBe("hair_wispy_ponytail");
  });
  it("draws every hairstyle as one primitive in one material; a cap or visor is drawn as it is (never recoloured)", () => {
    for (const p of PARTS.filter(p => p.slot === "bangs" || p.slot === "back")) expect(p.materials.map(m => m.name), p.id).toEqual(["M_Hair"]);
    // batch 3: #34's ski mask, and the scalp and edges drawn in a skin colour (#36, #39, #40)
    expect(PARTS.filter(p => p.map?.fixed).map(p => p.id).sort()).toEqual(["acc_visor", "hair_dreads_cap", "hair_freeform_afro", "hair_ski_mask_dreads", "hair_space_buns", "hair_sponge_twists"]);
  });
  it("splits #8's visor off its hair into a hat drawn as it is (head-roblox, David)", () => {
    const hair = PART_BY_ID.get("hair_messy_boy")!, visor = PART_BY_ID.get("acc_visor")!;
    expect(hair.map?.fixed).toBeUndefined();
    expect([visor.slot, visor.group, visor.hidesBackHair, !!visor.full]).toEqual(["accessory", "head", false, false]);
    const look = { ...wear(wear(DEFAULT_LOOK, "back", "hair_messy_boy"), "accessory", "acc_visor"), hair: 3, hairAccent: 3 };
    const parts = resolveParts(look);
    expect(parts.map(p => p.id)).toEqual(expect.arrayContaining(["hair_messy_boy", "acc_visor"]));   // worn over the hair, not instead
    const v = parts.find(p => p.id === "acc_visor")!;
    expect(v.tints).toEqual({ M_Hair: "#2B2B33" });                 // no hair colour
    expect(v.map).toEqual({ a: NO_SHIFT, b: NO_SHIFT });            // the look's colours never recolour it
    expect(v.lod2).toBe(v.lod);
  });
  it("ships the hair texture atlas the mapped styles sample, full and its world copy, a cell each", () => {
    for (const url of Object.values(HAIR_MAPS_URLS)) expect(existsSync(join(web, "public", url)), url).toBe(true);
    const cells = PARTS.filter(p => p.map).map(p => p.map!.cell);
    expect(new Set(cells).size).toBe(cells.length);
    expect(cells.every(c => Number.isInteger(c) && c >= 0 && c < 6 * 7)).toBe(true);   // hair_colour.png: 6 x 7 cells (batch 3 added two rows)
  });
  it("random looks are always valid and seeded ones repeat", () => {
    for (let i = 0; i < 200; i++) { const look = randomLook(seeded(i)); expect(parseLook(JSON.parse(JSON.stringify(look)))).toEqual(look); }
    expect(randomLook(seeded(7))).toEqual(randomLook(seeded(7)));
  });
});

describe("a custom hair colour from the colour wheel (head-v10, row 311)", () => {
  it("keeps a valid sRGB hex (normalised) and drops anything else, so old looks load unchanged", () => {
    expect(parseLook({ ...DEFAULT_LOOK, hairColor: "#a1b2c3" }).hairColor).toBe("#A1B2C3");
    for (const bad of ["red", "#12345", "#1234567", "#GGGGGG", 12, null, "#12 456", "javascript:alert(1)"]) expect(parseLook({ ...DEFAULT_LOOK, hairColor: bad }).hairColor, String(bad)).toBeUndefined();
    expect("hairColor" in parseLook(DEFAULT_LOOK)).toBe(false);
  });
  it("shifts the hair to it over the palette index, and only the hair", () => {
    const look = parseLook({ ...DEFAULT_LOOK, hairColor: "#33CC99" });
    expect(hairHex(look)).toBe("#33CC99");
    expect(hairHex(DEFAULT_LOOK)).toBeNull();                          // round 2: the style's own colours
    expect(hairHex({ ...DEFAULT_LOOK, hair: 4 })).toBe(PALETTE.hair[4]);
    const hair = resolveParts(look).find(p => p.id === look.back)!, a = PART_BY_ID.get(look.back)!.map!.natural.a!;
    expect(hair.map!.a).toEqual(hairShift(a, "#33CC99"));
    expect(Object.values(hair.tints)).toEqual([shiftedMedian(a, hairShift(a, "#33CC99"))]);
    const top = resolveParts(look).find(p => p.id === look.top)!;
    expect(top.tints).toEqual(resolveParts(DEFAULT_LOOK).find(p => p.id === look.top)!.tints);
    expect(bodyKey(look)).not.toBe(bodyKey(DEFAULT_LOOK));
  });
  it("needs the colour wheel (David, 2026-10-17: a 250-Gem shop item; lookRefs asks for it), and fits the multiplayer card", () => {
    expect(lookRefs({ ...DEFAULT_LOOK, hairColor: "#123456" })).toEqual([...lookRefs(DEFAULT_LOOK), CUSTOM_HAIR_REF]);
    expect(CUSTOM_HAIR_REF).toBe("colour-wheel");
    expect(lookRefs({ ...DEFAULT_LOOK, hair: 10 })).toEqual([...lookRefs(DEFAULT_LOOK), "hair:10"]);   // a preset dye: that dye
    const heavy = randomLook(seeded(7));
    expect(lookBytes({ ...heavy, hairColor: "#ABCDEF" })).toBeLessThan(LOOK_MAX_BYTES);
  });
});

describe("hair tiles (head-v10, row 311: \"it lags whenever changing hair color\")", () => {
  it("ships a static thumbnail for every whole hairstyle, baked at build time", () => {
    for (const p of PARTS.filter(q => q.slot === "back" && q.full)) {
      const file = join(web, "public", HAIR_THUMB_URL(p.id));
      expect(existsSync(file), `${p.id} has no thumbnail (scripts/bake-hair-thumbs.mjs)`).toBe(true);
      expect(readFileSync(file).subarray(8, 12).toString("ascii"), p.id).toBe("WEBP");
    }
  });
});

describe("David's wardrobe cut (playtest round 1, 2026-10-14)", () => {
  const CUT = {
    eyes: ["E1.1", "E1.2", "E1.4", "E1.6", "E5.4", "E5.5", "E5.6", "E6.1", "E8.1", "E8.4", "F2.1", "F2.2"],
    mouth: [...Array.from({ length: 63 }, (_, i) => `G${Math.floor(i / 7) + 1}.${(i % 7) + 1}`).filter(g => g !== "G3.3"),
      "M2.1", "M3.2", "M4.2", "M4.3", "M5.2", "M5.3", "M6.1", "M6.3", "cat_w", "grin_curl"],
    parts: ["onepiece_jumpsuit", "onepiece_raincape", "onepiece_raincape_hood", "onepiece_robe", "acc_beanie", "acc_pumpkin_head", "acc_scarf", "acc_vampire_cape"],
  };
  const CRAFT_ONLY = ["acc_flower_crown", "acc_shell_necklace", "outfit_koi_kimono", "outfit_monarch_cape", "outfit_silk_sweater"];

  it("is gone from the face atlas and the catalogue, with its GLBs; the craft-only parts stay", () => {
    for (const id of CUT.eyes) expect(FACE.layers.eyes.items[id], id).toBeUndefined();
    for (const id of CUT.mouth) expect(FACE.layers.mouth.items[id], id).toBeUndefined();
    for (const id of CUT.parts) {
      expect(PART_BY_ID.has(id), id).toBe(false);
      for (const dir of ["outfits/onepiece", "accessories/accessory"]) {
        expect(existsSync(join(web, "public/assets/characters/v6", dir, `${id}.glb`)), id).toBe(false);
        expect(existsSync(join(web, "public/assets/characters/v6/lod1", dir, `${id}.glb`)), id).toBe(false);
      }
    }
    for (const id of CRAFT_ONLY) expect(PART_BY_ID.get(id)?.item, id).toBeTruthy();
    // 23 eyes and 25 mouths after the cut, then wardrobe batch 2's faces #20-25: six eyes and five mouths (#24 has none);
    // then batch 3's #26-32: seven of each
    expect([Object.keys(FACE.layers.eyes.items).length, Object.keys(FACE.layers.mouth.items).length]).toEqual([23 + 6 + 7, 25 + 5 + 7]);
  });

  it("loads a saved look wearing several removed parts with each slot's default, keeping the rest", () => {
    const saved = {
      ...DEFAULT_LOOK, skin: 7, hair: 3, bangs: "bangs_curtain", back: "back_high_pony",
      eyes: "E1.4", mouth: "G2.1", extras: ["freckles"], top: null, bottom: null, onepiece: "onepiece_robe", shoes: "shoes_boots",
      acc: { head: "acc_beanie", neck: "acc_scarf", face: "acc_glasses_round" }, colors: { onepiece_robe: 13, acc_scarf: 4, shoes_boots: 5 },
      place: { eyes: [1, 0, 0, 0] },
    };
    const look = parseLook(JSON.parse(JSON.stringify(saved)));
    expect(look).toEqual({
      ...saved, eyes: DEFAULT_LOOK.eyes, mouth: DEFAULT_LOOK.mouth, onepiece: null, top: DEFAULT_LOOK.top, bottom: DEFAULT_LOOK.bottom,
      bangs: "", back: "hair_wispy_ponytail",     // head-roblox: the old fringe and back load as the nearest whole hairstyle
      acc: { face: "acc_glasses_round" }, colors: { shoes_boots: 5 },
    });
    expect(resolveParts(look).map(p => p.id).sort()).toEqual(["acc_glasses_round", "bottom_shorts", "hair_wispy_ponytail", "shoes_boots", "top_tee"]);
    // a removed hood and a Halloween costume fall back too; a craft-only part still parses
    expect(parseLook({ onepiece: "onepiece_raincape_hood", acc: { head: "acc_pumpkin_head", neck: "acc_vampire_cape" } })).toMatchObject({ onepiece: null, top: "top_tee", bottom: "bottom_shorts", acc: {} });
    expect(parseLook({ ...DEFAULT_LOOK, onepiece: "outfit_koi_kimono", top: null, bottom: null, acc: { head: "acc_flower_crown" } })).toMatchObject({ onepiece: "outfit_koi_kimono", acc: { head: "acc_flower_crown" } });
  });
});

describe("wardrobe batch 2 (specs/playtest-round1.md \"New wardrobe batch\"; David's prices, specs/wardrobe/batch2-pricing.json)", () => {
  const keyed = PARTS.filter(p => p.key);
  const sold = (key: string) => ["coins", "gems"].includes(BATCH2_PRICES[key]?.mode);
  /** A GLB's first TEXCOORD_0 (the art copy: not compressed), as [u, v] pairs. */
  function uvs(file: string): number[] {
    const { json, bin } = readGlb(readFileSync(file));
    const j = json as unknown as { meshes: { primitives: { attributes: Record<string, number> }[] }[]; accessors: { bufferView: number; byteOffset?: number; count: number }[]; bufferViews: { byteOffset?: number }[] };
    const acc = j.accessors[j.meshes[0].primitives[0].attributes.TEXCOORD_0];
    const at = (j.bufferViews[acc.bufferView].byteOffset ?? 0) + (acc.byteOffset ?? 0);
    return Array.from(new Float32Array(Uint8Array.from(bin!.subarray(at, at + acc.count * 8)).buffer));   // a copy: Buffer.slice is a view
  }

  // wardrobe batch 3 (specs/lanes/wardrobe-b3.md): keyed, not priced yet (David picks on the shelf page), so free until he does
  const B3_KEYS = [...Array.from({ length: 15 }, (_, i) => `hair-${32 + i}`), "acc-25", "acc-26", "acc-27", ...Array.from({ length: 7 }, (_, i) => `face-${26 + i}`)];
  it("imports every item David didn't skip, by its pricing key: hairs #23, #25-31 and #22's hat, accessories #01-24 but #16 (and #12 and #13, deleted) and #07 in silver, faces #20-25; batch 3 unpriced", () => {
    const keys = Object.keys(BATCH2_PRICES);
    expect(keys).toHaveLength(38);
    expect(keys.some(k => k === "acc-12" || k === "acc-13")).toBe(false);           // row 314: duplicates of #10 and #07
    expect(PART_BY_ID.has("acc_wheat_sprig") || PART_BY_ID.has("acc_round_wire_glasses")).toBe(false);
    expect(keys.filter(k => BATCH2_PRICES[k].mode === "skip")).toEqual(["acc-16"]);
    const imported = [...keyed.map(p => p.key!), ...Object.keys(FACE.faces)].sort();
    expect(imported).toEqual([...keys.filter(k => k !== "acc-16"), ...B3_KEYS].sort());
    for (const k of B3_KEYS) expect(priceOf(k), k).toBeNull();
    expect(new Set(imported).size).toBe(imported.length);
    // round 2: hair-22 is #22's ushanka and goggles alone (its hair is gone)
    expect(keyed.filter(p => p.key!.startsWith("hair-")).every(p => (p.slot === "back" && p.full) || p.id === "acc_ushanka_goggles")).toBe(true);
    expect(keyed.filter(p => p.key!.startsWith("acc-"))).toHaveLength(25);
    for (const k of keys) expect(priceOf(k), k).toEqual(BATCH2_PRICES[k]);
    expect(priceOf(undefined)).toBeNull();
  });
  it("fits each accessory the Roblox way: by its attachment, in its creator slot (#07 a pair of glasses worn in Glasses)", () => {
    const SLOT: Record<string, string[]> = { HatAttachment: ["head", "face"], FaceFrontAttachment: ["face"], FaceCenterAttachment: ["face"], NeckAttachment: ["neck"], BodyFrontAttachment: ["front"] };
    for (const p of keyed.filter(q => q.slot === "accessory" && q.key!.startsWith("acc-"))) {
      expect(SLOT[p.roblox!.attachment!], p.id).toContain(p.group);
      expect(p.colourAtlas, p.id).toBe(true);
    }
    expect(PART_BY_ID.get("acc_half_rim_glasses")).toMatchObject({ key: "acc-07", group: "face", roblox: { attachment: "HatAttachment" } });
    expect(PART_BY_ID.get("acc_paper_tie")).toMatchObject({ key: "acc-03", group: "front" });
  });
  it("wears a hat over the hair (David), and only the bear hood hides it", () => {
    const hair = wear(DEFAULT_LOOK, "back", "hair_ribbon_bob");
    for (const p of keyed.filter(q => q.group === "head")) {
      const worn = wornParts(wear(hair, "accessory", p.id)).map(q => q.id);
      expect(worn.includes("hair_ribbon_bob"), p.id).toBe(p.id !== "acc_bear_hood");
      expect(worn, p.id).toContain(p.id);
    }
    // one item a slot, all four at once
    const all = ["acc_cowboy_hat", "acc_square_shades", "acc_plaid_scarf", "acc_paper_tie"].reduce((l, id) => wear(l, "accessory", id), hair);
    expect(all.acc).toEqual({ head: "acc_cowboy_hat", face: "acc_square_shades", neck: "acc_plaid_scarf", front: "acc_paper_tie" });
    expect(parseLook(JSON.parse(JSON.stringify(all)))).toEqual(all);
    expect(lookBytes(all)).toBeLessThanOrEqual(LOOK_MAX_BYTES);
  });
  it("draws the accessories' and #22's own textures from the fixed-colour atlas: every texel at u - 2, never tinted", () => {
    expect(existsSync(join(web, "public", COLOUR_ATLAS_URL))).toBe(true);
    const textured = PARTS.filter(p => p.colourAtlas);
    expect(textured.map(p => p.id).sort()).toEqual(keyed.filter(p => p.slot === "accessory").map(p => p.id).sort());
    for (const p of keyed.filter(q => q.slot === "accessory")) {
      const uv = uvs(join(art, p.glb)), u = uv.filter((_, i) => i % 2 === 0);
      expect(Math.min(...u) >= 2 && Math.max(...u) <= 3, p.id).toBe(true);
      const r = resolveParts(wear(DEFAULT_LOOK, "accessory", p.id)).find(q => q.id === p.id)!;
      expect([r.colour, Object.values(r.tints)], p.id).toEqual([true, ["#FFFFFF"]]);   // white: the texel as drawn
    }
    expect(resolveParts(DEFAULT_LOOK).some(p => p.colour)).toBe(false);
  });
  it("draws #04's logo, the arches flipped to a W, from its own tile of the fixed-colour atlas (accessories/arches_logo.py)", () => {
    // colour_atlas.py: acc_crew_visor_logo is the 256 px square at (1536, 768) of the 2048 x 1024 atlas; the band takes it at full LOD and LOD 1
    for (const file of [join(art, "accessories/roblox/acc_crew_visor.glb"), join(art, "lod1/accessories/roblox/acc_crew_visor.glb")]) {
      const uv = uvs(file), inLogo = [];
      for (let i = 0; i < uv.length; i += 2) if (uv[i] >= 2 + 1536 / 2048 && uv[i] <= 2 + 1792 / 2048 && uv[i + 1] >= 768 / 1024) inLogo.push(i / 2);
      expect(inLogo.length, file).toBeGreaterThan(6);
    }
  });
  it("puts David's faces in the atlas as mix-and-match parts, each priced face gating its own parts", () => {
    for (const [key, f] of Object.entries(FACE.faces)) {
      expect(FACE.layers.eyes.items[f.eyes], f.eyes).toBeDefined();
      if (f.mouth) expect(FACE.layers.mouth.items[f.mouth], f.mouth).toBeDefined();
      for (const x of f.extras) expect(FACE.layers.extras.items[x], x).toBeDefined();
      for (const id of [f.eyes, f.mouth, ...f.extras].filter((x): x is string => !!x)) {
        expect(facePartRef(id), id).toBe(sold(key) ? faceRef(f.id) : null);
        expect(unlockRef(id), id).toBe(sold(key) ? faceRef(f.id) : null);
        expect(FACE.names[id], id).toMatch(/^[A-Z][a-z -]+$/);
      }
    }
    expect(FACE.faces["face-24"].mouth).toBeNull();              // #24 is eyes only
    expect(facePartRef("F1.1")).toBeNull();                       // every earlier face part stays free
    // mixed: a priced face's eyes with another face's mouth needs only that face
    const mixed = { ...DEFAULT_LOOK, eyes: "cat_wide", mouth: "fangs", extras: ["stitches", "blush"] };
    const base = lookRefs(DEFAULT_LOOK);   // the starter clothes it wears
    expect(lookRefs(mixed).filter(r => !base.includes(r)).sort()).toEqual(["face:silly_cat", "face:vampire"]);
    expect(lookRefs({ ...DEFAULT_LOOK, eyes: "squint", mouth: "wide_w", extras: ["nose_shade"] })).toEqual(base);   // #22 is free
  });
  it("asks a look for each priced hairstyle and accessory it wears; the free one (#06) and the earlier parts as before", () => {
    for (const p of keyed) expect(partRef(p.id), p.id).toBe(sold(p.key!) ? p.id : null);
    expect(partRef("acc_thin_glasses")).toBeNull();
    expect(partRef("acc_cap")).toBe("acc_cap");
    expect(partRef("hair_bob_pigtail")).toBeNull();
    const look = wear(wear(wear(DEFAULT_LOOK, "back", "hair_curly_pigtails"), "accessory", "acc_cowboy_hat"), "accessory", "acc_thin_glasses");
    const base = lookRefs(DEFAULT_LOOK);
    expect(base.every(r => (STARTER_PARTS as readonly string[]).includes(r))).toBe(true);   // the starter clothes only
    expect(lookRefs(look).filter(r => !base.includes(r)).sort()).toEqual(["acc_cowboy_hat", "hair_curly_pigtails"]);
  });
  it("sells #22 as its ushanka and goggles alone, a covering hat at 200 Gems; its hair is gone (round 2, David)", () => {
    expect(PART_BY_ID.get("acc_ushanka_goggles")).toMatchObject({ slot: "accessory", group: "head", key: "hair-22", colourAtlas: true, coversHair: true, hatCut: 5 });
    expect(PART_BY_ID.get("acc_ushanka_goggles")!.grantedBy).toBeUndefined();
    expect(PART_BY_ID.has("hair_goggle_ushanka")).toBe(false);
    expect(priceOf("hair-22")).toEqual({ mode: "gems", price: 200 });
    expect(partRef("acc_ushanka_goggles")).toBe("acc_ushanka_goggles");
    const look = wear(wear(DEFAULT_LOOK, "back", "hair_ribbon_bob"), "accessory", "acc_ushanka_goggles");
    expect(wornParts(look).map(p => p.id)).toEqual(expect.arrayContaining(["hair_ribbon_bob", "acc_ushanka_goggles"]));   // a hat over the hair
  });
  it("sells #07 in silver at #07's price: the same mesh and fit, its own texture (round 2, David)", () => {
    const gold = PART_BY_ID.get("acc_half_rim_glasses")!, silver = PART_BY_ID.get("acc_half_rim_glasses_silver")!;
    expect(silver).toMatchObject({ slot: "accessory", group: "face", key: "acc-07s", colourAtlas: true, tris: gold.tris });
    expect(priceOf("acc-07s")).toEqual(priceOf("acc-07"));
    expect(partRef(silver.id)).toBe(silver.id);
  });
  it("hair shelf (David, 2026-10-27): 14 free hairstyles and 8 in the shop; three removed (and batch 3's 15, free until priced)", () => {
    const hairs = PARTS.filter(p => p.slot === "back");
    const shop = hairs.filter(p => partRef(p.id)).map(p => p.id).sort();
    expect(hairs).toHaveLength(22 + 15);
    expect(shop).toEqual(["hair_baby_sprout", "hair_curly_pigtails", "hair_double_buns", "hair_emo_layers", "hair_layered_shag", "hair_ribbon_bob", "hair_swept_fringe", "hair_vkei"]);
    for (const id of ["hair_baby_sprout", "hair_layered_shag", "hair_swept_fringe", "hair_vkei", "hair_ribbon_bob", "hair_double_buns"]) expect(priceOf(PART_BY_ID.get(id)!.key), id).toEqual({ mode: "coins", price: 350 });
    for (const id of ["hair_curly_pigtails", "hair_emo_layers"]) expect(priceOf(PART_BY_ID.get(id)!.key), id).toEqual({ mode: "gems", price: 200 });
    // removed: gone from the catalogue, and a look wearing one (or the old wavy fringe) loads as a free hairstyle
    for (const id of ["hair_visor_messy", "hair_fluffy_boy", "hair_wavy_half_up"]) {
      expect(PART_BY_ID.has(id), id).toBe(false);
      expect(parseLook({ back: id }).back, id).toBe(DEFAULT_LOOK.back);
    }
    expect(partRef(parseLook({ bangs: "bangs_wavy" }).back)).toBeNull();
    // random looks and the starter creator offer only the free ones
    for (let i = 0; i < 300; i++) {
      expect(partRef(randomLook(seeded(i)).back), String(i)).toBeNull();
      expect(partRef(randomLook(seeded(i), new Set(STARTER_PARTS)).back), String(i)).toBeNull();
    }
  });
  it("never dresses residents or bots in it: random looks keep the parts they had", () => {
    const b2 = new Set([...keyed.map(p => p.id), "acc_ushanka_goggles", ...Object.values(FACE.faces).flatMap(f => [f.eyes, f.mouth, ...f.extras])]);
    for (let i = 0; i < 300; i++) {
      const l = randomLook(seeded(i));
      expect([l.back, l.eyes, l.mouth, ...l.extras, ...Object.values(l.acc)].some(id => id && b2.has(id)), String(i)).toBe(false);
    }
  });
});
