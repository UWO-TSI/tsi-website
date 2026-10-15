import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { glbStats, readGlb } from "@/lib/game/perf/glbStats";
import { CHARACTER_BUDGET } from "@/lib/game/perf/budget";
import { BASE_URL, HAIR_MAPS_URL, OLD_HAIR, LOD_SKIN_URL, CLIPS, DEFAULT_LOOK, FACE, FACE_ATLAS2_URLS, FACE_ATLAS_URLS, PALETTE, PARTS, PART_BY_ID, parseLook, randomLook, resolveParts, seeded, wear, wornParts } from "./look";

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
      if (p.full) shipsCompressed(shipped, source, `lod1/${p.glb}`);
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
      expect(p.tris, p.id).toBeLessThanOrEqual(p.full ? 4400 : lockHair ? 1200 : p.slot === "bangs" || p.slot === "back" ? 700 : p.group === "head" ? 1150 : 300);
      if (p.slot === "accessory") expect(["face", "head", "bag", "neck"]).toContain(p.group);
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
    const glasses = Math.max(...PARTS.filter(p => p.group === "face").map(p => p.tris));
    // head-roblox: the hair is one whole hairstyle, or a hat (which replaces it and carries its own tuck)
    const bangs = Math.max(0, ...PARTS.filter(p => p.slot === "bangs").map(p => p.tris));
    const back = Math.max(...PARTS.filter(p => p.slot === "back" && !p.full).map(p => p.tris));
    const full = Math.max(...PARTS.filter(p => p.full).map(p => p.tris));   // a whole hairstyle replaces bangs and back
    // head-roblox: David's hairstyles are their original Roblox meshes (up to 4,315 triangles): budget.ts prices them
    expect(base + full + outfit + glasses, "heaviest full hairstyle").toBeLessThanOrEqual(CHARACTER_BUDGET.full.triangles);
    const hat = Math.max(...PARTS.filter(p => p.group === "head" && p.hidesBackHair).map(p => p.tris));
    expect(base + bangs + back + outfit + glasses, "heaviest bangs + back").toBeLessThanOrEqual(4000);
    expect(base + bangs + hat + outfit + glasses, "heaviest bangs + hat").toBeLessThanOrEqual(4000);
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
    expect(resolveParts(unhatted).find(p => p.id === DEFAULT_LOOK.back)!.tints).toEqual({ M_Hair: PALETTE.hair[4] });
    const crew = resolveParts(wear(DEFAULT_LOOK, "top", "top_tsi_crew")).find(p => p.id === "top_tsi_crew")!;
    expect(crew.decal).toMatch(/decal_tsi_mark\.png$/);
    expect(resolveParts(DEFAULT_LOOK).find(p => p.id === "top_tee")!.decal).toBeNull();
    expect(resolveParts(DEFAULT_LOOK).find(p => p.id === "shoes_slipon")!.tints.M_Sole).toBe("#C9A63A");
  });
  it("wears the hair as one of David's 21 whole hairstyles, hidden under a hat or hood (head-roblox)", () => {
    const hair = PARTS.filter(p => p.slot === "bangs" || p.slot === "back");
    expect(hair).toHaveLength(21);
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
  it("tints a mapped hairstyle from the palette and its accent from the look, the style's default or the skin (head fit)", () => {
    const two = PARTS.find(p => p.full && p.map?.accent !== undefined && typeof p.accent?.default === "number")!;
    const look = { ...wear(DEFAULT_LOOK, "back", two.id), hair: 5 };
    const r = resolveParts(look).find(p => p.id === two.id)!;
    expect(r.tints.M_Hair).toBe(PALETTE.hair[5]);
    expect(r.map).toEqual({ shade: two.map!.shade, accent: two.map!.accent, ...(two.map!.cap !== undefined ? { cap: two.map!.cap } : {}), accentHex: PALETTE.hair[two.accent!.default as number] });
    expect(resolveParts({ ...look, hairAccent: 2 }).find(p => p.id === two.id)!.map!.accentHex).toBe(PALETTE.hair[2]);
    const fade = PARTS.find(p => p.accent?.default === "skin")!;
    expect(resolveParts({ ...wear(DEFAULT_LOOK, "back", fade.id), skin: 7 }).find(p => p.id === fade.id)!.map!.accentHex).toBe(PALETTE.skin[7]);
    expect(parseLook({ hairAccent: 3 }).hairAccent).toBe(3);
    expect(parseLook({ hairAccent: 99 }).hairAccent).toBeUndefined();
    expect(resolveParts(DEFAULT_LOOK).find(p => p.id === DEFAULT_LOOK.back)!.map).not.toBeNull();     // every style but #9 is mapped
    expect(PART_BY_ID.get("hair_fluffy_boy")!.map).toBeUndefined();
  });
  it("draws every hairstyle as one primitive in one material: caps and second colours are mask channels (head fit)", () => {
    for (const p of PARTS.filter(p => p.slot === "bangs" || p.slot === "back")) expect(p.materials.map(m => m.name), p.id).toEqual(["M_Hair"]);
    const capped = PARTS.filter(p => p.map?.cap !== undefined).map(p => p.id).sort();
    expect(capped).toEqual(["hair_dreads_cap"]);
    const r = resolveParts(wear(DEFAULT_LOOK, "back", "hair_dreads_cap")).find(p => p.id === "hair_dreads_cap")!;
    expect(r.map?.cap).toBe(PART_BY_ID.get("hair_dreads_cap")!.map!.cap);
  });
  it("splits #8's visor off its hair into a hat with a fixed grey and its own logo colour (head-roblox, David)", () => {
    const hair = PART_BY_ID.get("hair_visor_messy")!, visor = PART_BY_ID.get("acc_visor")!;
    expect(hair.map?.cap).toBeUndefined();
    expect([visor.slot, visor.group, visor.hidesBackHair, !!visor.full]).toEqual(["accessory", "head", false, false]);
    const look = { ...wear(wear(DEFAULT_LOOK, "back", "hair_visor_messy"), "accessory", "acc_visor"), hairAccent: 3 };
    const parts = resolveParts(look);
    expect(parts.map(p => p.id)).toEqual(expect.arrayContaining(["hair_visor_messy", "acc_visor"]));   // worn over the hair, not instead
    const v = parts.find(p => p.id === "acc_visor")!;
    expect(v.tints).toEqual({ M_Hair: "#2B2B33" });                 // no hair colour
    expect(v.map?.accentHex).toBe("#E9B530");                        // the look's hair accent never recolours the logo
    expect(v.lod2).toBe(v.lod);
  });
  it("ships the hair shading atlas the mapped styles sample", () => {
    expect(existsSync(join(web, "public", HAIR_MAPS_URL))).toBe(true);
    for (const p of PARTS.filter(p => p.map)) expect([p.map!.shade, p.map!.accent ?? 0, p.map!.cap ?? 0].every(c => c >= 0 && c <= 2), p.id).toBe(true);
  });
  it("random looks are always valid and seeded ones repeat", () => {
    for (let i = 0; i < 200; i++) { const look = randomLook(seeded(i)); expect(parseLook(JSON.parse(JSON.stringify(look)))).toEqual(look); }
    expect(randomLook(seeded(7))).toEqual(randomLook(seeded(7)));
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
    expect([Object.keys(FACE.layers.eyes.items).length, Object.keys(FACE.layers.mouth.items).length]).toEqual([23, 25]);
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
