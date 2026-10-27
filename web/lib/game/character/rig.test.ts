import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { adoptPrimitive, CUTS, DESIGN_U, hasBit, mergeLook, refCache, skinnedPrimitives } from "./rig";
import { NO_SHIFT } from "./hairColour";
import { DESIGNS, designUse, PART_BY_ID, PARTS } from "./look";

function skinned(boneNames: string[], joints: number[], color?: number[]) {
  const bones = boneNames.map(n => Object.assign(new THREE.Bone(), { name: n }));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setIndex([0, 1, 2]);
  g.setAttribute("skinIndex", new THREE.Uint8BufferAttribute(joints.flatMap(j => [j, 0, 0, 0]), 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(joints.flatMap(() => [1, 0, 0, 0]), 4));
  if (color) g.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
  const mesh = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial({ name: "M_Main" }));
  mesh.bind(new THREE.Skeleton(bones));
  return mesh;
}

const load = (file: string) => new Promise<THREE.Object3D>((resolve, reject) => {
  const buf = readFileSync(join(__dirname, "../../../public/assets/characters/v6", file));
  // David's hairstyles ship meshopt-compressed (scripts/sync-character-assets.mjs), as the game's useGLTF decodes them
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", g => resolve(g.scene), reject);
});

describe("what a look never shows (wardrobe batch 2: art/characters/hidden_cut.py; David: \"find ways to not render part of hair\")", () => {
  it("reads a hide mark's bits: the sum of 2^i over the hats that hide a vertex", () => {
    expect([hasBit(0, 0), hasBit(1, 0), hasBit(6, 1), hasBit(6, 2), hasBit(6, 0), hasBit(16, 4), hasBit(6.9999, 0)]).toEqual([false, true, true, true, false, true, true]);
  });
  it("leaves out the hair a hat wins over (its bit on all three vertices), and nothing without one", async () => {
    const hair = await load("hair/full/hair_ribbon_bob.glb");
    const bones = skinnedPrimitives(hair)[0].skeleton.bones, index = new Map(bones.map((b, i) => [b.name, i]));
    const mesh = skinnedPrimitives(hair)[0], mark = mesh.geometry.getAttribute("_hatcut");
    expect(mark, "the shipped GLB carries _HATCUT").toBeDefined();
    const all = mesh.geometry.index!.count / 3;
    // round 2: the covering hats and the visor's band, bits 0, 1, 2, ... with none missing
    const hats = PARTS.filter(p => p.hatCut !== undefined);
    expect(hats.map(p => p.hatCut).sort((x, y) => x! - y!)).toEqual(hats.map((_, i) => i));
    expect(hats.filter(p => !p.coversHair).map(p => p.id)).toEqual(["acc_crew_visor"]);
    for (const hat of hats) {
      const g = adoptPrimitive(mesh, index, null, null, [{ name: "_HATCUT", bit: hat.hatCut! }]);
      const ix = mesh.geometry.index!;
      let hidden = 0;
      for (let i = 0; i < ix.count; i += 3) if ([0, 1, 2].every(k => hasBit(mark.getX(ix.getX(i + k)), hat.hatCut!))) hidden++;
      expect(g.index!.count / 3, hat.id).toBe(all - hidden);
    }
    expect(adoptPrimitive(mesh, index, null, null, []).index!.count / 3).toBe(all);
    // the bench's &cut=0 draws everything
    try {
      CUTS.on = false;
      expect(adoptPrimitive(mesh, index, null, null, [{ name: "_HATCUT", bit: 0 }]).index!.count / 3).toBe(all);
    } finally {
      CUTS.on = true;
    }
    // hats always win (round 2): the cap takes the bob above its rim; a wide hat leaves the hair under its brim
    const cut = (id: string) => all - adoptPrimitive(mesh, index, null, null, [{ name: "_HATCUT", bit: PART_BY_ID.get(id)!.hatCut! }]).index!.count / 3;
    expect(cut("acc_propeller_cap")).toBeGreaterThan(all / 3);
    for (const wide of ["acc_cowboy_hat", "acc_woven_hat", "acc_red_band_straw_hat"]) expect(cut(wide), wide).toBeLessThan(all * 0.9);
  });
  it("leaves out the head the hood hides, on the clip base and the LOD skin", async () => {
    // the clip base embeds the face image, which the loader can't decode under Node: its JSON carries the mark
    const buf = readFileSync(join(__dirname, "../../../public/assets/characters/v6/base/v8_clips.glb"));
    const gltf = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8")) as { meshes: { name: string; primitives: { attributes: Record<string, number> }[] }[] };
    expect(gltf.meshes.find(m => m.name === "V8_Head")!.primitives.some(p => "_HOODCUT" in p.attributes)).toBe(true);
    for (const file of ["lod1/base/skin.glb"]) {
      const root = await load(file);
      const head = skinnedPrimitives(root).find(m => m.geometry.getAttribute("_hoodcut"))!;
      expect(head, file).toBeDefined();
      const index = new Map(head.skeleton.bones.map((b, i) => [b.name, i]));
      const all = head.geometry.index!.count / 3, kept = adoptPrimitive(head, index, null, null, [{ name: "_HOODCUT", bit: 0 }]).index!.count / 3;
      expect(kept, file).toBeLessThan(all);
      expect(kept, file).toBeGreaterThan(all / 4);       // the face side stays
    }
    expect(PARTS.filter(p => p.coversHead).map(p => p.id)).toEqual(["acc_bear_hood"]);
  });
  it("leaves out the body skin each worn garment covers (clothing-v2), on the clip base and the LOD skin", async () => {
    const buf = readFileSync(join(__dirname, "../../../public/assets/characters/v6/base/v8_clips.glb"));
    const gltf = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8")) as { meshes: { name: string; primitives: { attributes: Record<string, number> }[] }[] };
    expect(gltf.meshes.find(m => m.name === "V6_Body")!.primitives.some(p => "_BODYCUT" in p.attributes)).toBe(true);
    // one bit per universal model, none missing; every design on one model shares its bit
    const garments = PARTS.filter(p => p.bodyCut !== undefined);
    const bits = new Map<string, number>();
    for (const p of garments) {
      expect(bits.get(p.glb) ?? p.bodyCut, p.id).toBe(p.bodyCut);
      bits.set(p.glb, p.bodyCut!);
    }
    expect([...bits.values()].sort((x, y) => x - y)).toEqual([...bits.values()].map((_, i) => i));
    const root = await load("lod1/base/skin.glb");
    const body = skinnedPrimitives(root).find(m => m.geometry.getAttribute("_bodycut"))!;
    expect(body, "the LOD skin carries _BODYCUT").toBeDefined();
    const index = new Map(body.skeleton.bones.map((b, i) => [b.name, i]));
    const all = body.geometry.index!.count / 3;
    const kept = (...ids: string[]) => adoptPrimitive(body, index, null, null, ids.map(id => ({ name: "_BODYCUT", bit: PART_BY_ID.get(id)!.bodyCut! }))).index!.count / 3;
    for (const p of garments) expect(kept(p.id), p.id).toBeLessThan(all);           // every garment hides some skin
    expect(kept("top_stripe_ls"), "a long sleeve hides more arm than a tee").toBeLessThan(kept("top_tee"));
    expect(kept("bottom_trousers"), "trousers hide more leg than shorts").toBeLessThan(kept("bottom_shorts"));
    // a look's cuts add up: the tee, the trousers and the sneakers together hide more than any one
    expect(kept("top_tee", "bottom_trousers", "shoes_sneakers")).toBeLessThan(Math.min(kept("top_tee"), kept("bottom_trousers"), kept("shoes_sneakers")));
  });
});

describe("designs (clothing-v2: one universal mesh per garment, a design is paint on it)", () => {
  it("a designed garment's uv moves into its atlas cell, past DESIGN_U, its shade kept for the paint", () => {
    const part = skinned(["mixamorigHips"], [0, 0, 0], [0.8, 0.8, 0.8, 1, 1, 1, 0.9, 0.9, 0.9]);
    part.geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    const use = designUse(5);
    const g = adoptPrimitive(part, new Map([["mixamorigHips", 0]]), new THREE.Color(1, 1, 1), null, [], use);
    const uv = Array.from(g.getAttribute("uv").array);
    expect(uv[0]).toBeCloseTo(DESIGN_U + use.u0);
    expect(uv[1]).toBeCloseTo(use.v0);
    expect(uv[2]).toBeCloseTo(DESIGN_U + use.u0 + use.s);
    expect(uv[5]).toBeCloseTo(use.v0 + use.s);
    expect(Array.from(g.getAttribute("hairMap").array).filter((_, i) => i % 3 === 1).map(x => +x.toFixed(3))).toEqual([0.8, 1, 0.9]);
    expect(Array.from(g.getAttribute("hairMap").array).filter((_, i) => i % 3 === 0)).toEqual([0, 0, 0]);   // never a mapped hairstyle
    // without a design: the uv as it is
    expect(Array.from(adoptPrimitive(part, new Map([["mixamorigHips", 0]]), null).getAttribute("uv").array)).toEqual([0, 0, 1, 0, 0.5, 1]);
  });
  it("the cells sit inside the atlas, inside their own gutters, one per design", () => {
    const cells = Object.values(DESIGNS.cells);
    expect(new Set(cells).size).toBe(cells.length);
    for (const c of cells) {
      const { u0, v0, s } = designUse(c);
      const g = DESIGNS.grid, col = c % g, row = Math.floor(c / g);
      expect(u0).toBeGreaterThan(col / g);
      expect(u0 + s).toBeLessThan((col + 1) / g);
      expect(v0).toBeGreaterThan(row / g);
      expect(v0 + s).toBeLessThan((row + 1) / g);
    }
    // the striped long-sleeve is the long-sleeve with the stripe design on it
    expect(PART_BY_ID.get("top_stripe_ls")).toMatchObject({ glb: "outfits/top/top_longsleeve.glb", design: DESIGNS.cells.stripe });
  });
});

describe("character rig assembly", () => {
  it("binds a part to the base skeleton by bone name, whatever its joint order", () => {
    const base = ["mixamorigHips", "mixamorigSpine", "mixamorigHead"].map(n => Object.assign(new THREE.Bone(), { name: n }));
    const part = skinned(["mixamorigHead", "mixamorigHips"], [0, 1, 0], [0.5, 0.5, 0.5, 1, 1, 1, 1, 1, 1]);
    const g = adoptPrimitive(part, new Map(base.map((b, i) => [b.name, i])), new THREE.Color(1, 0.5, 0));
    expect(Array.from(g.getAttribute("skinIndex").array).filter((_, i) => i % 4 === 0)).toEqual([2, 0, 2]);
    expect(Array.from(g.getAttribute("color").array.slice(0, 6))).toEqual([0.5, 0.25, 0, 1, 0.5, 0]); // COLOR_0 x tint
    expect(g.getAttribute("uv").count).toBe(3);
  });
  it("refuses a part that uses a bone the base rig lacks", () => {
    const part = skinned(["mixamorigTail"], [0, 0, 0]);
    expect(() => adoptPrimitive(part, new Map([["mixamorigHips", 0]]), null)).toThrow(/mixamorigTail/);
  });
  it("merges real hair GLBs into one geometry on one skeleton", async () => {
    // head-roblox: two of David's whole hairstyles (a look wears one; two prove the merge across GLBs)
    const [bangs, back] = await Promise.all([load("hair/full/hair_bob_pigtail.glb"), load("hair/full/hair_bowl_cut.glb")]);
    const bones = skinnedPrimitives(bangs)[0].skeleton.bones;
    expect(bones).toHaveLength(22);
    const merged = mergeLook([{ root: bangs, tints: { M_Hair: "#8C5E3C" } }, { root: back, tints: { M_Hair: "#8C5E3C" } }], bones);
    const tris = (merged.index!.count) / 3;
    const glbTris = (r: THREE.Object3D) => skinnedPrimitives(r).reduce((n, m) => n + m.geometry.index!.count / 3, 0);
    expect(tris).toBe(glbTris(bangs) + glbTris(back));
    const head = bones.findIndex(b => b.name === "mixamorigHead");
    const idx = merged.getAttribute("skinIndex"), w = merged.getAttribute("skinWeight");
    for (let i = 0; i < idx.count; i++) if (w.getX(i) > 0.99) expect(idx.getX(i)).toBe(head); // hair is skinned 100% to the head
    // merged without a map (mergeLook's map argument): every hairMap is zero
    expect(Array.from(merged.getAttribute("hairMap").array).every(x => x === 0)).toBe(true);
  });
  it("marks a mapped hair's vertices and carries each channel's shift and lightness (rounds 2 and 3)", () => {
    const part = skinned(["mixamorigHead"], [0, 0, 0]);
    part.geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    const a = { m: [0.5, -0.2, 0.2, 0.5] as [number, number, number, number], o: [0.01, -0.02] as [number, number], l: 0.3, L: [0.5, 0.4] as [number, number] };
    const g = adoptPrimitive(part, new Map([["mixamorigHead", 0]]), new THREE.Color(1, 1, 1), { a, b: NO_SHIFT });
    expect(Array.from(g.getAttribute("hairMap").array).map(x => Math.round(x * 100) / 100)).toEqual([1, 0.3, 0.5, 1, 0.3, 0.5, 1, 0.3, 0.5]);
    expect(Array.from(g.getAttribute("hairA").array.slice(0, 4)).map(x => Math.round(x * 100) / 100)).toEqual([0.5, 0.2, 0.01, -0.02]);   // p, q, o
    expect(Array.from(g.getAttribute("hairB").array.slice(0, 4))).toEqual([1, 0, 0, 0]);                                                  // identity
    expect(Array.from(g.getAttribute("hairL").array.slice(0, 4)).map(x => Math.round(x * 100) / 100)).toEqual([0.5, 0.4, 1, 0]);         // lightness: a's, b's identity
    const plain = adoptPrimitive(part, new Map([["mixamorigHead", 0]]), null);
    expect(Array.from(plain.getAttribute("hairMap").array)).toEqual(new Array(9).fill(0));
  });
  it("shares identical looks and disposes after the last user", () => {
    const cache = refCache<{ dispose(): void; n: number }>();
    let disposed = 0, made = 0;
    const make = () => ({ n: ++made, dispose: () => { disposed++; } });
    expect(cache.acquire("a", make)).toBe(cache.acquire("a", make));
    cache.release("a"); expect(disposed).toBe(0);
    cache.release("a"); expect([disposed, cache.size()]).toEqual([1, 0]);
  });
});
