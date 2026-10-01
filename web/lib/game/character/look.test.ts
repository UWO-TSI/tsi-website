import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BASE_URL, CLIPS, DEFAULT_LOOK, FACE, FACE_ATLAS_URLS, HAIR_STRANDS_URL, PALETTE, PARTS, PART_BY_ID, hairAnchors, parseLook, randomLook, resolveParts, seeded, wear, wornParts } from "./look";

const web = join(__dirname, "../../..");
const art = join(web, "../art/characters");

describe("character catalogue", () => {
  it("matches art/characters (re-run scripts/sync-character-assets.mjs after a character build)", () => {
    for (const [copy, source] of [["character_catalog.json", "character_catalog.json"], ["palette.json", "palette.json"], ["face_v7.json", "v7/face/face_v7.json"]]) {
      expect(readFileSync(join(web, "data/characters", copy), "utf8"), copy).toBe(readFileSync(join(art, source), "utf8"));
    }
  });
  it("ships every part GLB, the clip base and the face atlases", () => {
    for (const p of PARTS) expect(existsSync(join(web, "public/assets/characters/v6", p.glb)), p.glb).toBe(true);
    for (const f of [BASE_URL, FACE_ATLAS_URLS.creator, FACE_ATLAS_URLS.world, HAIR_STRANDS_URL]) expect(existsSync(join(web, "public", f)), f).toBe(true);
    expect(existsSync(join(web, "public/assets/characters/v6/decal_tsi_mark.png"))).toBe(true);
    expect(BASE_URL).toMatch(/v7_clips\.glb$/); // the hand-modeled v7 head (avatar v7)
  });
  it("has unique ids, known slots, budgets, and the palette sizes of row 143", () => {
    expect(new Set(PARTS.map(p => p.id)).size).toBe(PARTS.length);
    for (const p of PARTS) {
      expect(["bangs", "back", "top", "bottom", "onepiece", "shoes", "accessory"]).toContain(p.slot);
      // Hair and headwear are closed solids (avatar-fit); a hat carries its own hair tuck and replaces the back hair.
      // Sculpted-lock hair (avatar v7) spends more per piece; the full look stays under ~4000 (next test).
      // Accessories sit outside that look budget (avatar v8, row 265), each on its own: headwear with its tuck 1,700,
      // any other accessory 600.
      const lockHair = (p as { v7?: boolean }).v7;
      expect(p.tris, p.id).toBeLessThanOrEqual(lockHair ? 1200 : p.slot === "bangs" || p.slot === "back" ? 700 : p.group === "head" ? 1700 : p.slot === "accessory" ? 600 : 300);
      if (p.slot === "accessory") expect(["face", "head", "bag", "neck", "hair"]).toContain(p.group);
      if (p.group === "hair") expect(p.sits?.length, p.id).toBeGreaterThan(0);
      if (p.variantOf) expect(PART_BY_ID.has(p.variantOf)).toBe(true);
      for (const m of p.materials) if (m.tint === "outfit") expect(m.default as number).toBeLessThan(PALETTE.outfit.length);
    }
    expect([PALETTE.skin.length, PALETTE.hair.length, PALETTE.outfit.length]).toEqual([12, 12, 16]);
    expect(CLIPS.map(c => c.name)).toEqual(expect.arrayContaining(["Idle", "Walk", "Run", "Sit", "Study", "Sleep", "Fish", "FishHold", "Forage", "Dig", "Net", "Wave", "Cheer", "Laugh", "Sad", "Dance", "AttackMelee", "AttackBow", "AttackCast", "DodgeRoll", "Hit", "Defeat", "Trace", "Stretch"]));
    const cells: [string, number[]][] = [
      ...Object.entries(FACE.layers.eyes.items).flatMap(([id, frames]) => Object.entries(frames).map(([f, c]) => [`${id}/${f}`, c] as [string, number[]])),
      ...Object.entries(FACE.layers.mouth.items), ...Object.entries(FACE.layers.talk.items), ...Object.entries(FACE.layers.brows.items),
      ...Object.entries(FACE.layers.extras.items).map(([id, it]) => [id, it.cell] as [string, number[]]),
    ];
    for (const [id, [x, y, w, h, ax, ay]] of cells) {
      expect(x + w <= FACE.atlas_size[0] && y + h <= FACE.atlas_size[1], id).toBe(true);
      // placed on its anchor, a cell lands on the face canvas (the shut eye frames sit a little under the eye centre)
      expect(Math.abs(ax - w / 2) < w && Math.abs(ay - h / 2) < h, id).toBe(true);
    }
  });
  it("keeps a full look with sculpted-lock hair under ~4000 triangles (avatar v7)", () => {
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
    // every bangs with every back; accessories (glasses, hats with their tucks, bags, hair accessories) are outside
    // the 4,000 (avatar v8, row 265) and keep their own per-piece budgets (previous test)
    const bangs = Math.max(...PARTS.filter(p => p.slot === "bangs").map(p => p.tris));
    const back = Math.max(...PARTS.filter(p => p.slot === "back").map(p => p.tris));
    expect(base + bangs + back + outfit, "heaviest bangs + back").toBeLessThanOrEqual(4000);
  });
});

describe("looks", () => {
  it("parses garbage to the default and keeps valid fields", () => {
    expect(parseLook(null)).toEqual(DEFAULT_LOOK);
    const look = parseLook({ skin: 5, hair: 99, eyes: "E5.5", mouth: "nope", bangs: "back_bob", top: "top_hoodie", acc: { head: "acc_cap", face: "acc_cap" }, colors: { top_hoodie: 3, bogus: 1 } });
    expect(look).toMatchObject({ skin: 5, hair: DEFAULT_LOOK.hair, eyes: "E5.5", mouth: "M1.1", bangs: DEFAULT_LOOK.bangs, top: "top_hoodie", acc: { head: "acc_cap" }, colors: { top_hoodie: 3 } });
  });
  it("a one-piece replaces top and bottom, and a top brings the pair back", () => {
    const dress = wear(DEFAULT_LOOK, "onepiece", "onepiece_sundress");
    expect([dress.top, dress.bottom, dress.onepiece]).toEqual([null, null, "onepiece_sundress"]);
    const back = wear(dress, "top", "top_cardigan");
    expect([back.top, back.bottom, back.onepiece]).toEqual(["top_cardigan", DEFAULT_LOOK.bottom, null]);
  });
  it("hats and hoods hide the back hair and replace each other (ruling 21)", () => {
    const hat = wear(DEFAULT_LOOK, "accessory", "acc_beanie");
    expect(wornParts(hat).some(p => p.slot === "back")).toBe(false);
    expect(wornParts(DEFAULT_LOOK).some(p => p.slot === "back")).toBe(true);
    const hood = wear(hat, "onepiece", "onepiece_raincape_hood");
    expect(hood.acc.head).toBeUndefined();
    expect(wornParts(hood).some(p => p.slot === "back")).toBe(false);
    const hatAgain = wear(hood, "accessory", "acc_cap");
    expect([hatAgain.onepiece, hatAgain.acc.head]).toEqual(["onepiece_raincape", "acc_cap"]);
    expect(wear(hatAgain, "accessory", "acc_cap").acc.head).toBeUndefined(); // second tap takes it off
  });
  it("tints each material from the palette: hair colour, chosen outfit colour, catalogue defaults", () => {
    const look = { ...wear(DEFAULT_LOOK, "accessory", "acc_beanie"), hair: 4, colors: { acc_beanie: 12 } };
    const beanie = resolveParts(look).find(p => p.id === "acc_beanie")!;
    expect(beanie.tints).toEqual({ M_Main: PALETTE.outfit[12], M_Accent: PALETTE.outfit[0], M_Hair: PALETTE.hair[4] });
    expect(resolveParts(look).find(p => p.id === "bangs_straight")!.tints).toEqual({ M_Hair: PALETTE.hair[4] });
    const crew = resolveParts(wear(DEFAULT_LOOK, "top", "top_tsi_crew")).find(p => p.id === "top_tsi_crew")!;
    expect(crew.decal).toMatch(/decal_tsi_mark\.png$/);
    expect(resolveParts(DEFAULT_LOOK).find(p => p.id === "top_tee")!.decal).toBeNull();
    expect(resolveParts(DEFAULT_LOOK).find(p => p.id === "shoes_slipon")!.tints.M_Sole).toBe("#C9A63A");
  });
  it("hair accessories sit on the worn style's anchors and hide without one or under a hat (avatar v8)", () => {
    const bob = { ...DEFAULT_LOOK, back: "back_bob", bangs: "bangs_straight" };
    const pony = { ...bob, back: "back_high_pony" };
    const pigtails = { ...bob, back: "back_pigtails" };
    const scrunchie = PART_BY_ID.get("hacc_scrunchie")!, bow = PART_BY_ID.get("hacc_bow")!, clip = PART_BY_ID.get("hacc_claw_clip")!;
    expect(parseLook({ ...bob, acc: { hair: "hacc_bow" } }).acc).toEqual({ hair: "hacc_bow" });       // the new group saves
    expect(hairAnchors(bob, bow)).toEqual(PART_BY_ID.get("back_bob")!.anchors!.side);               // a bob has no tie: the side
    expect(hairAnchors(pony, bow)).toEqual(PART_BY_ID.get("back_high_pony")!.anchors!.pony);        // the pony tie comes first
    expect(hairAnchors(pigtails, scrunchie)).toHaveLength(2);                                        // one on each pigtail
    expect(hairAnchors(bob, clip)).toEqual(PART_BY_ID.get("back_bob")!.anchors!.crown);
    expect(hairAnchors(bob, scrunchie)).toEqual([]);                                                 // nothing to wrap: hidden
    const worn = wear(bob, "accessory", "hacc_scrunchie");
    expect(worn.acc.hair).toBe("hacc_scrunchie");
    expect(wornParts(worn).some(p => p.id === "hacc_scrunchie")).toBe(false);
    expect(resolveParts(wear(pony, "accessory", "hacc_scrunchie")).find(p => p.id === "hacc_scrunchie")!.place).toEqual({ at: PART_BY_ID.get("back_high_pony")!.anchors!.pony, wrap: scrunchie.wrap });
    const hatted = wear(wear(pony, "accessory", "hacc_bow"), "accessory", "acc_beanie");
    expect([hatted.acc.hair, hatted.acc.head]).toEqual(["hacc_bow", "acc_beanie"]);                  // they stack...
    expect(wornParts(hatted).some(p => p.group === "hair")).toBe(false);                             // ...but a hat covers it
    expect(wornParts(wear(hatted, "onepiece", "onepiece_raincape_hood")).some(p => p.group === "hair")).toBe(false);
    // every piece's anchors are placements [p(3), q(4), r, h] with a unit quaternion
    for (const p of PARTS) for (const at of Object.values(p.anchors ?? {})) for (const a of at) {
      expect(a).toHaveLength(9);
      expect(Math.abs(Math.hypot(a[3], a[4], a[5], a[6]) - 1), p.id).toBeLessThan(1e-3);
    }
  });
  it("random looks are always valid and seeded ones repeat", () => {
    for (let i = 0; i < 200; i++) { const look = randomLook(seeded(i)); expect(parseLook(JSON.parse(JSON.stringify(look)))).toEqual(look); }
    expect(randomLook(seeded(7))).toEqual(randomLook(seeded(7)));
  });
});
